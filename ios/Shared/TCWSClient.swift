import Foundation

/// Connects to the TC-Cue WebSocket server.
/// Automatically reconnects on disconnect with exponential backoff.
///
/// Architecture:
/// - WS receive runs on a background thread (Task.detached) so iOS networking
///   doesn't contend with the main actor.
/// - TC display updates are driven by a 25 fps timer on the main actor so the
///   display is always smooth regardless of TCP burst delivery patterns.
/// - CUE_FIRE is dispatched to the main actor immediately.
@MainActor
final class TCWSClient: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var previousCue: CueModel?
    @Published var currentCue: CueModel?
    @Published var nextCue: CueModel?
    @Published var currentPosition: ShowPositionModel?
    @Published var activeShow: ShowModel?
    @Published var currentTc: String = "--:--:--:--"
    @Published var lastError: String?

    var onCueFire: ((CueModel, CueModel?) -> Void)?

    private var task: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var displayTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var reconnectDelay: TimeInterval = 2
    private(set) var serverURL: String = ""
    private var wsDelegate: WSOpenDelegate?

    // Thread-safe snapshot written by background receive task,
    // read by the main-actor display timer.
    private let snapshot = TCSnapshot()

    // MARK: - Public API

    static var defaultServerURL: String {
        let stored = UserDefaults.standard.string(forKey: "serverURL")?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !stored.isEmpty { return stored }
#if targetEnvironment(simulator) || targetEnvironment(macCatalyst)
        return "127.0.0.1:3000"
#else
        return ""
#endif
    }

    func connect(serverURL: String) {
        let normalizedURL = serverURL
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if self.serverURL == normalizedURL, connectionState != .disconnected { return }
        self.serverURL = normalizedURL
        lastError = nil
        reconnectDelay = 2
        reconnectTask?.cancel()
        openSocket()
    }

    func disconnect() {
        reconnectTask?.cancel()
        receiveTask?.cancel()
        displayTask?.cancel()
        heartbeatTask?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        wsDelegate = nil
        previousCue = nil
        currentCue = nil
        nextCue = nil
        currentPosition = nil
        currentTc = "--:--:--:--"
        connectionState = .disconnected
    }

    // MARK: - Socket Lifecycle

    private func openSocket() {
        let host = serverURL
            .replacingOccurrences(of: "http://",  with: "")
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "ws://",    with: "")
            .replacingOccurrences(of: "wss://",   with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty, let url = URL(string: "ws://\(host)/") else {
            lastError = "Ungültige Server-Adresse"
            return
        }

        receiveTask?.cancel()
        displayTask?.cancel()
        heartbeatTask?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        connectionState = .connecting

        let delegate = WSOpenDelegate { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, self.connectionState == .connecting else { return }
                self.connectionState = .connected
                self.lastError = nil
                self.reconnectDelay = 2
                self.startDisplayTimer()
                Task { await self.reloadShow() }
            }
        }
        wsDelegate = delegate
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        let newTask = session.webSocketTask(with: url)
        task = newTask
        newTask.resume()
        startHeartbeat(for: newTask)

        // Receive on a background thread — not the main actor
        let snap = snapshot
        receiveTask = Task.detached { [weak self] in
            await TCWSClient.receiveLoop(task: newTask, snapshot: snap, client: self)
        }
    }

    func reloadShow() async {
        guard let url = httpURL(path: "/api/shows") else { return }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            activeShow = try JSONDecoder().decode([ShowModel].self, from: data).first
        } catch {
            lastError = error.localizedDescription
        }
    }

    func setChecklistItem(checklistId: String, itemId: String, checked: Bool) async {
        guard var show = activeShow,
              var checklists = show.checklists,
              let checklistIndex = checklists.firstIndex(where: { $0.id == checklistId }),
              let itemIndex = checklists[checklistIndex].items.firstIndex(where: { $0.id == itemId }),
              let url = httpURL(path: "/api/shows/\(show.id)/checklists/\(checklistId)")
        else { return }

        checklists[checklistIndex].items[itemIndex].checked = checked
        show.checklists = checklists
        activeShow = show

        do {
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(checklists[checklistIndex])
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                await reloadShow()
                return
            }
        } catch {
            lastError = error.localizedDescription
            await reloadShow()
        }
    }

    func completeChecklist(_ checklistId: String) async {
        guard let checklist = activeShow?.checklists?.first(where: { $0.id == checklistId }) else { return }
        for item in checklist.items where !item.checked {
            await setChecklistItem(checklistId: checklistId, itemId: item.id, checked: true)
        }
    }

    private func httpURL(path: String) -> URL? {
        var address = serverURL
            .replacingOccurrences(of: "ws://", with: "http://")
            .replacingOccurrences(of: "wss://", with: "https://")
        if !address.hasPrefix("http://") && !address.hasPrefix("https://") {
            address = "http://\(address)"
        }
        guard var components = URLComponents(string: address) else { return nil }
        components.path = path
        components.query = nil
        components.fragment = nil
        return components.url
    }

    // MARK: - Display Timer (25 fps, main actor)

    private func startDisplayTimer() {
        displayTask?.cancel()
        displayTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 40_000_000) // 25 fps
                self?.applySnapshot()
            }
        }
    }

    private func startHeartbeat(for socket: URLSessionWebSocketTask) {
        heartbeatTask?.cancel()
        heartbeatTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                guard !Task.isCancelled, let self, self.task === socket else { return }
                socket.sendPing { [weak self] error in
                    guard let error else { return }
                    Task { @MainActor [weak self] in
                        guard let self, self.task === socket else { return }
                        self.handleDisconnect(error: error.localizedDescription)
                    }
                }
            }
        }
    }

    private func applySnapshot() {
        let s = snapshot.read()
        if s.tc != currentTc { currentTc = s.tc }
        if s.prev != previousCue { previousCue = s.prev }
        if s.cur != currentCue { currentCue = s.cur }
        if s.next != nextCue { nextCue = s.next }
        if s.position != currentPosition { currentPosition = s.position }
    }

    // MARK: - Cue Events (main actor, immediate)

    private func handleCueFire(_ ev: CueFireEvent) {
        previousCue = ev.previousCue
        currentCue = ev.cue
        nextCue = ev.nextCue
        onCueFire?(ev.cue, ev.nextCue)
    }

    func handleDisconnect(error: String? = nil) {
        guard connectionState != .disconnected || task != nil else { return }
        heartbeatTask?.cancel()
        displayTask?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        wsDelegate = nil
        lastError = error
        currentTc = "--:--:--:--"
        connectionState = .disconnected
        let delay = reconnectDelay
        reconnectDelay = min(reconnectDelay * 1.5, 30)
        reconnectTask = Task {
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            openSocket()
        }
    }

    // MARK: - Background Receive Loop (static, no main-actor capture)

    private static func receiveLoop(
        task: URLSessionWebSocketTask,
        snapshot: TCSnapshot,
        client: TCWSClient?
    ) async {
        let dec = JSONDecoder()
        do {
            while !Task.isCancelled {
                let msg = try await task.receive()
                if Task.isCancelled { break }

                guard case .string(let text) = msg,
                      let data = text.data(using: .utf8),
                      let sniff = try? dec.decode(WSTypeSniff.self, from: data)
                else { continue }

                switch sniff.type {
                case "TC_UPDATE":
                    guard let ev = try? dec.decode(TCUpdateEvent.self, from: data) else { continue }
                    // Write to snapshot — read by display timer on main actor
                    snapshot.update(tc: ev.tc, prev: ev.previousCue, cur: ev.currentCue, next: ev.nextCue, position: ev.currentPosition)

                case "CUE_FIRE":
                    guard let ev = try? dec.decode(CueFireEvent.self, from: data) else { continue }
                    // Cue events go to main actor immediately
                    await MainActor.run { client?.handleCueFire(ev) }

                default: break
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run { client?.handleDisconnect(error: error.localizedDescription) }
        }
    }
}

// MARK: - Thread-safe TC Snapshot

/// Written by the background receive task, read by the main-actor display timer.
final class TCSnapshot: @unchecked Sendable {
    private let lock = NSLock()
    private var _tc: String = "--:--:--:--"
    private var _prev: CueModel? = nil
    private var _cur: CueModel? = nil
    private var _next: CueModel? = nil
    private var _position: ShowPositionModel? = nil

    func update(tc: String, prev: CueModel?, cur: CueModel?, next: CueModel?, position: ShowPositionModel?) {
        lock.withLock {
            _tc = tc; _prev = prev; _cur = cur; _next = next; _position = position
        }
    }

    func read() -> (tc: String, prev: CueModel?, cur: CueModel?, next: CueModel?, position: ShowPositionModel?) {
        lock.withLock { (_tc, _prev, _cur, _next, _position) }
    }
}

// MARK: - WebSocket Handshake Delegate

private final class WSOpenDelegate: NSObject, URLSessionWebSocketDelegate {
    private let onOpen: () -> Void
    init(onOpen: @escaping () -> Void) { self.onOpen = onOpen }
    func urlSession(_ session: URLSession,
                    webSocketTask: URLSessionWebSocketTask,
                    didOpenWithProtocol protocol: String?) { onOpen() }
}

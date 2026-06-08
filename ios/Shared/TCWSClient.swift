import Foundation

/// Connects to the TC-Cue WebSocket server.
/// Automatically reconnects on disconnect with exponential backoff.
///
/// Architecture:
/// - WS receive runs on a background thread (Task.detached) so iOS networking
///   doesn't contend with the main actor.
/// - TC display updates are driven by a 25 fps timer on the main actor so the
///   display is always smooth regardless of TCP burst delivery patterns.
/// - CUE_FIRE / CUE_WARNING are dispatched to the main actor immediately.
@MainActor
final class TCWSClient: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var previousCue: CueModel?
    @Published var currentCue: CueModel?
    @Published var nextCue: CueModel?
    @Published var currentTc: String = "--:--:--:--"
    @Published var warningCue: CueModel?
    @Published var warningSecondsUntil: Int = 0
    @Published var lastError: String?
    private var warningReceivedAt: Date?
    private var warningInitialSeconds: Int = 0

    var onCueFire: ((CueModel, CueModel?) -> Void)?
    var onCueWarning: ((CueModel, Int) -> Void)?

    private var task: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var displayTask: Task<Void, Never>?
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
#if targetEnvironment(simulator)
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
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        wsDelegate = nil
        connectionState = .disconnected
        previousCue = nil
        currentCue = nil
        nextCue = nil
        warningCue = nil
        warningReceivedAt = nil
        currentTc = "--:--:--:--"
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
        task?.cancel(with: .goingAway, reason: nil)
        connectionState = .connecting

        let delegate = WSOpenDelegate { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, self.connectionState == .connecting else { return }
                self.connectionState = .connected
                self.lastError = nil
                self.reconnectDelay = 2
                self.startDisplayTimer()
            }
        }
        wsDelegate = delegate
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        let newTask = session.webSocketTask(with: url)
        task = newTask
        newTask.resume()

        // Receive on a background thread — not the main actor
        let snap = snapshot
        receiveTask = Task.detached { [weak self] in
            await TCWSClient.receiveLoop(task: newTask, snapshot: snap, client: self)
        }
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

    private func applySnapshot() {
        let s = snapshot.read()
        if s.tc != currentTc { currentTc = s.tc }
        if s.prev != previousCue { previousCue = s.prev }
        if s.cur != currentCue { currentCue = s.cur }
        if s.next != nextCue { nextCue = s.next }
        if let t = warningReceivedAt {
            let remaining = max(0, warningInitialSeconds - Int(Date().timeIntervalSince(t)))
            if remaining != warningSecondsUntil { warningSecondsUntil = remaining }
            if remaining == 0 { warningReceivedAt = nil }
        }
    }

    // MARK: - Cue Events (main actor, immediate)

    private func handleCueFire(_ ev: CueFireEvent) {
        previousCue = ev.previousCue
        currentCue = ev.cue
        nextCue = ev.nextCue
        if warningCue?.id == ev.cue.id {
            warningCue = nil
            warningReceivedAt = nil
        }
        onCueFire?(ev.cue, ev.nextCue)
    }

    private func handleCueWarning(_ ev: CueWarningEvent) {
        warningCue = ev.cue
        warningInitialSeconds = ev.secondsUntil
        warningReceivedAt = Date()
        warningSecondsUntil = ev.secondsUntil
        onCueWarning?(ev.cue, ev.secondsUntil)
    }

    func handleDisconnect(error: String? = nil) {
        displayTask?.cancel()
        task = nil
        wsDelegate = nil
        connectionState = .disconnected
        lastError = error
        currentTc = "--:--:--:--"
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
                    snapshot.update(tc: ev.tc, prev: ev.previousCue, cur: ev.currentCue, next: ev.nextCue)

                case "CUE_FIRE":
                    guard let ev = try? dec.decode(CueFireEvent.self, from: data) else { continue }
                    // Cue events go to main actor immediately
                    await MainActor.run { client?.handleCueFire(ev) }

                case "CUE_WARNING":
                    guard let ev = try? dec.decode(CueWarningEvent.self, from: data) else { continue }
                    await MainActor.run { client?.handleCueWarning(ev) }

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

    func update(tc: String, prev: CueModel?, cur: CueModel?, next: CueModel?) {
        lock.withLock {
            _tc = tc; _prev = prev; _cur = cur; _next = next
        }
    }

    func read() -> (tc: String, prev: CueModel?, cur: CueModel?, next: CueModel?) {
        lock.withLock { (_tc, _prev, _cur, _next) }
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

import SwiftUI
import WatchConnectivity

@main
struct TCCueApp: App {
    @StateObject private var client = TCWSClient()
    @StateObject private var watchBridge = WatchBridge.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(client)
                .environmentObject(watchBridge)
                .preferredColorScheme(.dark)
                .onAppear {
                    watchBridge.activate()
                    autoConnect()
                }
                .onChange(of: client.connectionState) { _, state in
                    switch state {
                    case .connected:
                        LiveActivityManager.shared.start()
                    case .disconnected:
                        LiveActivityManager.shared.end()
                    case .connecting:
                        break
                    }
                }
                .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
                    guard client.connectionState == .connected else { return }
                    LiveActivityManager.shared.update(
                        cue: client.currentCue,
                        nextCue: client.nextCue,
                        currentTc: client.currentTc
                    )
                }
        }
    }

    private func autoConnect() {
        let url = TCWSClient.defaultServerURL
        guard !url.isEmpty else { return }
        UserDefaults.standard.set(url, forKey: "serverURL")
        Task { @MainActor in
            setupCallbacks()
            client.connect(serverURL: url)
        }
    }

    private func setupCallbacks() {
        client.onCueFire = { [weak client] cue, next in
            HapticManager.alarm()
            WatchBridge.shared.send(cue: cue, nextCue: next, event: "fire")
            LiveActivityManager.shared.update(
                cue: cue, nextCue: next,
                currentTc: client?.currentTc ?? "--:--:--:--"
            )
        }
    }
}

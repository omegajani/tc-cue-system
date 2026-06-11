import SwiftUI

@main
struct TCCueApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var client = TCWSClient()
    @AppStorage("liveActivityEnabled") private var liveActivityEnabled = true

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(client)
                .preferredColorScheme(.dark)
                .onAppear {
                    configureCueFeedback()
                    autoConnect()
                    reconcileLiveActivity()
                }
                .onChange(of: client.connectionState) { _, state in
                    reconcileLiveActivity()
                }
                .onChange(of: liveActivityEnabled) { _, enabled in
                    reconcileLiveActivity()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        autoConnect()
                        reconcileLiveActivity()
                    }
                }
                .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
                    guard client.connectionState == .connected else { return }
                    reconcileLiveActivity()
                }
        }
    }

    private func autoConnect() {
        let serverURL = TCWSClient.defaultServerURL
        guard !serverURL.isEmpty else { return }
        client.connect(serverURL: serverURL)
    }

    private func configureCueFeedback() {
        client.onCueFire = { _, _ in
            guard UserDefaults.standard.object(forKey: "hapticsEnabled") as? Bool ?? true else { return }
            HapticManager.alarm()
        }
    }

    private func reconcileLiveActivity() {
        LiveActivityManager.shared.reconcile(
            cue: client.currentCue,
            nextCue: client.nextCue,
            currentTc: client.currentTc,
            enabled: liveActivityEnabled
        )
    }
}

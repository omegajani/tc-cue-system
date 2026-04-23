import SwiftUI
import WatchKit

@main
struct TCCueWatchApp: App {
    @WKApplicationDelegateAdaptor var appDelegate: WatchAppDelegate
    @StateObject private var state = WatchState.shared

    var body: some Scene {
        WindowGroup {
            WatchLiveView()
                .environmentObject(state)
        }
    }
}

class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        WatchState.shared.activate()
    }
}

import Foundation
import WatchConnectivity
import WatchKit
import SwiftUI

struct WatchCue: Equatable {
    let id: String
    let title: String
    let message: String
    let color: String
    let tc: String

    var swiftUIColor: Color { Color(hex: color) ?? .green }
}

struct WatchNextCue: Equatable {
    let title: String
    let tc: String
    let color: String
    var swiftUIColor: Color { Color(hex: color) ?? .gray }
}

@MainActor
final class WatchState: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchState()

    @Published var currentCue: WatchCue?
    @Published var nextCue: WatchNextCue?
    @Published var lastEvent: String = ""

    private override init() { super.init() }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession,
                             activationDidCompleteWith state: WCSessionActivationState,
                             error: Error?) {}

    nonisolated func session(_ session: WCSession,
                             didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            self.handle(message)
        }
    }

    // MARK: - Message Handling

    private func handle(_ msg: [String: Any]) {
        let event = msg["event"] as? String ?? ""
        let cue = WatchCue(
            id:        msg["cueId"]     as? String ?? UUID().uuidString,
            title:     msg["cueTitle"]  as? String ?? "",
            message:   msg["cueMessage"] as? String ?? "",
            color:     msg["cueColor"]  as? String ?? "#10b981",
            tc:        msg["cueTc"]     as? String ?? ""
        )

        let nextTitle = msg["nextTitle"] as? String
        let next: WatchNextCue? = nextTitle.map {
            WatchNextCue(
                title: $0,
                tc:    msg["nextTc"]    as? String ?? "",
                color: msg["nextColor"] as? String ?? "#6b7280"
            )
        }

        currentCue = cue
        nextCue = next
        lastEvent = event

        // Haptics
        switch event {
        case "fire":
            WKInterfaceDevice.current().play(.notification)
        default: break
        }
    }
}

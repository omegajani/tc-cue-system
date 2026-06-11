import Foundation
import WatchConnectivity

/// Sends cue events from the iOS app to the paired Apple Watch.
final class WatchBridge: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchBridge()

    private override init() { super.init() }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(cue: CueModel, nextCue: CueModel?, event: String) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated,
              WCSession.default.isReachable
        else { return }

        var payload: [String: Any] = [
            "event": event,
            "cueId": cue.id,
            "cueTitle": cue.title,
            "cueMessage": cue.message,
            "cueColor": cue.color,
            "cueTc": cue.tc,
        ]
        if let n = nextCue {
            payload["nextTitle"] = n.title
            payload["nextTc"] = n.tc
            payload["nextColor"] = n.color
        }
        WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
    }

    // MARK: - WCSessionDelegate (required)

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
}

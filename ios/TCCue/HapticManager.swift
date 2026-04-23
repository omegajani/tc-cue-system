import UIKit

enum HapticManager {

    /// Cue gefeuert — Muster je nach Alert-Typ
    static func fireCue(alertType: String = "info") {
        switch alertType {
        case "urgent":
            impact(.heavy)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.10) { impact(.heavy) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.20) { impact(.heavy) }
        case "warning":
            impact(.heavy)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { impact(.medium) }
        default:
            impact(.medium)
        }
    }

    /// Cue-Warning (nächster Cue steht bevor)
    static func warnCue() {
        let gen = UINotificationFeedbackGenerator()
        gen.prepare()
        gen.notificationOccurred(.warning)
    }

    // MARK: - Private

    private static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let gen = UIImpactFeedbackGenerator(style: style)
        gen.impactOccurred()
    }
}

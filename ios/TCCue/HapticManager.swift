import UIKit

enum HapticManager {

    static func alarm() {
        let gen = UINotificationFeedbackGenerator()
        gen.prepare()
        gen.notificationOccurred(.warning)
    }
}

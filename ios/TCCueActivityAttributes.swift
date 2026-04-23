import ActivityKit
import Foundation

struct TCCueActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var currentCueTitle: String
        var currentCueColor: String   // hex "#rrggbb"
        var currentCueTc: String
        var alertType: String         // "info" | "warning" | "urgent"
        var nextCueTitle: String?
        var nextCueTc: String?
        var isWarning: Bool
        var warningSecondsUntil: Int
    }
    var role: String
}

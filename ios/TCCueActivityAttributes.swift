import ActivityKit
import Foundation

struct TCCueActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var currentCueTitle: String
        var currentCueColor: String   // hex "#rrggbb"
        var currentTc: String
        var tcAnchorDate: Date?
        var isTcRunning: Bool
        var currentCueTc: String?
        var nextCueTitle: String?
        var nextCueTc: String?
    }
}

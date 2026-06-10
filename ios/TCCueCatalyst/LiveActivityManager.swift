import Foundation

@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    func start() {}

    func update(
        cue: CueModel?,
        nextCue: CueModel?,
        currentTc: String
    ) {}

    func end() {}
}

import ActivityKit
import Foundation

@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()
    private var activity: Activity<TCCueActivityAttributes>?

    func start() {
        let info = ActivityAuthorizationInfo()
        print("[LiveActivity] areActivitiesEnabled=\(info.areActivitiesEnabled) frequentPushesEnabled=\(info.frequentPushesEnabled)")
        guard info.areActivitiesEnabled else {
            print("[LiveActivity] Activities disabled — check Settings → TC Cue → Live Activities")
            return
        }
        let previous = activity
        Task { await previous?.end(dismissalPolicy: .immediate) }
        let state = TCCueActivityAttributes.ContentState(
            currentCueTitle: "Verbunden",
            currentCueColor: "#888888",
            currentCueTc: "--:--:--:--",
            nextCueTitle: nil,
            nextCueTc: nil
        )
        let content = ActivityContent(state: state, staleDate: nil)
        do {
            activity = try Activity.request(
                attributes: TCCueActivityAttributes(),
                content: content,
                pushType: nil
            )
            print("[LiveActivity] started — id=\(activity?.id ?? "nil")")
            if let activity {
                Task {
                    for await state in activity.activityStateUpdates {
                        print("[LiveActivity] state changed → \(state)")
                    }
                }
            }
        } catch {
            print("[LiveActivity] start failed: \(error)")
        }
    }

    func update(cue: CueModel?, nextCue: CueModel?, currentTc: String) {
        guard let activity else { return }
        let state = TCCueActivityAttributes.ContentState(
            currentCueTitle: cue?.title ?? "Kein Cue",
            currentCueColor: cue?.color ?? "#888888",
            currentCueTc: currentTc,
            nextCueTitle: nextCue?.title,
            nextCueTc: nextCue?.tc
        )
        Task {
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
    }

    func end() {
        Task {
            await activity?.end(dismissalPolicy: .immediate)
            activity = nil
        }
    }
}

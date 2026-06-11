import ActivityKit
import Foundation

@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private var activity: Activity<TCCueActivityAttributes>?
    private var stateObserver: Task<Void, Never>?
    private var pendingState: TCCueActivityAttributes.ContentState?
    private var isUpdating = false

    private var previousSample: (seconds: TimeInterval, date: Date)?
    private var stableAnchorDate: Date?
    private var lastAnchorSyncDate = Date.distantPast
    private var lastPublishedState: TCCueActivityAttributes.ContentState?

    func reconcile(cue: CueModel?, nextCue: CueModel?, currentTc: String, enabled: Bool) {
        guard enabled else {
            end()
            return
        }

        ensureSingleActivity()
        guard activity != nil else { return }

        let now = Date()
        let seconds = tcSeconds(currentTc)
        let isRunning = detectRunning(seconds: seconds, now: now)
        let anchorChanged = updateAnchor(seconds: seconds, now: now, isRunning: isRunning)

        let state = TCCueActivityAttributes.ContentState(
            currentCueTitle: cue?.title ?? "Kein Cue",
            currentCueColor: cue?.color ?? "#888888",
            currentTc: currentTc,
            tcAnchorDate: isRunning ? stableAnchorDate : nil,
            isTcRunning: isRunning,
            currentCueTc: cue?.tc,
            nextCueTitle: nextCue?.title,
            nextCueTc: nextCue?.tc
        )

        guard shouldPublish(state, anchorChanged: anchorChanged) else { return }
        enqueue(state)
    }

    func end() {
        stateObserver?.cancel()
        stateObserver = nil
        pendingState = nil
        lastPublishedState = nil
        stableAnchorDate = nil
        previousSample = nil

        let activities = Activity<TCCueActivityAttributes>.activities
        activity = nil
        Task {
            for activity in activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    private func ensureSingleActivity() {
        let activities = Activity<TCCueActivityAttributes>.activities
        if let existing = activities.first {
            if activity?.id != existing.id {
                activity = existing
                lastPublishedState = existing.content.state
                stableAnchorDate = existing.content.state.tcAnchorDate
                observe(existing)
            }
            if activities.count > 1 {
                let duplicates = activities.dropFirst()
                Task {
                    for duplicate in duplicates {
                        await duplicate.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }
            return
        }

        let authorization = ActivityAuthorizationInfo()
        guard authorization.areActivitiesEnabled else {
            print("[LiveActivity] disabled by system settings")
            return
        }

        let state = placeholderState
        do {
            let newActivity = try Activity.request(
                attributes: TCCueActivityAttributes(),
                content: activityContent(for: state),
                pushType: nil
            )
            activity = newActivity
            lastPublishedState = state
            observe(newActivity)
            print("[LiveActivity] started id=\(newActivity.id)")
        } catch {
            print("[LiveActivity] start failed: \(error)")
        }
    }

    private func observe(_ observedActivity: Activity<TCCueActivityAttributes>) {
        stateObserver?.cancel()
        stateObserver = Task { [weak self] in
            for await state in observedActivity.activityStateUpdates {
                guard !Task.isCancelled else { return }
                if state == .dismissed || state == .ended {
                    await MainActor.run {
                        guard self?.activity?.id == observedActivity.id else { return }
                        self?.activity = nil
                        self?.lastPublishedState = nil
                    }
                    return
                }
            }
        }
    }

    private func detectRunning(seconds: TimeInterval?, now: Date) -> Bool {
        defer {
            if let seconds {
                previousSample = (seconds, now)
            } else {
                previousSample = nil
            }
        }
        guard let seconds, let previousSample else { return false }
        let elapsed = now.timeIntervalSince(previousSample.date)
        let advanced = seconds - previousSample.seconds
        return elapsed < 3 && advanced > 0.1 && advanced < elapsed + 2
    }

    private func updateAnchor(seconds: TimeInterval?, now: Date, isRunning: Bool) -> Bool {
        guard isRunning, let seconds else {
            let changed = stableAnchorDate != nil
            stableAnchorDate = nil
            return changed
        }

        let proposed = now.addingTimeInterval(-seconds)
        guard let anchor = stableAnchorDate else {
            stableAnchorDate = proposed
            lastAnchorSyncDate = now
            return true
        }

        let drift = abs(now.timeIntervalSince(anchor) - seconds)
        if drift > 1.25 || now.timeIntervalSince(lastAnchorSyncDate) > 30 {
            stableAnchorDate = proposed
            lastAnchorSyncDate = now
            return true
        }
        return false
    }

    private func shouldPublish(
        _ state: TCCueActivityAttributes.ContentState,
        anchorChanged: Bool
    ) -> Bool {
        guard let previous = lastPublishedState else { return true }
        if anchorChanged || state.isTcRunning != previous.isTcRunning { return true }
        if state.currentCueTitle != previous.currentCueTitle ||
            state.currentCueColor != previous.currentCueColor ||
            state.currentCueTc != previous.currentCueTc ||
            state.nextCueTitle != previous.nextCueTitle ||
            state.nextCueTc != previous.nextCueTc {
            return true
        }
        return !state.isTcRunning && state.currentTc != previous.currentTc
    }

    private func enqueue(_ state: TCCueActivityAttributes.ContentState) {
        pendingState = state
        guard !isUpdating else { return }
        isUpdating = true

        Task { [weak self] in
            while let self, let next = self.pendingState {
                self.pendingState = nil
                guard let activity = self.activity else { break }
                await activity.update(self.activityContent(for: next))
                self.lastPublishedState = next
            }
            self?.isUpdating = false
        }
    }

    private var placeholderState: TCCueActivityAttributes.ContentState {
        TCCueActivityAttributes.ContentState(
            currentCueTitle: "Verbunden",
            currentCueColor: "#888888",
            currentTc: "--:--:--:--",
            tcAnchorDate: nil,
            isTcRunning: false,
            currentCueTc: nil,
            nextCueTitle: nil,
            nextCueTc: nil
        )
    }

    private func activityContent(
        for state: TCCueActivityAttributes.ContentState
    ) -> ActivityContent<TCCueActivityAttributes.ContentState> {
        ActivityContent(state: state, staleDate: Date().addingTimeInterval(45))
    }

    private func tcSeconds(_ tc: String) -> TimeInterval? {
        let parts = tc.split(separator: ":").compactMap { Double($0) }
        guard parts.count == 4 else { return nil }
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25
    }
}

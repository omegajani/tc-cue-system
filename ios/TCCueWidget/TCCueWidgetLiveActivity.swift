import ActivityKit
import WidgetKit
import SwiftUI

struct TCCueWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TCCueActivityAttributes.self) { context in
            LockScreenView(state: context.state, isStale: context.isStale)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(hexColor(context.state.currentCueColor))
                            .frame(width: 8, height: 8)
                        Text(context.isStale ? "SYNC" : (context.state.isTcRunning ? "LIVE" : "TC"))
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(context.isStale ? .orange : .white.opacity(0.72))
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    LiveTimecodeText(state: context.state, size: 12, mode: .full)
                        .foregroundStyle(.white.opacity(0.82))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.currentCueTitle)
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if let next = context.state.nextCueTitle,
                           let nextTc = context.state.nextCueTc {
                            HStack(spacing: 6) {
                                Text("DANACH")
                                    .font(.system(size: 9, weight: .bold, design: .rounded))
                                    .tracking(0.8)
                                    .foregroundStyle(hexColor(context.state.currentCueColor))
                                Text(next)
                                    .font(.system(size: 11, weight: .medium, design: .rounded))
                                    .foregroundStyle(.white.opacity(0.7))
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Text(shortTc(nextTc))
                                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                                    .foregroundStyle(.white.opacity(0.48))
                            }
                            .frame(height: 16)
                        }
                    }
                    .padding(.top, 2)
                    .padding(.bottom, 8)
                }
            } compactLeading: {
                Circle()
                    .fill(context.isStale ? .orange : hexColor(context.state.currentCueColor))
                    .frame(width: 9, height: 9)
            } compactTrailing: {
                LiveTimecodeText(state: context.state, size: 11, mode: .compact)
                    .frame(minWidth: 38)
            } minimal: {
                Circle()
                    .fill(hexColor(context.state.currentCueColor))
                    .frame(width: 11, height: 11)
            }
            .keylineTint(hexColor(context.state.currentCueColor))
        }
    }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
    let state: TCCueActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Capsule()
                    .fill(hexColor(state.currentCueColor))
                    .frame(width: 20, height: 5)
                Text(isStale ? "SYNC" : (state.isTcRunning ? "LIVE" : "TIMECODE"))
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(isStale ? .orange : hexColor(state.currentCueColor))
                Spacer(minLength: 8)
                LiveTimecodeText(state: state, size: 13, mode: .full)
                    .foregroundStyle(.white.opacity(0.82))
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(state.currentCueTitle)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Spacer(minLength: 6)
                if let cueTc = state.currentCueTc {
                    Text(shortTc(cueTc))
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(hexColor(state.currentCueColor))
                }
            }

            if let next = state.nextCueTitle, let nextTc = state.nextCueTc {
                HStack(spacing: 7) {
                    Text("DANACH")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .tracking(0.8)
                        .foregroundStyle(hexColor(state.currentCueColor))
                    Text(next)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(shortTc(nextTc))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.48))
                }
            } else {
                Text("Kein weiterer Cue")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .activityBackgroundTint(Color(red: 0.035, green: 0.035, blue: 0.05))
        .activitySystemActionForegroundColor(.white)
    }
}

// MARK: - Helpers

private struct LiveTimecodeText: View {
    enum Mode {
        case full
        case compact
    }

    let state: TCCueActivityAttributes.ContentState
    let size: CGFloat
    let mode: Mode

    var body: some View {
        Group {
            if state.isTcRunning, let anchor = state.tcAnchorDate {
                Text(anchor, style: .timer)
            } else {
                Text(mode == .compact ? shortTc(state.currentTc) : state.currentTc)
            }
        }
        .font(.system(size: size, weight: .semibold, design: .monospaced))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.72)
    }
}

private func shortTc(_ tc: String) -> String {
    let parts = tc.split(separator: ":")
    guard parts.count == 4 else { return tc }
    return "\(parts[1]):\(parts[2])"
}

private func hexColor(_ hex: String) -> Color {
    var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if h.hasPrefix("#") { h = String(h.dropFirst()) }
    guard h.count == 6, let val = UInt64(h, radix: 16) else { return .accentColor }
    return Color(
        red:   Double((val >> 16) & 0xFF) / 255,
        green: Double((val >>  8) & 0xFF) / 255,
        blue:  Double( val        & 0xFF) / 255
    )
}

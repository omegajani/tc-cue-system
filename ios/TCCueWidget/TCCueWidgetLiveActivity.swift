import ActivityKit
import WidgetKit
import SwiftUI

struct TCCueWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TCCueActivityAttributes.self) { context in
            LockScreenView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(hexColor(context.state.currentCueColor))
                            .frame(width: 10, height: 10)
                        Text(context.state.currentCueTc)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text("● TC CUE ●")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.red)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let next = context.state.nextCueTitle,
                              let nextTc = context.state.nextCueTc {
                        HStack {
                            Text("NÄCHSTER")
                                .font(.system(size: 9, weight: .semibold))
                                .tracking(1)
                                .foregroundStyle(.white.opacity(0.5))
                            Text(next)
                                .font(.system(size: 10))
                                .foregroundStyle(.white.opacity(0.7))
                                .lineLimit(1)
                            Spacer()
                            Text(nextTc)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
            } compactLeading: {
                Circle().fill(Color.red).frame(width: 10, height: 10)
            } compactTrailing: {
                Text("CUE").font(.caption).bold().foregroundStyle(Color.red)
            } minimal: {
                Circle().fill(Color.red)
            }
        }
    }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
    let state: TCCueActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(hexColor(state.currentCueColor))
                    .frame(width: 10, height: 10)
                Text(state.currentCueTitle)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
                Text(state.currentCueTc)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.6))
            }

            Divider().overlay(Color.white.opacity(0.2))

            if let next = state.nextCueTitle, let nextTc = state.nextCueTc {
                HStack(spacing: 6) {
                    Text("NÄCHSTER")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(.white.opacity(0.5))
                    Text(next)
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.8))
                        .lineLimit(1)
                    Spacer()
                    Text(nextTc)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                }
            } else {
                Text("Kein weiterer Cue")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .font(.custom("Lexend", size: 11, relativeTo: .body))
        .activityBackgroundTint(Color.black)
    }
}

// MARK: - Helpers

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

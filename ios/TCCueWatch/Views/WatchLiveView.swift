import SwiftUI
import WatchKit

struct WatchLiveView: View {
    @EnvironmentObject var state: WatchState
    @State private var flash = false

    var body: some View {
        ZStack {
            // Background flash on cue fire
            if flash {
                currentColor.opacity(0.3).ignoresSafeArea()
            }

            VStack(alignment: .leading, spacing: 6) {
                // Cue indicator
                HStack(spacing: 5) {
                    Circle()
                        .fill(currentColor)
                        .frame(width: 8, height: 8)
                    Text(state.currentCue != nil ? "CUE" : "BEREIT")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(currentColor)
                    Spacer()
                    if let cue = state.currentCue {
                        Text(cue.tc)
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }

                // Main title
                if let cue = state.currentCue {
                    Text(cue.title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(3)
                        .minimumScaleFactor(0.7)

                    if !cue.message.isEmpty {
                        Text(cue.message)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                } else {
                    Text("Warte auf Cue…")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Next cue strip
                if let next = state.nextCue {
                    Divider()
                    HStack(spacing: 4) {
                        Circle()
                            .fill(next.swiftUIColor)
                            .frame(width: 5, height: 5)
                        Text("NEXT")
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(1)
                            .foregroundStyle(.secondary)
                        Text(next.title)
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.8))
                            .lineLimit(1)
                    }
                }
            }
            .padding(8)
        }
        .containerBackground(Color.black, for: .navigation)
        .onChange(of: state.lastEvent) { _, event in
            guard event == "fire" else { return }
            withAnimation(.easeOut(duration: 0.15)) { flash = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                withAnimation(.easeIn(duration: 0.3)) { flash = false }
            }
        }
    }

    private var currentColor: Color {
        guard let cue = state.currentCue else { return .gray }
        return cue.swiftUIColor
    }
}

#Preview {
    WatchLiveView()
        .environmentObject(WatchState.shared)
}

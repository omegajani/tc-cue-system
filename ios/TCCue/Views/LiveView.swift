import SwiftUI

struct LiveView: View {
    @EnvironmentObject var client: TCWSClient
    @State private var elapsedSec: Int = 0
    @State private var firedAt: Date?
    @State private var timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var flashOpacity: Double = 0
    @State private var flashColor: Color = .white
    @State private var panelScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                // ── Status Bar ───────────────────────────────────────────
                HStack {
                    connectionBadge
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider().background(Color.white.opacity(0.1))

                currentPositionStrip

                cuePickerList
                    .animation(.easeInOut(duration: 0.25), value: client.currentCue?.id)

                Spacer()
            }
        }
        .onReceive(timer) { _ in
            if let t = firedAt { elapsedSec = Int(Date().timeIntervalSince(t)) }
        }
    }

    // MARK: - Animation

    private func triggerCueAnimation() {
        firedAt = Date()
        elapsedSec = 0

        let cue = client.currentCue
        // Flash: kurz in Cue-Farbe aufleuchten
        flashColor = cue.map { Color(hex: $0.color) ?? .white } ?? .white
        flashOpacity = 0.3
        withAnimation(.easeOut(duration: 0.65)) {
            flashOpacity = 0
        }

        // Scale-Punch auf das Panel
        withAnimation(.spring(response: 0.15, dampingFraction: 0.5)) {
            panelScale = 1.02
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                panelScale = 1.0
            }
        }
    }

    // MARK: - Subviews

    private var cuePickerList: some View {
        VStack(spacing: 7) {
            if client.previousCue == nil && client.currentCue == nil && client.nextCue == nil {
                noCuePanel
            } else {
                if let cue = client.previousCue {
                    cuePickerRow(cue, state: "Letzter Cue", isCurrent: false, opacity: 0.35)
                }
                if let cue = client.currentCue {
                    cuePickerRow(cue, state: "Aktueller Cue", isCurrent: true, opacity: 1)
                }
                if let cue = client.nextCue {
                    cuePickerRow(cue, state: "Als Nächstes", isCurrent: false, opacity: 0.75)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func cuePickerRow(_ cue: CueModel, state: String, isCurrent: Bool, opacity: Double) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(cue.tc)
                .font(.system(size: isCurrent ? 13 : 11, weight: isCurrent ? .bold : .regular, design: .monospaced))
                .foregroundStyle(isCurrent ? cue.swiftUIColor : .secondary)
                .frame(width: 92, alignment: .leading)

            Circle()
                .fill(cue.swiftUIColor)
                .frame(width: isCurrent ? 11 : 7, height: isCurrent ? 11 : 7)

            VStack(alignment: .leading, spacing: isCurrent ? 6 : 2) {
                Text(cue.title)
                    .font(.custom("Lexend", size: isCurrent ? 27 : 13).weight(.bold))
                    .foregroundStyle(isCurrent ? .white : .secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.65)

                if isCurrent && !cue.message.isEmpty {
                    Text(cue.message)
                        .font(.custom("Lexend", size: 13))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                }

                Text(state.uppercased())
                    .font(.custom("Lexend", size: 8).weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(isCurrent ? cue.swiftUIColor : .secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, isCurrent ? 16 : 12)
        .padding(.vertical, isCurrent ? 18 : 9)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isCurrent ? Color.white.opacity(0.05) : Color.white.opacity(0.015))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isCurrent ? cue.swiftUIColor : Color.clear, lineWidth: 1)
                )
        )
        .opacity(opacity)
    }

    @ViewBuilder
    private func activeCuePanel(_ cue: CueModel) -> some View {
        let cueColor = cue.swiftUIColor
        VStack(alignment: .leading, spacing: 12) {
            // Header row
            HStack(spacing: 8) {
                Circle()
                    .fill(cueColor)
                    .frame(width: 10, height: 10)

                Text("AKTUELLER CUE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)

                Spacer()

                Text("+\(elapsedSec)s")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            // Title
            Text(cue.title)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.6)

            // Running TC + cue TC
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(client.currentTc)
                    .font(.system(size: 18, weight: .light, design: .monospaced))
                    .foregroundStyle(.white)
                Text("→ \(cue.tc)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(cueColor.opacity(0.7))
            }

            // Message
            if !cue.message.isEmpty {
                Text(cue.message)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.top, 2)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(cueColor, lineWidth: 1)
                )
        )
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    private var noCuePanel: some View {
        VStack(spacing: 16) {
            Text(client.currentTc)
                .font(.system(size: 52, weight: .thin, design: .monospaced))
                .foregroundStyle(.white)

            Text("Kein aktiver Cue")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
    }

    private var previousCueStrip: some View {
        Group {
            if let prev = client.previousCue {
                HStack(spacing: 10) {
                    Text("LETZTER CUE")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(.secondary)

                    Circle()
                        .fill(prev.swiftUIColor)
                        .frame(width: 7, height: 7)

                    Text(prev.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .lineLimit(1)

                    Spacer()

                    Text(prev.tc)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.secondary.opacity(0.6))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.02))
            }
        }
    }

    private var currentPositionStrip: some View {
        Group {
            if let position = client.currentPosition {
                let progress = positionProgress(position)
                let remaining = positionRemaining(position)

                VStack(spacing: 7) {
                    HStack(spacing: 10) {
                        Text("POSITION")
                            .font(.custom("Lexend", size: 9).weight(.semibold))
                            .tracking(1.5)
                            .foregroundStyle(.blue)

                        Text(position.name)
                            .font(.custom("Lexend", size: 15).weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)

                        Spacer()

                        Text("noch \(formatRemaining(remaining))")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.blue)
                    }

                    ProgressView(value: progress)
                        .tint(.blue)
                        .scaleEffect(x: 1, y: 1.5, anchor: .center)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.blue.opacity(0.1))
            }
        }
    }

    private func tcSeconds(_ tc: String) -> Double {
        let parts = tc.split(separator: ":").compactMap { Double($0) }
        guard parts.count == 4 else { return 0 }
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25
    }

    private func positionProgress(_ position: ShowPositionModel) -> Double {
        let start = tcSeconds(position.startTc)
        let duration = max(0.001, tcSeconds(position.endTc) - start)
        return min(1, max(0, (tcSeconds(client.currentTc) - start) / duration))
    }

    private func positionRemaining(_ position: ShowPositionModel) -> Int {
        max(0, Int(ceil(tcSeconds(position.endTc) - tcSeconds(client.currentTc))))
    }

    private func formatRemaining(_ seconds: Int) -> String {
        guard seconds >= 60 else { return "\(seconds)s" }
        let minutes = seconds / 60
        let rest = seconds % 60
        return rest == 0 ? "\(minutes)m" : "\(minutes)m \(rest)s"
    }

    private var nextCueStrip: some View {
        Group {
            if let next = client.nextCue {
                let secondsUntil = max(0, Int(ceil(tcSeconds(next.tc) - tcSeconds(client.currentTc))))

                HStack(spacing: 10) {
                    Text("NÄCHSTER CUE")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(.secondary)

                    Circle()
                        .fill(next.swiftUIColor)
                        .frame(width: 7, height: 7)

                    Text(next.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)

                    Spacer()

                    Text("in \(formatRemaining(secondsUntil))")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(next.swiftUIColor)
                        .contentTransition(.numericText())
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.04))
            } else {
                HStack {
                    Text("Kein weiterer Cue")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.02))
            }
        }
    }

    private var connectionBadge: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(badgeColor)
                .frame(width: 7, height: 7)
            Text(badgeLabel)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(badgeColor)
        }
    }

    private var badgeColor: Color {
        switch client.connectionState {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .red
        }
    }

    private var badgeLabel: String {
        switch client.connectionState {
        case .connected: return "Verbunden"
        case .connecting: return "Verbinde…"
        case .disconnected: return "Getrennt"
        }
    }
}

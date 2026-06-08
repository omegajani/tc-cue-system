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

            // ── Cue-Flash Overlay ────────────────────────────────────────
            flashColor
                .ignoresSafeArea()
                .opacity(flashOpacity)
                .allowsHitTesting(false)

            VStack(spacing: 0) {
                // ── Status Bar ───────────────────────────────────────────
                HStack {
                    connectionBadge
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider().background(Color.white.opacity(0.1))

                // ── Previous Cue Strip ───────────────────────────────────
                previousCueStrip

                // ── Main Cue Panel ───────────────────────────────────────
                Group {
                    if let cue = client.currentCue {
                        activeCuePanel(cue)
                            .id(cue.id)
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal:   .move(edge: .leading).combined(with: .opacity)
                            ))
                    } else {
                        noCuePanel
                            .transition(.opacity)
                    }
                }
                .animation(.spring(response: 0.35, dampingFraction: 0.8), value: client.currentCue?.id)
                .scaleEffect(panelScale)

                Spacer()

                // ── Next Cue Strip ───────────────────────────────────────
                nextCueStrip
            }
        }
        .onReceive(timer) { _ in
            if let t = firedAt { elapsedSec = Int(Date().timeIntervalSince(t)) }
        }
        .onChange(of: client.currentCue?.id) {
            triggerCueAnimation()
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

    private var nextCueStrip: some View {
        Group {
            if let next = client.nextCue {
                let isWarning = client.warningCue?.id == next.id
                let warnColor: Color = isWarning ? .orange : .clear

                HStack(spacing: 10) {
                    Text("NÄCHSTER CUE")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(isWarning ? .orange : .secondary)

                    Circle()
                        .fill(next.swiftUIColor)
                        .frame(width: 7, height: 7)

                    Text(next.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(isWarning ? .white : .white.opacity(0.9))
                        .lineLimit(1)

                    Spacer()

                    if isWarning {
                        Text("in \(client.warningSecondsUntil)s")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.orange)
                            .contentTransition(.numericText())
                    }

                    Text(next.tc)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(isWarning ? .orange.opacity(0.7) : .secondary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(isWarning ? warnColor.opacity(0.08) : Color.white.opacity(0.04))
                .animation(.easeInOut(duration: 0.2), value: isWarning)
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

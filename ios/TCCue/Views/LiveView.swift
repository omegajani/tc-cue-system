import SwiftUI

struct LiveView: View {
    @EnvironmentObject private var client: TCWSClient
    @AppStorage("screenFlashEnabled") private var screenFlashEnabled = true

    @State private var flashOpacity = 0.0
    @State private var triggeredChecklistIds: Set<String> = []
    @State private var expandedChecklistIds: Set<String> = []
    @State private var clock = Date()
    @State private var triggerTimer = Timer.publish(every: 10, on: .main, in: .common).autoconnect()
    @State private var previewCueId: String?
    @State private var previewResetTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            background

            VStack(spacing: 0) {
                statusBar
                positionHeader
                focusStage
                cuePicker
            }
            .padding(.horizontal, 12)

            Color.white
                .opacity(flashOpacity)
                .ignoresSafeArea()
                .allowsHitTesting(false)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            updateTriggeredChecklists()
        }
        .onReceive(triggerTimer) { date in
            clock = date
            updateTriggeredChecklists()
        }
        .onChange(of: client.currentCue?.id) { oldValue, newValue in
            clearPreview()
            updateTriggeredChecklists()
            guard newValue != nil, newValue != oldValue, screenFlashEnabled else { return }
            flashOpacity = 0.85
            withAnimation(.easeOut(duration: 0.5)) {
                flashOpacity = 0
            }
        }
        .onChange(of: client.activeShow) { _, _ in
            updateTriggeredChecklists()
        }
    }

    private var focusStage: some View {
        let cue = previewCue ?? client.currentCue ?? client.nextCue
        let isPreview = previewCue != nil

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(isPreview ? "VORSCHAU" : client.currentCue == nil ? "ALS NÄCHSTES" : "AKTUELLER CUE")
                    .font(.custom("Lexend", size: 9).weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(cue?.swiftUIColor ?? .secondary)
                Spacer()
                Text(cue?.tc ?? "--:--:--:--")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(cue?.swiftUIColor ?? .secondary)
            }

            if let cue {
                if let position = positionForCue(cue) {
                    Text(position.name)
                        .font(.custom("Lexend", size: 10).weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text(cue.title)
                    .font(.custom("Lexend", size: 21).weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                if !cue.message.isEmpty {
                    Text(cue.message)
                        .font(.custom("Lexend", size: 13))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(3)
                }
            } else {
                Text("Keine Cues geladen")
                    .font(.custom("Lexend", size: 18).weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke((cue?.swiftUIColor ?? .white).opacity(isPreview ? 0.8 : 0.42), lineWidth: 1)
        }
        .padding(.bottom, 10)
        .animation(.snappy(duration: 0.25), value: cue?.id)
    }

    private var background: some View {
        LinearGradient(
            colors: [Color(red: 0.08, green: 0.08, blue: 0.1), .black],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var statusBar: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.custom("Lexend", size: 11).weight(.medium))
                .foregroundStyle(statusColor)
            Spacer()
            Text(client.activeShow?.name ?? "Keine Show")
                .font(.custom("Lexend", size: 10).weight(.medium))
                .tracking(0.8)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.vertical, 9)
    }

    private var positionHeader: some View {
        GeometryReader { geometry in
            let progress = client.currentPosition.map(positionProgress) ?? 0

            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(.ultraThinMaterial)

                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [.blue.opacity(0.46), .blue.opacity(0.12)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * progress)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                VStack(spacing: 0) {
                    HStack {
                        Text(client.currentPosition?.name ?? "Keine Position aktiv")
                            .font(.custom("Lexend", size: 14).weight(.semibold))
                            .lineLimit(1)
                        Spacer()
                        if let position = client.currentPosition {
                            Text("noch \(formatDuration(positionRemaining(position)))")
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .foregroundStyle(.blue)
                        }
                    }
                    Spacer()
                    Text(client.currentTc)
                        .font(.system(size: 40, weight: .semibold, design: .monospaced))
                        .monospacedDigit()
                        .minimumScaleFactor(0.58)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                        .contentTransition(.numericText())
                    Spacer()
                }
                .padding(16)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            }
        }
        .frame(height: 138)
        .padding(.bottom, 10)
    }

    @ViewBuilder
    private var activeChecklists: some View {
        let checklists = activeIncompleteChecklists
        if !checklists.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(checklists) { checklist in
                        activeChecklistCard(checklist)
                            .containerRelativeFrame(.horizontal, count: 1, spacing: 10)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .frame(maxHeight: 230)
            .padding(.bottom, 10)
        }
    }

    private func activeChecklistCard(_ checklist: ChecklistModel) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("AUFGABENLISTE")
                        .font(.custom("Lexend", size: 9).weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(.teal)
                    Text(checklist.title)
                        .font(.custom("Lexend", size: 17).weight(.semibold))
                }
                Spacer()
                Button("Alle abhaken") {
                    Task { await client.completeChecklist(checklist.id) }
                }
                .font(.custom("Lexend", size: 10).weight(.semibold))
                .buttonStyle(.bordered)
                .tint(.teal)
            }

            VStack(spacing: 6) {
                ForEach(checklist.items) { item in
                    checklistItemButton(checklist: checklist, item: item)
                }
            }
        }
        .padding(15)
        .background(.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(.teal.opacity(0.42), lineWidth: 1)
        }
    }

    private var cuePicker: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(queueEntries) { entry in
                        switch entry {
                        case .cue(let cue):
                            cueRow(cue)
                                .id(entry.id)
                        case .checklist(let checklist):
                            checklistQueueRow(checklist)
                                .id(entry.id)
                        }
                    }
                }
                .padding(.bottom, 100)
            }
            .scrollIndicators(.hidden)
            .onAppear { scrollTimelineToCurrent(proxy, animated: false) }
            .onChange(of: client.currentCue?.id) { _, _ in
                scrollTimelineToCurrent(proxy, animated: true)
            }
            .onChange(of: client.nextCue?.id) { _, _ in
                if client.currentCue == nil { scrollTimelineToCurrent(proxy, animated: true) }
            }
        }
    }

    private func cueRow(_ cue: CueModel) -> some View {
        let isCurrent = cue.id == client.currentCue?.id
        let isNext = cue.id == client.nextCue?.id
        let isPast = tcSeconds(cue.tc) < tcSeconds(client.currentTc) && !isCurrent
        let position = positionForCue(cue)

        return HStack(alignment: .center, spacing: 11) {
            VStack(alignment: .leading, spacing: 3) {
                Text(isCurrent ? "AKTUELL" : isNext ? "ALS NÄCHSTES" : " ")
                    .font(.custom("Lexend", size: 8).weight(.bold))
                    .tracking(0.7)
                    .foregroundStyle(cue.swiftUIColor)
                    .lineLimit(1)
                Text(cue.tc)
                    .font(.system(size: isCurrent ? 12 : 10, weight: isCurrent ? .bold : .regular, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(isCurrent ? cue.swiftUIColor : .secondary)
            }
            .frame(width: 90, alignment: .leading)

            Circle()
                .fill(cue.swiftUIColor)
                .frame(width: isCurrent ? 11 : 8, height: isCurrent ? 11 : 8)

            VStack(alignment: .leading, spacing: isCurrent ? 6 : 3) {
                if let position {
                    Text(position.name)
                        .font(.custom("Lexend", size: 9).weight(.semibold))
                        .foregroundStyle(isCurrent ? cue.swiftUIColor.opacity(0.9) : .secondary)
                        .lineLimit(1)
                }
                Text(cue.title)
                    .font(.custom("Lexend", size: 14).weight(.semibold))
                    .foregroundStyle(isCurrent ? .white : .white.opacity(0.76))
                    .lineLimit(2)
            }

            Spacer(minLength: 0)

            if isNext {
                Text("in \(formatDuration(secondsUntil(cue.tc)))")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(cue.swiftUIColor)
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isCurrent ? cue.swiftUIColor.opacity(0.75) : .white.opacity(0.08), lineWidth: 1)
        }
        .opacity(isPast ? 0.34 : isNext ? 0.94 : 0.7)
        .contentShape(Rectangle())
        .onTapGesture { showPreview(cue) }
        .onLongPressGesture(minimumDuration: 0.12, pressing: { pressing in
            if pressing { showPreview(cue, autoReset: false) }
            else { schedulePreviewReset(after: 0.5) }
        }, perform: {})
        .animation(.easeInOut(duration: 0.25), value: isCurrent)
    }

    private func checklistQueueRow(_ checklist: ChecklistModel) -> some View {
        let expanded = expandedChecklistIds.contains(checklist.id)

        return VStack(alignment: .leading, spacing: expanded ? 10 : 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if expanded { expandedChecklistIds.remove(checklist.id) }
                    else { expandedChecklistIds.insert(checklist.id) }
                }
            } label: {
                HStack(spacing: 11) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("AUFGABENLISTE")
                            .font(.custom("Lexend", size: 8).weight(.bold))
                            .tracking(0.7)
                            .foregroundStyle(.teal)
                        Text(checklistTriggerLabel(checklist))
                            .font(.custom("Lexend", size: 9).weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    .frame(width: 90, alignment: .leading)

                    Circle()
                        .fill(checklist.isComplete ? .green : .teal)
                        .frame(width: 8, height: 8)

                    Text(checklist.title)
                        .font(.custom("Lexend", size: 13).weight(.semibold))
                        .foregroundStyle(checklist.isComplete ? .green.opacity(0.8) : .teal.opacity(0.86))
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text(checklist.isComplete ? "Erledigt" : "\(checklist.items.count) Punkte")
                        .font(.custom("Lexend", size: 9).weight(.semibold))
                        .foregroundStyle(.secondary)

                    Image(systemName: "chevron.down")
                        .font(.caption2)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)

            if expanded {
                ForEach(checklist.items) { item in
                    checklistItemButton(checklist: checklist, item: item)
                }
            }
        }
        .padding(13)
        .background((checklist.isComplete ? Color.green : .teal).opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke((checklist.isComplete ? Color.green : .teal).opacity(0.2), lineWidth: 1)
        }
    }

    private func checklistItemButton(checklist: ChecklistModel, item: ChecklistItemModel) -> some View {
        Button {
            Task {
                await client.setChecklistItem(
                    checklistId: checklist.id,
                    itemId: item.id,
                    checked: !item.checked
                )
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 19))
                    .foregroundStyle(item.checked ? .green : .teal)
                Text(item.text)
                    .font(.custom("Lexend", size: 12))
                        .foregroundStyle(item.checked ? Color.secondary : Color.white.opacity(0.88))
                    .strikethrough(item.checked)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(.white.opacity(item.checked ? 0.018 : 0.045), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private var activeIncompleteChecklists: [ChecklistModel] {
        (client.activeShow?.checklists ?? []).filter {
            triggeredChecklistIds.contains($0.id) && !$0.isComplete
        }
    }

    private var queueEntries: [LiveQueueEntry] {
        let cues = sortedCues
        let cueEntries = cues.map { LiveQueueEntry.cue($0) }
        let checklistEntries = (client.activeShow?.checklists ?? [])
            .map { LiveQueueEntry.checklist($0) }
        return (cueEntries + checklistEntries).sorted { $0.sortPosition(cues: cues) < $1.sortPosition(cues: cues) }
    }

    private var sortedCues: [CueModel] {
        (client.activeShow?.cues ?? []).sorted { tcSeconds($0.tc) < tcSeconds($1.tc) }
    }

    private func updateTriggeredChecklists() {
        guard let show = client.activeShow else { return }
        let cues = show.cues.sorted { tcSeconds($0.tc) < tcSeconds($1.tc) }
        let firstCue = cues.first
        let currentSeconds = client.currentCue.map { tcSeconds($0.tc) }
        let now = DateFormatter.shortTime.string(from: clock)

        for checklist in show.checklists ?? [] {
            let due: Bool
            switch checklist.trigger.type {
            case "before-first-cue":
                due = client.currentCue == nil || client.currentCue?.id == firstCue?.id
            case "after-cue":
                let triggerCue = cues.first { $0.id == checklist.trigger.cueId }
                due = currentSeconds != nil && currentSeconds! >= tcSeconds(triggerCue?.tc ?? "99:00:00:00")
            case "time":
                due = now >= (checklist.trigger.time ?? "99:99")
            default:
                due = false
            }
            if due { triggeredChecklistIds.insert(checklist.id) }
        }
    }

    private func positionForCue(_ cue: CueModel) -> ShowPositionModel? {
        let seconds = tcSeconds(cue.tc)
        return (client.activeShow?.positions ?? [])
            .filter { seconds >= tcSeconds($0.startTc) && seconds <= tcSeconds($0.endTc) }
            .sorted { tcSeconds($0.startTc) > tcSeconds($1.startTc) }
            .first
    }

    private func checklistTriggerLabel(_ checklist: ChecklistModel) -> String {
        switch checklist.trigger.type {
        case "before-first-cue": return "Vor erstem Cue"
        case "time": return "Um \(checklist.trigger.time ?? "--:--")"
        case "after-cue":
            let cue = sortedCues.first { $0.id == checklist.trigger.cueId }
            return "Nach \(cue?.title ?? "Cue")"
        default: return "Aufgabenliste"
        }
    }

    private func scrollTimelineToCurrent(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let target = currentPickerTarget else { return }
        let action = { proxy.scrollTo(target, anchor: .top) }
        if animated {
            withAnimation(.snappy(duration: 0.45), action)
        } else {
            action()
        }
    }

    private func showPreview(_ cue: CueModel, autoReset: Bool = true) {
        previewResetTask?.cancel()
        withAnimation(.snappy(duration: 0.22)) {
            previewCueId = cue.id
        }
        if autoReset { schedulePreviewReset(after: 2.5) }
    }

    private func schedulePreviewReset(after seconds: Double) {
        previewResetTask?.cancel()
        previewResetTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            clearPreview()
        }
    }

    private func clearPreview() {
        previewResetTask?.cancel()
        previewResetTask = nil
        withAnimation(.snappy(duration: 0.22)) {
            previewCueId = nil
        }
    }

    private var previewCue: CueModel? {
        guard let previewCueId else { return nil }
        return sortedCues.first { $0.id == previewCueId }
    }

    private var currentPickerTarget: String? {
        guard let cue = client.currentCue ?? client.nextCue ?? sortedCues.first else { return nil }
        return "cue-\(cue.id)"
    }

    private var statusColor: Color {
        switch client.connectionState {
        case .connected: .green
        case .connecting: .yellow
        case .disconnected: .red
        }
    }

    private var statusText: String {
        switch client.connectionState {
        case .connected: "Verbunden"
        case .connecting: "Verbinde..."
        case .disconnected: "Getrennt"
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

    private func secondsUntil(_ tc: String) -> Int {
        max(0, Int(ceil(tcSeconds(tc) - tcSeconds(client.currentTc))))
    }

    private func formatDuration(_ seconds: Int) -> String {
        guard seconds >= 60 else { return "\(seconds)s" }
        let rest = seconds % 60
        return rest == 0 ? "\(seconds / 60)m" : "\(seconds / 60)m \(rest)s"
    }
}

private enum LiveQueueEntry: Identifiable {
    case cue(CueModel)
    case checklist(ChecklistModel)

    var id: String {
        switch self {
        case .cue(let cue): "cue-\(cue.id)"
        case .checklist(let checklist): "checklist-\(checklist.id)"
        }
    }

    func sortPosition(cues: [CueModel]) -> Double {
        switch self {
        case .cue(let cue):
            return Self.tcSeconds(cue.tc)
        case .checklist(let checklist):
            switch checklist.trigger.type {
            case "before-first-cue": return -2
            case "time": return -1
            case "after-cue":
                guard let cue = cues.first(where: { $0.id == checklist.trigger.cueId }) else {
                    return .greatestFiniteMagnitude
                }
                return Self.tcSeconds(cue.tc) + 0.0001
            default: return .greatestFiniteMagnitude
            }
        }
    }

    private static func tcSeconds(_ tc: String) -> Double {
        let parts = tc.split(separator: ":").compactMap { Double($0) }
        guard parts.count == 4 else { return 0 }
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25
    }
}

private extension DateFormatter {
    static let shortTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}

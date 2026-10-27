import SwiftUI

struct ItemInspectorView: View {
    let item: CalendarItem
    let repository: any ItemRepository
    let timeFormat: String
    let onEdit: () -> Void
    let onComplete: () -> Void
    let onDelete: () -> Void
    let onShowInCalendar: () -> Void
    let onRefresh: () -> Void
    let onClose: () -> Void

    @State private var linkedItems: [CalendarItem] = []
    @State private var confirmsDelete = false
    @State private var errorMessage: String?

    private var metrics: ProgressMetrics {
        ProgressProjection.metrics(for: item, now: .now, items: linkedItems)
    }

    private var checklist: [ChecklistRow] { item.checklist ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(categoryTypeLabel)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Theme.accent)
                    .lineLimit(1)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 26, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.cancelAction)
                .accessibilityLabel("상세 닫기")
            }
            .padding(.horizontal, 28)
            .frame(height: 57)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.separator).frame(height: 1) }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(item.title)
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.5)
                        .lineLimit(3)
                        .textSelection(.enabled)
                        .padding(.bottom, 5)
                    Spacer().frame(height: 9)

                    if showsCountdownCard {
                        countdownCard
                            .padding(.bottom, 19)
                        sectionDivider
                    }
                    timeInformation
                        .padding(.vertical, 19)
                    sectionDivider
                    if !checklist.isEmpty {
                        checklistSection
                            .padding(.vertical, 19)
                        sectionDivider
                    }
                    if let notes = item.notes, !notes.isEmpty {
                        memoSection(notes)
                            .padding(.vertical, 19)
                        sectionDivider
                    }
                    if let sourceUrl = item.sourceUrl, let url = URL(string: sourceUrl) {
                        Link(destination: url) {
                            Label("연결된 링크 열기", systemImage: "arrow.up.right.square")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Theme.accent)
                        }
                        .padding(.top, 13)
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 10))
                            .foregroundStyle(.red)
                            .padding(.top, 10)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 30)
                .padding(.top, 28)
                .padding(.bottom, 52)
            }
            .scrollIndicators(.automatic)

            Divider()
            HStack(spacing: 8) {
                Button("편집", action: onEdit)
                    .buttonStyle(FormActionButtonStyle())
                if item.completion != nil {
                    Button(item.completion == .completed ? "다시 열기" : "완료", action: onComplete)
                        .buttonStyle(FormActionButtonStyle(primary: true))
                }
                Spacer(minLength: 2)
                Menu {
                    Button("캘린더에서 보기", systemImage: "calendar", action: onShowInCalendar)
                    Divider()
                    Button("삭제", systemImage: "trash", role: .destructive) { confirmsDelete = true }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 30, height: 28)
                        .contentShape(Rectangle())
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .accessibilityLabel("더 보기")
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .frame(minWidth: 280, idealWidth: 420, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.card)
        .overlay(alignment: .leading) { Rectangle().fill(Theme.separator).frame(width: 1) }
        .task(id: item.id) { await reloadLinkedItems() }
        .confirmationDialog("이 항목을 삭제할까요?", isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button("삭제", role: .destructive, action: onDelete)
            Button("취소", role: .cancel) {}
        }
    }

    private var categoryTypeLabel: String {
        let category = item.category?.isEmpty == false ? item.category! : "내 일정"
        return "\(category) · \(typeLabel)"
    }

    private var showsCountdownCard: Bool {
        switch item.kind {
        case .task:
            false
        case .event:
            false
        case .deadline, .window:
            ProgressProjection.targetDate(for: item) != nil
        }
    }

    private var typeLabel: String {
        switch item.kind {
        case .task: "할 일"
        case .event: "일정"
        case .deadline: item.focus == .start ? "시작 목표" : "마감 목표"
        case .window: "진행 기간"
        }
    }

    private var countdownCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(ProgressProjection.compactCountdownLabel(for: item, now: context.date))
                        .font(.system(size: 31, weight: .semibold, design: .rounded).monospacedDigit())
                        .foregroundStyle(ProgressProjection.isCountdownUrgent(for: item, now: context.date) ? Color.red : Theme.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(countdownDescription(now: context.date))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            if let fraction = metrics.elapsedFraction {
                ProgressView(value: fraction)
                    .tint(Theme.accent.opacity(0.72))
                    .scaleEffect(x: 1, y: 0.72, anchor: .center)
                HStack {
                    Text("시간 \(Int((fraction * 100).rounded()))% 경과")
                    Spacer()
                    Text("\(100 - Int((fraction * 100).rounded()))% 남음")
                }
                .font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
            } else {
                Rectangle().fill(Theme.accent.opacity(0.18)).frame(height: 2)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.ribbon, in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(Theme.separator.opacity(0.65), lineWidth: 1))
    }

    private func countdownDescription(now: Date) -> String {
        guard let label = ProgressProjection.countdownReferenceLabel(for: item, now: now) else { return "날짜 미정" }
        return label == "종료 후" ? label : "\(label) 남은 시간"
    }

    private var timeInformation: some View {
        VStack(alignment: .leading, spacing: 3) {
            sectionTitle("시간 정보")
            ForEach(Array(timeRows.enumerated()), id: \.offset) { _, row in
                detailRow(row.0, value: row.1)
            }
        }
    }

    private var timeRows: [(String, String)] {
        switch item.timing {
        case .unscheduled:
            return [("날짜", "미정")]
        case let .date(start, end, zone):
            if let start, start != end {
                return [("시작", formatDateOnly(start, zone: zone)), ("마감", formatDateOnly(end, zone: zone))]
            } else {
                return [("날짜", formatDateOnly(end, zone: zone))]
            }
        case let .time(start, end, zone):
            if item.kind == .deadline && item.focus == .start {
                return [("시작 시각", start.map { Self.formatInstant($0, zone: zone, timeFormat: timeFormat) } ?? "미정")]
            } else {
                var rows: [(String, String)] = []
                if let start { rows.append((item.kind == .event ? "시작 시각" : "시작", Self.formatInstant(start, zone: zone, timeFormat: timeFormat))) }
                if let end { rows.append((item.kind == .event ? "종료 시각" : "마감 시각", Self.formatInstant(end, zone: zone, timeFormat: timeFormat))) }
                if rows.isEmpty { rows.append(("시간", "미정")) }
                return rows
            }
        }
    }

    private var checklistSection: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                sectionTitle(item.kind == .task ? "관련 작업" : "준비 작업")
                Spacer()
                Text("\(metrics.completedTasks) / \(metrics.totalTasks) 완료")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.accent)
            }
            ForEach(checklist) { row in
                let snapshot = TodayProjection.checklistSnapshot(row, in: linkedItems)
                Button { Task { await toggleChecklist(row) } } label: {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: snapshot.completed ? "checkmark.square.fill" : "square")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(snapshot.completed ? Theme.accent : Color.secondary.opacity(0.7))
                            .padding(.top, 1)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(snapshot.title)
                                .font(.system(size: 12))
                                .foregroundStyle(snapshot.completed ? Color.secondary : Color.primary)
                                .strikethrough(snapshot.completed, color: Color.secondary.opacity(0.6))
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if row.linkedTaskId != nil {
                                Image(systemName: "link")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                                    .help("할 일과 완료 상태가 연결됩니다")
                                    .accessibilityLabel("연결된 할 일")
                            }
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 5)
            }
        }
    }

    private func memoSection(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            sectionTitle("메모")
            Text(notes)
                .font(.system(size: 12))
                .foregroundStyle(Theme.primaryText)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.canvas, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.separator, lineWidth: 1))
        }
    }

    private var sectionDivider: some View {
        Rectangle().fill(Theme.separator).frame(height: 1)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.secondaryText)
            .padding(.bottom, 15)
    }

    private func detailRow(_ title: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title).foregroundStyle(Theme.secondaryText)
            Spacer(minLength: 10)
            Text(value)
                .foregroundStyle(Theme.primaryText)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
        .font(.system(size: 12))
        .frame(minHeight: 25)
    }

    private func formatDateOnly(_ value: String, zone: String) -> String {
        guard let date = Self.dateOnly(value, zone: zone) else { return value }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = "M월 d일 (E)"
        return formatter.string(from: date)
    }

    private func toggleChecklist(_ row: ChecklistRow) async {
        do {
            if let taskID = row.linkedTaskId, var linked = linkedItems.first(where: { $0.id == taskID && $0.deletedAt == nil }) {
                linked.completion = linked.completion == .completed ? .pending : .completed
                try ItemValidator.validate(linked)
                try await repository.upsert(linked)
            } else if var rows = item.checklist, let index = rows.firstIndex(where: { $0.id == row.id }) {
                rows[index].completed.toggle()
                var changed = item
                changed.checklist = rows
                try ItemValidator.validate(changed)
                try await repository.upsert(changed)
            }
            await reloadLinkedItems()
            onRefresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reloadLinkedItems() async {
        linkedItems = (try? await repository.listItems()) ?? []
    }

    private static func dateOnly(_ value: String, zone: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: value) else { return nil }
        return formatter.calendar.startOfDay(for: date)
    }

    private static func formatInstant(_ instant: String, zone: String, timeFormat: String) -> String {
        guard let date = ISO8601DateFormatter.todoListDate(from: instant) else { return instant }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = timeFormat == "12h" ? "M월 d일 (E) a h:mm" : "M월 d일 (E) HH:mm"
        return formatter.string(from: date)
    }
}

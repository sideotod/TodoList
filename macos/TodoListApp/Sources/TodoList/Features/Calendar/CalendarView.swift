import SwiftUI

struct CalendarView: View {
    let model: WindowModel
    let repository: any ItemRepository
    @State private var hoveredControl: String?
    @State private var hoveredViewMode: CalendarViewMode?
    @State private var monthNavigationID = 0
    @State private var monthViewportDate: String?
    @State private var itemIndex: CalendarItemIndex?

    private var indexInput: CalendarIndexInput {
        CalendarIndexInput(items: model.visibleItems, categories: model.preferences.taskCategories, layers: model.preferences.calendarVisibility, timeZone: model.preferences.timeZone)
    }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                pageHeading(compact: geometry.size.width < (model.calendarViewMode == .day ? 780 : 620))
                    .padding(.horizontal, pageInset(geometry.size.width))
                    .padding(.top, 31)
                    .padding(.bottom, 23)
                Group {
                    if let itemIndex {
                        switch model.calendarViewMode {
                        case .day:
                            DayCalendarView(model: model, index: itemIndex)
                        case .week:
                            WeekCalendarView(model: model, index: itemIndex)
                        case .month:
                            MonthCalendarView(model: model, index: itemIndex, navigationID: monthNavigationID, viewportDate: $monthViewportDate)
                        case .year:
                            YearCalendarView(model: model, index: itemIndex)
                        }
                    } else {
                        ProgressView().controlSize(.small)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Theme.canvas)
        }
        .onChange(of: model.calendarViewMode) { _, _ in monthViewportDate = nil }
        .task(id: indexInput) {
            let input = indexInput
            let worker = Task.detached(priority: .userInitiated) {
                let options = EditorCategoryOptions.from(items: input.items, configuredCategories: input.categories)
                let colors = Dictionary(uniqueKeysWithValues: options.map { ($0.id, $0.color) })
                let items = input.items.map { item in
                    var displayItem = item
                    let name = item.category?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    let key = name.folding(options: .caseInsensitive, locale: .current)
                    displayItem.categoryColor = colors[key] ?? "teal"
                    return displayItem
                }
                return CalendarItemIndex(items: items, layers: input.layers, timeZone: input.timeZone)
            }
            let index = await withTaskCancellationHandler {
                await worker.value
            } onCancel: {
                worker.cancel()
            }
            guard !Task.isCancelled else { return }
            itemIndex = index
        }
    }

    private func pageHeading(compact: Bool) -> some View {
        let title = VStack(alignment: .leading, spacing: 5) {
            Text(periodTitle)
                .font(.system(size: 34, weight: .semibold))
                .tracking(-1.4)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        return Group {
            if compact {
                VStack(alignment: .leading, spacing: 10) {
                    title
                    calendarControls
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } else {
                HStack(alignment: .bottom, spacing: 18) {
                    title
                    Spacer(minLength: 8)
                    calendarControls
                }
            }
        }
    }

    private var calendarControls: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                Button { moveDate(-1) } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 28, height: 28)
                        .background(hoveredControl == "previous" ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 6))
                }
                .accessibilityLabel("이전 기간")
                .contentShape(Rectangle())
                .onHover { hoveredControl = $0 ? "previous" : nil }
                .animation(.easeOut(duration: 0.12), value: hoveredControl == "previous")
                Button { moveDate(1) } label: {
                    Image(systemName: "chevron.right")
                        .frame(width: 28, height: 28)
                        .background(hoveredControl == "next" ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 6))
                }
                .accessibilityLabel("다음 기간")
                .contentShape(Rectangle())
                .onHover { hoveredControl = $0 ? "next" : nil }
                .animation(.easeOut(duration: 0.12), value: hoveredControl == "next")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.secondaryText)
            Button("오늘") {
                model.selectedDate = TodayProjection.localDate(
                    ISO8601DateFormatter.todoListTimestamp(),
                    zone: model.preferences.timeZone
                ) ?? model.selectedDate
                monthNavigationID += 1
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Theme.secondaryText)
            .padding(.horizontal, 10)
            .frame(minHeight: 28)
            .background(hoveredControl == "today" ? Theme.rowHover : Theme.card, in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.separator, lineWidth: 1))
            .buttonStyle(.plain)
            .onHover { hoveredControl = $0 ? "today" : nil }
            .animation(.easeOut(duration: 0.12), value: hoveredControl == "today")
            HStack(spacing: 3) {
                ForEach(CalendarViewMode.allCases) { mode in
                    Button {
                        model.calendarViewMode = mode
                    } label: {
                        Text(modeTitle(mode))
                            .font(.system(size: 11, weight: model.calendarViewMode == mode ? .semibold : .regular))
                            .foregroundStyle(model.calendarViewMode == mode ? Theme.primaryText : Theme.secondaryText)
                            .frame(width: 36, height: 28)
                            .background(
                                model.calendarViewMode == mode ? Theme.card : hoveredViewMode == mode ? Theme.rowHover : .clear,
                                in: RoundedRectangle(cornerRadius: 6)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(model.calendarViewMode == mode ? .isSelected : [])
                    .onHover { hoveredViewMode = $0 ? mode : nil }
                    .animation(.easeOut(duration: 0.12), value: hoveredViewMode == mode)
                }
            }
            .padding(3)
            .background(Theme.ribbon, in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var periodTitle: String {
        let displayDate = model.calendarViewMode == .month ? monthViewportDate ?? model.selectedDate : model.selectedDate
        guard let date = TodayProjection.parseDate(displayDate, timeZone: model.preferences.timeZone) else { return displayDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        switch model.calendarViewMode {
        case .day: formatter.dateFormat = "yyyy년 M월 d일 EEEE"
        case .week: formatter.dateFormat = "yyyy년 M월"
        case .month: formatter.dateFormat = "yyyy년 M월"
        case .year: formatter.dateFormat = "yyyy년"
        }
        return formatter.string(from: date)
    }

    private func modeTitle(_ mode: CalendarViewMode) -> String {
        switch mode {
        case .day: "일"
        case .week: "주"
        case .month: "월"
        case .year: "년"
        }
    }

    private func pageInset(_ width: CGFloat) -> CGFloat {
        min(64, max(30, width * 0.05))
    }

    private func moveDate(_ amount: Int) {
        let anchor = model.calendarViewMode == .month ? monthViewportDate ?? model.selectedDate : model.selectedDate
        let target = CalendarProjection.move(
            anchor,
            mode: model.calendarViewMode,
            by: amount,
            timeZone: model.preferences.timeZone
        )
        model.selectedDate = model.calendarViewMode == .month
            ? MonthCalendarScroll.selection(model.selectedDate, inMonthOf: target, timeZone: model.preferences.timeZone)
            : target
        monthNavigationID += 1
    }

}

private struct CalendarIndexInput: Equatable, Sendable {
    let items: [CalendarItem]
    let categories: [TaskCategoryPreference]
    let layers: CalendarLayerPreferences
    let timeZone: String
}

struct CalendarItemButton: View {
    let item: CalendarItem
    let compact: Bool
    let action: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    var timeFormat = "24h"
    @State private var isHovered = false
    @State private var confirmsDelete = false

    private var color: Color {
        Theme.categoryColor(item.categoryColor ?? "teal")
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 5) {
                RoundedRectangle(cornerRadius: 1).fill(color).frame(width: 3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: compact ? 9 : 11, weight: .medium))
                        .lineLimit(compact ? 1 : 2)
                        .multilineTextAlignment(.leading)
                    if !compact, let label = timeLabel {
                        Text(label).font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, compact ? 2 : 5)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: compact ? 18 : 28, alignment: .leading)
            .background(color.opacity(isHovered ? 0.15 : 0.09), in: RoundedRectangle(cornerRadius: 4))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(item.title)
        .contextMenu {
            Button("편집", systemImage: "pencil", action: onEdit)
            Button("삭제", systemImage: "trash", role: .destructive) { confirmsDelete = true }
        }
        .confirmationDialog("이 항목을 삭제할까요?", isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button("삭제", role: .destructive, action: onDelete)
            Button("취소", role: .cancel) {}
        }
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) { isHovered = hovering }
        }
    }

    private var timeLabel: String? {
        guard case let .time(startAt, endAt, zone) = item.timing else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = timeFormat == "12h" ? "a h:mm" : "HH:mm"
        let start = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
        let end = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
        if let start, let end { return "\(start)–\(end)" }
        return start ?? end
    }
}

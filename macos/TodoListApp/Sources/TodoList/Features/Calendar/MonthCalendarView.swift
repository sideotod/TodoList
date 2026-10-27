import SwiftUI
import OSLog

struct MonthCalendarView: View {
    let model: WindowModel
    let index: CalendarItemIndex
    let navigationID: Int
    @Binding var viewportDate: String?
    @State private var weeks: [MonthCalendarWeek] = []
    @State private var topWeek: String?
    @State private var displayedMonth = ""
    @State private var restoringWeek: String?
    private static let logger = Logger(subsystem: "com.sideotod.TodoList", category: "MonthScroll")

    var body: some View {
        GeometryReader { geometry in
            let todayDate = TodayView.currentDate(timeZone: model.preferences.timeZone)
            let cellHeight = max(76, (geometry.size.height - 44) / 6)
            let visibleWeeks = Double(max(1, geometry.size.height - 44) / cellHeight)
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(weekdayLabels, id: \.self) { label in
                        Text(label)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, minHeight: 32)
                    }
                }
                ScrollView(.vertical) {
                    LazyVStack(spacing: 0) {
                        ForEach(weeks) { week in
                            MonthCalendarWeekRow(
                                model: model,
                                index: index,
                                week: week,
                                displayedMonth: displayedMonth,
                                cellHeight: cellHeight,
                                todayDate: todayDate
                            )
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollPosition(id: $topWeek, anchor: .top)
                .scrollTargetBehavior(.viewAligned)
                .scrollIndicators(.automatic)
                .accessibilityLabel("월간 캘린더")
                .overlay(alignment: .top) { Rectangle().fill(Theme.separator).frame(height: 1) }
                .onAppear { navigate(rebuild: true) }
                .onChange(of: model.selectedDate) { _, _ in
                    navigate()
                }
                .onChange(of: navigationID) { _, _ in navigate() }
                .onChange(of: model.preferences.timeZone) { _, _ in navigate(rebuild: true) }
                .task(id: restoringWeek) {
                    guard let week = restoringWeek else { return }
                    // A prepend preserves NSScrollView's offset, not the date at that offset.
                    // Reapply the stable week identity after the new targets are installed.
                    await Task.yield()
                    guard !Task.isCancelled else { return }
                    topWeek = week
                    restoringWeek = nil
                }
                .onChange(of: topWeek) { _, week in
                    guard let week, restoringWeek == nil else { return }
                    updateVisibleMonth(topWeek: week, visibleWeeks: visibleWeeks)
                    extendWeeks(near: week)
                }
            }
            .padding(.horizontal, 15)
            .padding(.bottom, 12)
        }
    }

    private func navigate(rebuild: Bool = false) {
        restoringWeek = nil
        let zone = model.preferences.timeZone
        let target = MonthCalendarScroll.firstWeek(of: model.selectedDate, timeZone: zone, weekStartsOn: model.calendarWeekStartsOn)
        if rebuild || !weeks.contains(where: { $0.id == target }) {
            weeks = MonthCalendarScroll.initialWeeks(around: model.selectedDate, timeZone: zone, weekStartsOn: model.calendarWeekStartsOn)
        }
        displayedMonth = String(model.selectedDate.prefix(7))
        viewportDate = model.selectedDate
        topWeek = target
    }

    private func updateVisibleMonth(topWeek: String, visibleWeeks: Double) {
        let date = MonthCalendarScroll.viewportDate(topWeek: topWeek, visibleWeeks: visibleWeeks, timeZone: model.preferences.timeZone)
        let month = String(date.prefix(7))
        guard displayedMonth != month else { return }
        displayedMonth = month
        viewportDate = date
    }

    private func extendWeeks(near week: String) {
        guard let index = weeks.firstIndex(where: { $0.id == week }),
              let first = weeks.first?.id, let last = weeks.last?.id else { return }
        let zone = model.preferences.timeZone
        if index < 12 {
            Self.logger.debug("Extending earlier: \(weeks.count, privacy: .public) weeks, anchor index \(index, privacy: .public)")
            let start = CalendarProjection.move(first, mode: .week, by: -52, timeZone: zone)
            restoringWeek = week
            weeks.insert(contentsOf: MonthCalendarScroll.weeks(starting: start, count: 52, timeZone: zone), at: 0)
            topWeek = nil
        } else if index >= weeks.count - 12 {
            Self.logger.debug("Extending later: \(weeks.count, privacy: .public) weeks, anchor index \(index, privacy: .public)")
            let start = CalendarProjection.move(last, mode: .week, by: 1, timeZone: zone)
            weeks.append(contentsOf: MonthCalendarScroll.weeks(starting: start, count: 52, timeZone: zone))
        }
    }

    private var weekdayLabels: [String] {
        let labels = ["일", "월", "화", "수", "목", "금", "토"]
        return model.calendarWeekStartsOn == 0 ? labels : Array(labels[1...]) + [labels[0]]
    }
}

private struct MonthCalendarWeekRow: View {
    let model: WindowModel
    let index: CalendarItemIndex
    let week: MonthCalendarWeek
    let displayedMonth: String
    let cellHeight: CGFloat
    let todayDate: String
    @State private var layout = MonthWeekLayout()

    private var projectionInput: MonthWeekInput {
        let taskOrders = Dictionary(uniqueKeysWithValues: week.dates.compactMap { date in
            model.preferences.taskOrders[date].map { (date, $0) }
        })
        return MonthWeekInput(
            dates: week.dates,
            displayedMonth: displayedMonth,
            weekStartsOn: model.calendarWeekStartsOn,
            timeZone: model.preferences.timeZone,
            taskOrders: taskOrders,
            indexID: index.id
        )
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(week.dates.enumerated()), id: \.element) { column, date in
                monthCell(date, column: column)
                    .frame(maxWidth: .infinity)
                    .frame(height: cellHeight, alignment: .topLeading)
            }
        }
        .overlay(alignment: .topLeading) {
            GeometryReader { geometry in
                let columnWidth = geometry.size.width / CGFloat(max(1, week.dates.count))
                let capacity = itemCapacity
                ForEach(layout.segments.filter { $0.lane < capacity }) { segment in
                    let length = segment.lastColumn - segment.firstColumn + 1
                    CalendarItemButton(
                        item: segment.item,
                        compact: true,
                        action: { model.selectItem(segment.item.id) },
                        onEdit: { model.requestEdit(segment.item.id) },
                        onDelete: { Task { await model.deleteItem(segment.item.id) } }
                    )
                    .frame(width: max(0, columnWidth * CGFloat(length) - 10), height: 18)
                    .position(x: columnWidth * (CGFloat(segment.firstColumn) + CGFloat(length) / 2), y: 42 + CGFloat(segment.lane) * 21)
                }
            }
        }
        .onAppear { updateProjection(projectionInput) }
        .onChange(of: projectionInput) { _, input in updateProjection(input) }
    }

    private func updateProjection(_ input: MonthWeekInput) {
        let itemsByDate = Dictionary(uniqueKeysWithValues: input.dates.map { date in
            (date, index.visibleItems(
                on: date,
                taskOrder: input.taskOrders[date],
                taskMonth: input.displayedMonth
            ))
        })
        layout = MonthWeekLayout(dates: input.dates, itemsByDate: itemsByDate)
    }

    private var itemCapacity: Int { min(3, max(0, Int((cellHeight - 41) / 21))) }

    private func monthCell(_ date: String, column: Int) -> some View {
        let currentMonth = String(date.prefix(7)) == displayedMonth
        let today = date == todayDate
        let selected = date == model.selectedDate
        let hiddenCount = layout.hiddenCount(on: column, capacity: itemCapacity)

        return ZStack(alignment: .topLeading) {
            Button {
                model.requestCreateItem(kind: .event, context: ItemEditorContext(dateOnly: date, startInstant: nil, timeZone: model.preferences.timeZone, weekStartsOn: model.calendarWeekStartsOn))
            } label: {
                Color.clear.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(date)에 종일 일정 추가")

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Button {
                        model.selectedDate = date
                        model.calendarViewMode = .day
                    } label: {
                        Text(String(Int(date.suffix(2)) ?? 0))
                            .font(.system(size: 11, weight: today || selected ? .semibold : .regular, design: .rounded))
                            .opacity(currentMonth ? 1 : 0.42)
                            .frame(width: 26, height: 26)
                    }
                    .buttonStyle(CalendarDateButtonStyle(selected: selected, today: today))
                    .accessibilityLabel(date)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    Spacer(minLength: 0)
                    if hiddenCount > 0 {
                        Button("+\(hiddenCount)") {
                            model.selectedDate = date
                            model.calendarViewMode = .day
                        }
                        .buttonStyle(.plain)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.accent)
                        .help("이 날의 나머지 항목 보기")
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(selected ? Theme.sageSelection.opacity(0.55) : Theme.canvas)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.separator.opacity(0.75)).frame(width: 0.5) }
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.separator.opacity(0.75)).frame(height: 0.5) }
    }

}

private struct MonthWeekInput: Equatable {
    let dates: [String]
    let displayedMonth: String
    let weekStartsOn: Int
    let timeZone: String
    let taskOrders: [String: TaskOrderPreference]
    let indexID: UUID
}

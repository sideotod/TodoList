import SwiftUI

struct DayCalendarView: View {
    let model: WindowModel
    let index: CalendarItemIndex

    private var visible: [CalendarItem] {
        index.visibleItems(
            on: model.selectedDate,
            taskOrder: model.preferences.taskOrders[model.selectedDate]
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            if !allDayItems.isEmpty {
                VStack(alignment: .leading, spacing: 7) {
                    Text("종일 및 기간").font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                    ScrollView(.horizontal) {
                        HStack(spacing: 7) {
                            ForEach(Array(allDayItems.enumerated()), id: \.offset) { _, item in
                                CalendarItemButton(item: item, compact: false, action: { model.selectItem(item.id) }, onEdit: { model.requestEdit(item.id) }, onDelete: { Task { await model.deleteItem(item.id) } }, timeFormat: model.preferences.timeFormat)
                                    .frame(minWidth: 145, maxWidth: 205, minHeight: 35)
                            }
                        }
                    }
                    .scrollIndicators(.automatic)
                    .frame(height: 52)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                Divider()
            }
            CalendarTimelineColumn(
                date: model.selectedDate,
                items: timedItems,
                startHour: model.preferences.visibleHours.start,
                endHour: model.preferences.visibleHours.end,
                timeZone: model.preferences.timeZone,
                timeFormat: model.preferences.timeFormat,
                onCreate: { hour, minute in createEvent(hour: hour, minute: minute, on: model.selectedDate) },
                onSelect: { model.selectItem($0.id) },
                onEdit: { model.requestEdit($0.id) },
                onDelete: { item in Task { await model.deleteItem(item.id) } }
            )
        }
    }

    private var allDayItems: [CalendarItem] {
        visible.filter { item in
            guard item.kind != .deadline, item.kind != .window else { return true }
            if case .time = item.timing { return false }
            return true
        }
    }

    private var timedItems: [CalendarItem] {
        visible.filter { item in
            guard item.kind != .deadline, item.kind != .window else { return false }
            if case .time = item.timing { return true }
            return false
        }
    }

    private func createEvent(hour: Int, minute: Int, on date: String) {
        guard let instant = CalendarProjection.dateTime(on: date, hour: hour, minute: minute, timeZone: model.preferences.timeZone) else { return }
        model.requestCreateItem(kind: .event, context: ItemEditorContext(
            dateOnly: date,
            startInstant: ISO8601DateFormatter.todoListTimestamp(for: instant),
            timeZone: model.preferences.timeZone,
            weekStartsOn: model.calendarWeekStartsOn
        ))
    }
}

struct CalendarTimelineColumn: View {
    let date: String
    let items: [CalendarItem]
    let startHour: Int
    let endHour: Int
    let timeZone: String
    let timeFormat: String
    let onCreate: (Int, Int) -> Void
    let onSelect: (CalendarItem) -> Void
    let onEdit: (CalendarItem) -> Void
    let onDelete: (CalendarItem) -> Void
    var showsTimeLabels = true
    var scrollsVertically = true

    private let rowHeight: CGFloat = 54

    var body: some View {
        let visibleHours = max(1, endHour - startHour)
        Group {
            if scrollsVertically {
                ScrollView(.vertical) { timelineContent(visibleHours: visibleHours) }
                    .scrollIndicators(.automatic)
                    .accessibilityLabel("일간 시간표")
            } else {
                timelineContent(visibleHours: visibleHours)
            }
        }
    }

    private func timelineContent(visibleHours: Int) -> some View {
        HStack(alignment: .top, spacing: 0) {
            if showsTimeLabels {
                CalendarTimeAxis(startHour: startHour, endHour: endHour, timeFormat: timeFormat)
            }
            timelineGrid(visibleHours: visibleHours)
        }
        .padding(.top, 10)
        .frame(height: CGFloat(visibleHours) * rowHeight + 10, alignment: .topLeading)
    }

    private func timelineGrid(visibleHours: Int) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                VStack(spacing: 0) {
                    ForEach(startHour..<endHour, id: \.self) { hour in
                        Button { onCreate(hour, 0) } label: {
                            Rectangle().fill(Theme.canvas)
                                .overlay(alignment: .top) { Rectangle().fill(Theme.separator).frame(height: 0.7) }
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .frame(height: rowHeight)
                        .accessibilityLabel("\(date) \(hourLabel(hour))에 일정 추가")
                    }
                }
                ForEach(Array(lanes.enumerated()), id: \.offset) { _, lane in
                    let startMinute = minuteOffset(for: lane.start)
                    let duration = max(25, CGFloat(lane.end.timeIntervalSince(lane.start) / 3600) * rowHeight)
                    let laneWidth = geometry.size.width / CGFloat(max(1, lane.laneCount))
                    CalendarItemButton(item: lane.item, compact: false, action: { onSelect(lane.item) }, onEdit: { onEdit(lane.item) }, onDelete: { onDelete(lane.item) }, timeFormat: timeFormat)
                        .frame(width: max(1, laneWidth - 5), height: duration, alignment: .topLeading)
                        .clipped()
                        .offset(x: CGFloat(lane.laneIndex) * laneWidth + 2, y: CGFloat(startMinute) / 60 * rowHeight + 2)
                }
            }
            .frame(width: geometry.size.width, height: CGFloat(visibleHours) * rowHeight, alignment: .topLeading)
            .clipped()
            .overlay(alignment: .trailing) { Rectangle().fill(Theme.separator).frame(width: 0.5) }
        }
        .frame(height: CGFloat(visibleHours) * rowHeight)
    }

    private var lanes: [CalendarLane] {
        CalendarProjection.overlapLanes(for: items, on: date, timeZone: timeZone, startHour: startHour, endHour: endHour)
    }

    private func minuteOffset(for date: Date) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        let hour = calendar.component(.hour, from: date)
        let minute = calendar.component(.minute, from: date)
        return (hour - startHour) * 60 + minute
    }

    private func hourLabel(_ hour: Int) -> String {
        if timeFormat == "12h" {
            return hour == 0 || hour == 12 ? (hour == 0 ? "오전 12시" : "오후 12시") : (hour < 12 ? "오전 \(hour)시" : "오후 \(hour - 12)시")
        }
        return String(format: "%02d:00", hour)
    }
}

private struct CalendarTimeAxis: View {
    let startHour: Int
    let endHour: Int
    let timeFormat: String

    var body: some View {
        VStack(spacing: 0) {
            ForEach(startHour..<endHour, id: \.self) { hour in
                Text(label(hour))
                    .font(.system(size: 10, design: .rounded).monospacedDigit())
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.trailing, 9)
                    .padding(.top, 2)
                    .frame(width: 56, height: 54, alignment: .topTrailing)
            }
        }
    }

    private func label(_ hour: Int) -> String {
        if timeFormat == "12h" {
            return "\(hour < 12 ? "오전" : "오후") \(hour % 12 == 0 ? 12 : hour % 12)시"
        }
        return String(format: "%02d:00", hour)
    }
}

struct WeekCalendarView: View {
    let model: WindowModel
    let index: CalendarItemIndex
    @State private var hoveredDate: String?

    private struct Column: Identifiable {
        let date: String
        let visible: [CalendarItem]
        let allDay: [CalendarItem]
        let timed: [CalendarItem]

        var id: String { date }
    }

    private var dates: [String] {
        CalendarProjection.dates(
            for: .week,
            around: model.selectedDate,
            timeZone: model.preferences.timeZone,
            weekStartsOn: model.calendarWeekStartsOn
        )
    }

    private var columns: [Column] {
        dates.map { date in
            let visible = index.visibleItems(on: date)
            let allDay = visible.filter { item in
                guard item.kind != .deadline, item.kind != .window else { return true }
                if case .time = item.timing { return false }
                return true
            }
            let timed = visible.filter { item in
                guard item.kind != .deadline, item.kind != .window else { return false }
                if case .time = item.timing { return true }
                return false
            }
            return Column(date: date, visible: visible, allDay: allDay, timed: timed)
        }
    }

    var body: some View {
        GeometryReader { geometry in
            let columns = self.columns
            let timeAxisWidth: CGFloat = 56
            let headerHeight: CGFloat = 47
            let allDayAreaHeight: CGFloat = columns.contains { !$0.allDay.isEmpty } ? 76 : 0
            let minimumColumnWidth: CGFloat = 88
            let columnWidth = max(minimumColumnWidth, (geometry.size.width - timeAxisWidth) / CGFloat(max(1, columns.count)))
            let contentWidth = timeAxisWidth + columnWidth * CGFloat(columns.count)
            let visibleHours = max(1, model.preferences.visibleHours.end - model.preferences.visibleHours.start)
            let timelineViewportHeight = max(100, geometry.size.height - headerHeight - allDayAreaHeight - 2)
            let allDayLayout = MonthWeekLayout(
                dates: columns.map(\.date),
                itemsByDate: Dictionary(uniqueKeysWithValues: columns.map { ($0.date, $0.allDay) })
            )
            let allDayCapacity = allDayLayout.segments.contains { $0.lane >= 3 } ? 2 : 3

            ScrollView(.horizontal) {
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        Color.clear.frame(width: timeAxisWidth, height: headerHeight)
                        ForEach(columns) { column in
                            dayHeader(column, width: columnWidth)
                        }
                    }
                    Divider()
                    if allDayAreaHeight > 0 {
                        ZStack(alignment: .topLeading) {
                            HStack(spacing: 0) {
                                Color.clear.frame(width: timeAxisWidth, height: allDayAreaHeight)
                                ForEach(Array(columns.enumerated()), id: \.element.id) { position, column in
                                    allDayCell(column, width: columnWidth, height: allDayAreaHeight, hiddenCount: allDayLayout.hiddenCount(on: position, capacity: allDayCapacity))
                                }
                            }
                            ForEach(allDayLayout.segments.filter { $0.lane < allDayCapacity }) { segment in
                                let length = segment.lastColumn - segment.firstColumn + 1
                                CalendarItemButton(
                                    item: segment.item,
                                    compact: true,
                                    action: { model.selectItem(segment.item.id) },
                                    onEdit: { model.requestEdit(segment.item.id) },
                                    onDelete: { Task { await model.deleteItem(segment.item.id) } }
                                )
                                .frame(width: max(0, columnWidth * CGFloat(length) - 8), height: 19)
                                .position(x: timeAxisWidth + columnWidth * (CGFloat(segment.firstColumn) + CGFloat(length) / 2), y: 13.5 + CGFloat(segment.lane) * 22)
                            }
                        }
                        .frame(width: contentWidth, height: allDayAreaHeight, alignment: .topLeading)
                        Divider()
                    }
                    ScrollView(.vertical) {
                        HStack(alignment: .top, spacing: 0) {
                            CalendarTimeAxis(
                                startHour: model.preferences.visibleHours.start, endHour: model.preferences.visibleHours.end,
                                timeFormat: model.preferences.timeFormat
                            )
                            .padding(.top, 10)
                            ForEach(columns) { column in
                                CalendarTimelineColumn(
                                    date: column.date,
                                    items: column.timed,
                                    startHour: model.preferences.visibleHours.start,
                                    endHour: model.preferences.visibleHours.end,
                                    timeZone: model.preferences.timeZone,
                                    timeFormat: model.preferences.timeFormat,
                                    onCreate: { hour, minute in createEvent(date: column.date, hour: hour, minute: minute) },
                                    onSelect: { model.selectItem($0.id) },
                                    onEdit: { model.requestEdit($0.id) },
                                    onDelete: { item in Task { await model.deleteItem(item.id) } },
                                    showsTimeLabels: false,
                                    scrollsVertically: false
                                )
                                .frame(width: columnWidth)
                            }
                        }
                        .frame(width: contentWidth, height: CGFloat(visibleHours) * 54 + 10, alignment: .topLeading)
                    }
                    .frame(height: timelineViewportHeight)
                    .scrollIndicators(.automatic)
                }
                .frame(width: contentWidth, alignment: .leading)
            }
            .scrollIndicators(geometry.size.width < timeAxisWidth + minimumColumnWidth * CGFloat(columns.count) ? .automatic : .hidden)
        }
    }

    private func dayHeader(_ column: Column, width: CGFloat) -> some View {
        let parsed = TodayProjection.parseDate(column.date, timeZone: model.preferences.timeZone) ?? Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "E d"

        return Button {
            model.selectedDate = column.date
            model.calendarViewMode = .day
        } label: {
            VStack(spacing: 3) {
                Text(formatter.string(from: parsed)).font(.system(size: 12, weight: column.date == model.selectedDate ? .semibold : .regular))
            }
            .foregroundStyle(column.date == model.selectedDate ? Theme.accent : .primary)
            .frame(width: width, height: 47)
            .background(column.date == model.selectedDate ? Theme.sageSelection : hoveredDate == column.date ? Theme.rowHover : Theme.canvas)
        }
        .buttonStyle(.plain)
        .onHover { hoveredDate = $0 ? column.date : nil }
    }

    private func allDayCell(_ column: Column, width: CGFloat, height: CGFloat, hiddenCount: Int) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            if hiddenCount > 0 {
                Button("+\(hiddenCount) 더 보기") {
                    model.selectedDate = column.date
                    model.calendarViewMode = .day
                }
                .font(.system(size: 10))
                .buttonStyle(.plain)
                .foregroundStyle(Theme.accent)
            }
        }
        .padding(4)
        .frame(width: width, height: height, alignment: .topLeading)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.separator).frame(width: 0.7) }
    }

    private func createEvent(date: String, hour: Int, minute: Int) {
        guard let instant = CalendarProjection.dateTime(on: date, hour: hour, minute: minute, timeZone: model.preferences.timeZone) else { return }
        model.requestCreateItem(kind: .event, context: ItemEditorContext(dateOnly: date, startInstant: ISO8601DateFormatter.todoListTimestamp(for: instant), timeZone: model.preferences.timeZone, weekStartsOn: model.calendarWeekStartsOn))
    }

    private func hourLabel(_ hour: Int) -> String {
        if model.preferences.timeFormat == "12h" {
            return hour == 0 || hour == 12 ? (hour == 0 ? "오전 12시" : "오후 12시") : (hour < 12 ? "오전 \(hour)시" : "오후 \(hour - 12)시")
        }
        return String(format: "%02d:00", hour)
    }
}

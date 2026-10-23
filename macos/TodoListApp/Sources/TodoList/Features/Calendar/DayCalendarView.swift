import SwiftUI

struct DayCalendarView: View {
    let model: AppModel
    let items: [CalendarItem]

    private var visible: [CalendarItem] {
        CalendarProjection.visibleItems(
            on: model.selectedDate,
            items: items,
            layers: model.preferences.calendarVisibility,
            timeZone: model.preferences.timeZone,
            taskOrder: model.preferences.taskOrders[model.selectedDate]
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            if !allDayItems.isEmpty {
                VStack(alignment: .leading, spacing: 7) {
                    Text("종일 및 기간").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
                    ScrollView(.horizontal) {
                        HStack(spacing: 7) {
                            ForEach(allDayItems) { item in
                                CalendarItemButton(item: item, compact: false) { model.selectItem(item.id) }
                                    .frame(minWidth: 145, maxWidth: 205, minHeight: 35)
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
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
                onSelect: { model.selectItem($0.id) }
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
            timeZone: model.preferences.timeZone
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

    private let rowHeight: CGFloat = 54

    var body: some View {
        let visibleHours = max(1, endHour - startHour)
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                ForEach(startHour..<endHour, id: \.self) { hour in
                    Text(hourLabel(hour))
                        .font(.system(size: 10, design: .rounded).monospacedDigit())
                        .foregroundStyle(.secondary)
                        .frame(width: 56, height: rowHeight, alignment: .topTrailing)
                        .padding(.trailing, 9)
                        .padding(.top, 2)
                }
            }
            ScrollView {
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
                        ForEach(lanes, id: \.id) { lane in
                            let startMinute = minuteOffset(for: lane.start)
                            let duration = max(25, CGFloat(lane.end.timeIntervalSince(lane.start) / 3600) * rowHeight)
                            let laneWidth = geometry.size.width / CGFloat(max(1, lane.laneCount))
                            CalendarItemButton(item: lane.item, compact: false) { onSelect(lane.item) }
                                .frame(width: max(74, laneWidth - 5), height: duration, alignment: .topLeading)
                                .clipped()
                                .offset(x: CGFloat(lane.laneIndex) * laneWidth + 2, y: CGFloat(startMinute) / 60 * rowHeight + 2)
                        }
                    }
                    .frame(width: geometry.size.width, height: CGFloat(visibleHours) * rowHeight, alignment: .topLeading)
                }
                .frame(height: CGFloat(visibleHours) * rowHeight)
            }
            .scrollIndicators(.visible)
        }
        .padding(.top, 10)
    }

    private var lanes: [CalendarLane] {
        CalendarProjection.overlapLanes(for: items, on: date, timeZone: timeZone)
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

struct WeekCalendarView: View {
    let model: AppModel
    let items: [CalendarItem]

    private var dates: [String] {
        CalendarProjection.dates(
            for: .week,
            around: model.selectedDate,
            timeZone: model.preferences.timeZone,
            weekStartsOn: model.preferences.weekStartsOn
        )
    }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(dates, id: \.self) { date in
                    dayColumn(date)
                        .frame(minWidth: 132, idealWidth: 158, maxWidth: .infinity)
                }
            }
        }
        .scrollIndicators(.visible)
    }

    private func dayColumn(_ date: String) -> some View {
        let visible = CalendarProjection.visibleItems(on: date, items: items, layers: model.preferences.calendarVisibility, timeZone: model.preferences.timeZone)
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
        let parsed = TodayProjection.parseDate(date, timeZone: model.preferences.timeZone) ?? Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "E d"

        return VStack(spacing: 0) {
            Button {
                model.selectedDate = date
                model.calendarViewMode = .day
            } label: {
                VStack(spacing: 3) {
                    Text(formatter.string(from: parsed)).font(.system(size: 12, weight: date == model.selectedDate ? .semibold : .regular))
                    Text("\(visible.count)개").font(.system(size: 9)).foregroundStyle(.secondary)
                }
                .foregroundStyle(date == model.selectedDate ? Theme.accent : .primary)
                .frame(maxWidth: .infinity, minHeight: 47)
                .background(date == model.selectedDate ? Theme.sageSelection : Theme.canvas)
            }
            .buttonStyle(.plain)
            Divider()
            if !allDay.isEmpty {
                VStack(spacing: 3) {
                    ForEach(allDay.prefix(3)) { item in
                        CalendarItemButton(item: item, compact: true) { model.selectItem(item.id) }.frame(height: 19)
                    }
                    if allDay.count > 3 {
                        Button("+\(allDay.count - 3) 더 보기") { model.selectedDate = date; model.calendarViewMode = .day }
                            .font(.system(size: 9)).buttonStyle(.plain).foregroundStyle(Theme.accent)
                    }
                }
                .padding(4)
                .frame(maxWidth: .infinity, minHeight: 62, alignment: .topLeading)
            } else {
                Text("종일 일정 없음").font(.system(size: 8)).foregroundStyle(.tertiary).frame(maxWidth: .infinity, minHeight: 62)
            }
            Divider()
            CalendarTimelineColumn(
                date: date,
                items: timed,
                startHour: model.preferences.visibleHours.start,
                endHour: model.preferences.visibleHours.end,
                timeZone: model.preferences.timeZone,
                timeFormat: model.preferences.timeFormat,
                onCreate: { hour, minute in createEvent(date: date, hour: hour, minute: minute) },
                onSelect: { model.selectItem($0.id) }
            )
        }
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.separator).frame(width: 0.7) }
    }

    private func createEvent(date: String, hour: Int, minute: Int) {
        guard let instant = CalendarProjection.dateTime(on: date, hour: hour, minute: minute, timeZone: model.preferences.timeZone) else { return }
        model.requestCreateItem(kind: .event, context: ItemEditorContext(dateOnly: date, startInstant: ISO8601DateFormatter.todoListTimestamp(for: instant), timeZone: model.preferences.timeZone))
    }
}

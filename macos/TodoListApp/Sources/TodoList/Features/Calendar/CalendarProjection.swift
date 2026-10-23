import Foundation

struct CalendarLane: Identifiable, Equatable {
    var item: CalendarItem
    var laneIndex: Int
    var laneCount: Int
    var start: Date
    var end: Date

    var id: String { item.id }
}

enum CalendarProjection {
    static func visibleItems(
        on date: String,
        items: [CalendarItem],
        layers: CalendarLayerPreferences,
        timeZone: String,
        taskOrder: TaskOrderPreference? = nil
    ) -> [CalendarItem] {
        var result: [CalendarItem] = []
        if layers.events {
            result += TodayProjection.events(on: date, items: items)
        }
        if layers.tasks {
            result += TodayProjection.tasks(
                on: date,
                items: items.filter { $0.kind == .task && !isUnscheduled($0) },
                order: taskOrder,
                completedVisible: true,
                categoryFilter: nil
            )
        }
        if layers.progress {
            result += items.filter { item in
                guard (item.kind == .deadline || item.kind == .window), item.deletedAt == nil else { return false }
                return importantDates(for: item, timeZone: timeZone).contains(date)
            }
        }
        return result.sorted {
            let left = sortKey($0, timeZone: timeZone)
            let right = sortKey($1, timeZone: timeZone)
            if left == right { return $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            return left < right
        }
    }

    static func overlapLanes(for items: [CalendarItem]) -> [CalendarLane] {
        let timed = items.compactMap { item -> (CalendarItem, Date, Date)? in
            guard case let .time(startAt, endAt, _) = item.timing,
                  let startAt,
                  let start = ISO8601DateFormatter.todoListDate(from: startAt) else { return nil }
            let end = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:)) ?? start.addingTimeInterval(30 * 60)
            guard end > start else { return nil }
            return (item, start, end)
        }
        .sorted { $0.1 == $1.1 ? $0.2 < $1.2 : $0.1 < $1.1 }

        var output: [CalendarLane] = []
        var cluster: [(item: CalendarItem, start: Date, end: Date, lane: Int)] = []
        var clusterEnd = Date.distantPast

        func appendCluster() {
            guard !cluster.isEmpty else { return }
            let count = (cluster.map(\.lane).max() ?? 0) + 1
            output += cluster.map { CalendarLane(item: $0.item, laneIndex: $0.lane, laneCount: count, start: $0.start, end: $0.end) }
            cluster.removeAll(keepingCapacity: true)
            clusterEnd = .distantPast
        }

        for (item, start, end) in timed {
            if start >= clusterEnd { appendCluster() }
            let occupied = cluster.filter { $0.end > start }.map(\.lane)
            var lane = 0
            while occupied.contains(lane) { lane += 1 }
            cluster.append((item, start, end, lane))
            clusterEnd = max(clusterEnd, end)
        }
        appendCluster()
        return output
    }

    static func overlapLanes(for items: [CalendarItem], on date: String, timeZone: String) -> [CalendarLane] {
        guard let dayStart = TodayProjection.parseDate(date, timeZone: timeZone) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        guard let nextDay = calendar.date(byAdding: .day, value: 1, to: dayStart) else { return [] }

        let clipped = items.compactMap { item -> CalendarItem? in
            guard case let .time(startAt, endAt, zone) = item.timing else { return nil }
            let suppliedStart = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            let suppliedEnd = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            let start = suppliedStart ?? suppliedEnd?.addingTimeInterval(-30 * 60)
            guard let start else { return nil }
            let end = suppliedEnd ?? start.addingTimeInterval(30 * 60)
            let clippedStart = max(start, dayStart)
            let clippedEnd = min(end, nextDay)
            guard clippedEnd > clippedStart else { return nil }
            var copy = item
            copy.timing = .time(
                startAt: ISO8601DateFormatter.todoListTimestamp(for: clippedStart),
                endAt: ISO8601DateFormatter.todoListTimestamp(for: clippedEnd),
                timeZone: zone
            )
            return copy
        }
        return overlapLanes(for: clipped)
    }

    static func dates(for mode: CalendarViewMode, around date: String, timeZone: String, weekStartsOn: Int = 1) -> [String] {
        guard let parsed = TodayProjection.parseDate(date, timeZone: timeZone) else { return [date] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        calendar.firstWeekday = weekStartsOn == 0 ? 1 : 2
        let start: Date
        let count: Int
        switch mode {
        case .day:
            start = calendar.startOfDay(for: parsed)
            count = 1
        case .week:
            let weekday = calendar.component(.weekday, from: parsed)
            let offset = (weekday - calendar.firstWeekday + 7) % 7
            start = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: parsed)) ?? parsed
            count = 7
        case .month:
            return TodayProjection.monthGrid(around: date, weekStartsOn: weekStartsOn, timeZone: timeZone)
        case .year:
            start = calendar.date(from: calendar.dateComponents([.year], from: parsed)) ?? parsed
            count = 12
        }
        return (0..<count).compactMap { index in
            let component: Calendar.Component = mode == .year ? .month : .day
            guard let target = calendar.date(byAdding: component, value: index, to: start) else { return nil }
            return dateString(target, timeZone: timeZone)
        }
    }

    static func move(_ date: String, mode: CalendarViewMode, by amount: Int, timeZone: String) -> String {
        guard let parsed = TodayProjection.parseDate(date, timeZone: timeZone) else { return date }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        let component: Calendar.Component = switch mode {
        case .day: .day
        case .week: .weekOfYear
        case .month: .month
        case .year: .year
        }
        guard let moved = calendar.date(byAdding: component, value: amount, to: parsed) else { return date }
        return dateString(moved, timeZone: timeZone)
    }

    static func monthTitle(for date: String, timeZone: String) -> String {
        TodayProjection.monthTitle(around: date, timeZone: timeZone)
    }

    static func dateString(_ date: Date, timeZone: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func dateTime(on date: String, hour: Int, minute: Int, timeZone: String) -> Date? {
        guard let base = TodayProjection.parseDate(date, timeZone: timeZone) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: base, matchingPolicy: .nextTime)
    }

    private static func isUnscheduled(_ item: CalendarItem) -> Bool {
        if case .unscheduled = item.timing { return true }
        return false
    }

    private static func importantDates(for item: CalendarItem, timeZone: String) -> [String] {
        switch item.timing {
        case .unscheduled:
            return []
        case let .date(startDate, endDate, _):
            if item.kind == .window {
                return Array(Set([startDate, endDate].compactMap { $0 })).sorted()
            }
            let target = item.focus == .start ? startDate ?? endDate : endDate
            return [target]
        case let .time(startAt, endAt, zone):
            let start = startAt.flatMap { TodayProjection.localDate($0, zone: zone) }
            let end = endAt.flatMap { TodayProjection.localDate($0, zone: zone) }
            if item.kind == .window {
                return Array(Set([start, end].compactMap { $0 })).sorted()
            }
            let target = item.focus == .start ? start ?? end : end ?? start
            return target.map { [$0] } ?? []
        }
    }

    private static func sortKey(_ item: CalendarItem, timeZone: String) -> String {
        switch item.timing {
        case .unscheduled: "9999-99-99"
        case let .date(startDate, endDate, _): startDate ?? endDate
        case let .time(startAt, endAt, zone): startAt ?? endAt ?? "9999-99-99" + timeZone + zone
        }
    }
}

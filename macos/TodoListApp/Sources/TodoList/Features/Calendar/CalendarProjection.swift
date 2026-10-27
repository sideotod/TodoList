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
        taskOrder: TaskOrderPreference? = nil,
        taskMonth: String? = nil
    ) -> [CalendarItem] {
        var result: [CalendarItem] = []
        if layers.events {
            result += TodayProjection.events(on: date, items: items)
        }
        if layers.tasks && (taskMonth == nil || String(date.prefix(7)) == taskMonth) {
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
                if item.kind == .window, let range = eventDateRange(item) {
                    return date >= range.start && date <= range.end
                }
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

    static func visibleItemDates(
        in dates: [String],
        items: [CalendarItem],
        layers: CalendarLayerPreferences,
        timeZone: String
    ) -> Set<String> {
        let requestedDates = Set(dates)
        guard !requestedDates.isEmpty else { return [] }

        var visibleDates = Set<String>()
        var recurringEvents: [CalendarItem] = []
        for item in items where item.deletedAt == nil {
            switch item.kind {
            case .event:
                guard layers.events else { continue }
                if item.recurrence != nil {
                    recurringEvents.append(item)
                } else if let range = eventDateRange(item) {
                    for date in dates where date >= range.start && date <= range.end {
                        visibleDates.insert(date)
                    }
                }
            case .task:
                guard layers.tasks else { continue }
                let date: String?
                switch item.timing {
                case let .date(_, dueDate, _): date = dueDate
                case let .time(_, dueAt, zone): date = dueAt.flatMap { TodayProjection.localDate($0, zone: zone) }
                case .unscheduled: date = nil
                }
                if let date, requestedDates.contains(date) { visibleDates.insert(date) }
            case .window:
                guard layers.progress, let range = eventDateRange(item) else { continue }
                for date in dates where date >= range.start && date <= range.end {
                    visibleDates.insert(date)
                }
            case .deadline:
                guard layers.progress else { continue }
                for date in importantDates(for: item, timeZone: timeZone) where requestedDates.contains(date) {
                    visibleDates.insert(date)
                }
            }
        }
        if !recurringEvents.isEmpty {
            let index = CalendarItemIndex(items: recurringEvents, layers: CalendarLayerPreferences(tasks: false, events: true, progress: false), timeZone: timeZone)
            visibleDates.formUnion(index.visibleDates(in: dates.filter { !visibleDates.contains($0) }))
        }
        return visibleDates
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

    static func overlapLanes(for items: [CalendarItem], on date: String, timeZone: String, startHour: Int = 0, endHour: Int = 24) -> [CalendarLane] {
        guard let dayStart = TodayProjection.parseDate(date, timeZone: timeZone) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        guard let nextDay = calendar.date(byAdding: .day, value: 1, to: dayStart) else { return [] }
        guard let visibleStart = calendar.date(bySettingHour: startHour, minute: 0, second: 0, of: dayStart),
              let visibleEnd = endHour == 24 ? nextDay : calendar.date(bySettingHour: endHour, minute: 0, second: 0, of: dayStart),
              visibleEnd > visibleStart else { return [] }

        let clipped = items.compactMap { item -> (CalendarItem, CalendarItem)? in
            guard case let .time(startAt, endAt, zone) = item.timing else { return nil }
            let suppliedStart = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            let suppliedEnd = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            let start = suppliedStart ?? suppliedEnd?.addingTimeInterval(-30 * 60)
            guard let start else { return nil }
            let end = suppliedEnd ?? start.addingTimeInterval(30 * 60)
            let clippedStart = max(start, visibleStart)
            let clippedEnd = min(end, visibleEnd)
            guard clippedEnd > clippedStart else { return nil }
            var copy = item
            copy.timing = .time(
                startAt: ISO8601DateFormatter.todoListTimestamp(for: clippedStart),
                endAt: ISO8601DateFormatter.todoListTimestamp(for: clippedEnd),
                timeZone: zone
            )
            return (copy, item)
        }
        return overlapLanes(for: clipped.map(\.0)).map { lane in
            var result = lane
            // Clipping changes layout only; labels and actions retain the original timing.
            if let original = clipped.first(where: { $0.0.id == lane.item.id && $0.0.timing == lane.item.timing })?.1 { result.item = original }
            return result
        }
    }

    static func dates(for mode: CalendarViewMode, around date: String, timeZone: String, weekStartsOn: Int = 0) -> [String] {
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
        TodayProjection.dateString(date, timeZone: timeZone)
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

    static func eventDateRange(_ item: CalendarItem) -> (start: String, end: String)? {
        switch item.timing {
        case .unscheduled:
            return nil
        case let .date(startDate, endDate, _):
            return (startDate ?? endDate, endDate)
        case let .time(startAt, endAt, zone):
            guard let startAt, let startDate = TodayProjection.localDate(startAt, zone: zone) else { return nil }
            guard let endAt else { return (startDate, startDate) }
            guard let end = ISO8601DateFormatter.todoListDate(from: endAt) else { return (startDate, startDate) }
            let lastIncluded = end.addingTimeInterval(-0.001)
            let endDate = TodayProjection.localDate(ISO8601DateFormatter.todoListTimestamp(for: lastIncluded), zone: zone) ?? startDate
            return (startDate, endDate)
        }
    }

    static func importantDates(for item: CalendarItem, timeZone: String) -> [String] {
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

    static func sortKey(_ item: CalendarItem, timeZone: String) -> String {
        switch item.timing {
        case .unscheduled: "9999-99-99"
        case let .date(startDate, endDate, _): startDate ?? endDate
        case let .time(startAt, endAt, zone): startAt ?? endAt ?? "9999-99-99" + timeZone + zone
        }
    }
}

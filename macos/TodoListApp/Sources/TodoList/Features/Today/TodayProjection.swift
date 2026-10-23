import Foundation

struct ChecklistSnapshot: Equatable {
    var title: String
    var completed: Bool
}

enum TodayProjection {
    static func nearby(items: [CalendarItem], now: Date, timeZone: String, limit: Int = 4) -> [CalendarItem] {
        guard limit > 0 else { return [] }
        return items.compactMap { item -> (CalendarItem, Date)? in
            guard item.deletedAt == nil else { return nil }
            if item.kind == .event {
                guard item.countdown?.enabled == true else { return nil }
            } else {
                guard item.completion == .pending else { return nil }
            }
            guard let target = targetDate(for: item, fallbackTimeZone: timeZone, now: now) else { return nil }
            return (item, target)
        }
        .sorted {
            let lhs = abs($0.1.timeIntervalSince(now))
            let rhs = abs($1.1.timeIntervalSince(now))
            return lhs == rhs ? $0.0.title.localizedStandardCompare($1.0.title) == .orderedAscending : lhs < rhs
        }
        .prefix(limit)
        .map(\.0)
    }

    static func tasks(
        on date: String,
        items: [CalendarItem],
        order: TaskOrderPreference?,
        completedVisible: Bool,
        categoryFilter: String?
    ) -> [CalendarItem] {
        let matches = items.filter { item in
            guard item.kind == .task, item.deletedAt == nil else { return false }
            if let categoryFilter, item.category != categoryFilter { return false }
            if !completedVisible && item.completion == .completed { return false }
            switch item.timing {
            case let .date(_, dueDate, _): return dueDate == date
            case let .time(_, dueAt, zone): return dueAt.map { localDate($0, zone: zone) == date } ?? false
            case .unscheduled: return true
            }
        }
        let orderedIDs = (order?.pending ?? []) + (order?.completed ?? [])
        let positions = Dictionary(uniqueKeysWithValues: orderedIDs.enumerated().map { ($0.element, $0.offset) })
        return matches.sorted { first, second in
            if let firstPosition = positions[first.id], let secondPosition = positions[second.id], firstPosition != secondPosition {
                return firstPosition < secondPosition
            }
            if positions[first.id] != nil { return true }
            if positions[second.id] != nil { return false }
            if first.completion != second.completion { return first.completion == .pending }
            return first.title.localizedStandardCompare(second.title) == .orderedAscending
        }
    }

    static func events(on date: String, items: [CalendarItem]) -> [CalendarItem] {
        items.compactMap { item in
            guard item.kind == .event, item.deletedAt == nil else { return nil }
            if item.recurrence != nil { return WeeklyRecurrence.occurrence(of: item, on: date) }
            return occurs(item, on: date) ? item : nil
        }
        .sorted { eventStart($0) < eventStart($1) }
    }

    static func checklistSnapshot(_ row: ChecklistRow, in items: [CalendarItem]) -> ChecklistSnapshot {
        if let linkedTaskID = row.linkedTaskId,
           let task = items.first(where: { $0.id == linkedTaskID && $0.kind == .task && $0.deletedAt == nil }) {
            return ChecklistSnapshot(title: task.title, completed: task.completion == .completed)
        }
        return ChecklistSnapshot(title: row.title, completed: row.completed)
    }

    static func monthGrid(around date: String, weekStartsOn: Int, timeZone: String) -> [String] {
        guard let current = parseDate(date, timeZone: timeZone) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        calendar.firstWeekday = weekStartsOn == 0 ? 1 : 2
        let month = calendar.dateInterval(of: .month, for: current)?.start ?? current
        let weekday = calendar.component(.weekday, from: month)
        let leading = (weekday - calendar.firstWeekday + 7) % 7
        guard let firstCell = calendar.date(byAdding: .day, value: -leading, to: month) else { return [] }
        return (0..<42).compactMap { offset in
            guard let cell = calendar.date(byAdding: .day, value: offset, to: firstCell) else { return nil }
            return dateString(cell, timeZone: timeZone)
        }
    }

    static func monthTitle(around date: String, timeZone: String) -> String {
        guard let current = parseDate(date, timeZone: timeZone) else { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy년 M월"
        return formatter.string(from: current)
    }

    static func moveMonth(_ date: String, by amount: Int, timeZone: String) -> String {
        guard let current = parseDate(date, timeZone: timeZone) else { return date }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        guard let moved = calendar.date(byAdding: .month, value: amount, to: current) else { return date }
        return dateString(moved, timeZone: timeZone)
    }

    static func localDate(_ instant: String, zone: String) -> String? {
        guard let date = ISO8601DateFormatter.todoListDate(from: instant) else { return nil }
        return dateString(date, timeZone: zone)
    }

    static func parseDate(_ value: String, timeZone: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: value), formatter.string(from: date) == value else { return nil }
        return date
    }

    private static func dateString(_ date: Date, timeZone: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func targetDate(for item: CalendarItem, fallbackTimeZone: String, now: Date) -> Date? {
        switch item.kind {
        case .task:
            return nil
        case .event:
            guard let countdown = item.countdown else { return nil }
            switch item.timing {
            case let .date(startDate, endDate, zone):
                let target = countdown.reference == .start ? startDate : endDate
                return target.flatMap { startOfDay($0, zone: zone) }
            case let .time(startAt, endAt, _):
                return countdown.reference == .start
                    ? startAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
                    : endAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            case .unscheduled:
                return nil
            }
        case .deadline:
            switch item.timing {
            case let .date(startDate, endDate, zone):
                let target = item.focus == .start ? startDate ?? endDate : endDate
                return startOfDay(target, zone: zone)
            case let .time(startAt, endAt, _):
                let target = item.focus == .start ? startAt ?? endAt : endAt ?? startAt
                return target.flatMap(ISO8601DateFormatter.todoListDate(from:))
            case .unscheduled: return nil
            }
        case .window:
            switch item.timing {
            case let .date(startDate, endDate, zone):
                return closestMilestone(
                    start: startOfDay(startDate, zone: zone),
                    end: startOfDay(endDate, zone: zone),
                    now: now
                )
            case let .time(startAt, endAt, _):
                return closestMilestone(
                    start: startAt.flatMap(ISO8601DateFormatter.todoListDate(from:)),
                    end: endAt.flatMap(ISO8601DateFormatter.todoListDate(from:)),
                    now: now
                )
            case .unscheduled: return nil
            }
        }
    }

    private static func closestMilestone(start: Date?, end: Date?, now: Date) -> Date? {
        let milestones = [start, end].compactMap { $0 }
        return milestones.filter { $0 >= now }.min()
            ?? milestones.max()
    }

    private static func startOfDay(_ value: String?, zone: String) -> Date? {
        guard let value, let date = parseDate(value, timeZone: zone) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone) ?? .current
        return calendar.startOfDay(for: date)
    }

    private static func occurs(_ item: CalendarItem, on date: String) -> Bool {
        switch item.timing {
        case .unscheduled:
            return false
        case let .date(startDate, endDate, _):
            return date >= (startDate ?? endDate) && date <= endDate
        case let .time(startAt, endAt, zone):
            guard let startAt, let startDate = localDate(startAt, zone: zone) else { return false }
            guard let endAt, let end = ISO8601DateFormatter.todoListDate(from: endAt) else { return date == startDate }
            let lastIncluded = end.addingTimeInterval(-0.001)
            guard let endDate = localDate(ISO8601DateFormatter.todoListTimestamp(for: lastIncluded), zone: zone) else { return date == startDate }
            return date >= startDate && date <= endDate
        }
    }

    private static func eventStart(_ item: CalendarItem) -> String {
        switch item.timing {
        case .unscheduled: return ""
        case let .date(startDate, endDate, _): return startDate ?? endDate
        case let .time(startAt, endAt, _): return startAt ?? endAt ?? ""
        }
    }
}

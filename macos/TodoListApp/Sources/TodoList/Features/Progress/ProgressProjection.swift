import Foundation

struct ProgressMetrics: Equatable {
    var countdownLabel: String
    var elapsedFraction: Double?
    var completedTasks: Int
    var totalTasks: Int
}

enum ProgressProjection {
    static func countdownReferenceLabel(for item: CalendarItem, now: Date) -> String? {
        guard let target = targetDate(for: item, now: now) else { return nil }
        let passed: Bool
        if case let .date(_, _, zone) = item.timing {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: zone) ?? .current
            passed = target < calendar.startOfDay(for: now)
        } else {
            passed = target <= now
        }
        if passed { return "종료 후" }
        switch item.kind {
        case .window: return isWaitingForStart(item, now: now) ? "시작까지" : "종료까지"
        case .deadline: return item.focus == .start ? "시작까지" : "종료까지"
        case .event: return item.countdown?.reference == .start ? "시작까지" : "종료까지"
        case .task: return nil
        }
    }

    static func compactCountdownLabel(for item: CalendarItem, now: Date) -> String {
        guard case .time = item.timing,
              let target = targetDate(for: item, now: now) else {
            return countdownLabel(target: targetDate(for: item, now: now), timing: item.timing, now: now)
        }
        let remaining = target.timeIntervalSince(now)
        guard remaining > 0, remaining <= 86_400 else {
            return countdownLabel(target: target, timing: item.timing, now: now)
        }
        if remaining > 3_600 {
            let minutes = Int(remaining / 60)
            return String(format: "%02d:%02d", minutes / 60, minutes % 60)
        }
        let seconds = min(3_600, max(1, Int(ceil(remaining))))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    static func isCountdownUrgent(for item: CalendarItem, now: Date) -> Bool {
        guard item.completion != .completed, let target = targetDate(for: item, now: now) else { return false }
        switch item.timing {
        case let .date(_, _, zone):
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: zone) ?? .current
            let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: target)).day ?? -1
            return (0...1).contains(days)
        case .time:
            let remaining = target.timeIntervalSince(now)
            return remaining > 0 && remaining <= 86_400
        case .unscheduled:
            return false
        }
    }

    static func isWaitingForStart(_ item: CalendarItem, now: Date) -> Bool {
        guard item.kind == .window else { return false }
        switch item.timing {
        case let .date(start, _, zone):
            return start.flatMap { TodayProjection.parseDate($0, timeZone: zone) }.map { now < $0 } ?? false
        case let .time(start, _, _):
            return start.flatMap(ISO8601DateFormatter.todoListDate(from:)).map { now < $0 } ?? false
        case .unscheduled:
            return false
        }
    }

    static func targetDate(for item: CalendarItem, now: Date = .now) -> Date? {
        switch item.kind {
        case .deadline:
            switch item.timing {
            case let .date(startDate, endDate, zone):
                let target = item.focus == .start ? startDate ?? endDate : endDate
                return TodayProjection.parseDate(target, timeZone: zone)
            case let .time(startAt, endAt, _):
                let target = item.focus == .start ? startAt ?? endAt : endAt ?? startAt
                return target.flatMap(ISO8601DateFormatter.todoListDate(from:))
            case .unscheduled: return nil
            }
        case .window:
            switch item.timing {
            case let .date(startDate, endDate, zone):
                let target = isWaitingForStart(item, now: now) ? startDate ?? endDate : endDate
                return TodayProjection.parseDate(target, timeZone: zone)
            case let .time(startAt, endAt, _):
                let target = isWaitingForStart(item, now: now) ? startAt : endAt
                return target.flatMap(ISO8601DateFormatter.todoListDate(from:))
            case .unscheduled: return nil
            }
        case .event:
            guard let countdown = item.countdown else { return nil }
            switch item.timing {
            case let .date(startDate, endDate, zone):
                return TodayProjection.parseDate(countdown.reference == .start ? startDate ?? endDate : endDate, timeZone: zone)
            case let .time(startAt, endAt, _):
                return (countdown.reference == .start ? startAt : endAt).flatMap(ISO8601DateFormatter.todoListDate(from:))
            case .unscheduled: return nil
            }
        case .task:
            return nil
        }
    }

    static func metrics(for item: CalendarItem, now: Date, items: [CalendarItem]) -> ProgressMetrics {
        let target = targetDate(for: item, now: now)
        return ProgressMetrics(
            countdownLabel: countdownLabel(target: target, timing: item.timing, now: now),
            elapsedFraction: elapsedFraction(item.timing, now: now),
            completedTasks: checklistCounts(item: item, items: items).completed,
            totalTasks: checklistCounts(item: item, items: items).total
        )
    }

    static func cards(from items: [CalendarItem]) -> [CalendarItem] {
        items.filter { item in
            guard item.deletedAt == nil else { return false }
            if item.kind == .event { return item.showInProgressSummary == true }
            return item.kind == .deadline || item.kind == .window
        }
    }

    static func checklistCounts(item: CalendarItem, items: [CalendarItem]) -> (completed: Int, total: Int) {
        guard let checklist = item.checklist else { return (0, 0) }
        let completed = checklist.reduce(into: 0) { count, row in
            if TodayProjection.checklistSnapshot(row, in: items).completed { count += 1 }
        }
        return (completed, checklist.count)
    }

    private static func countdownLabel(target: Date?, timing: ItemTiming, now: Date) -> String {
        guard let target else { return "날짜 미정" }
        let remaining = target.timeIntervalSince(now)
        if case let .date(_, _, zone) = timing,
           let today = TodayProjection.parseDate(TodayProjection.localDate(ISO8601DateFormatter.todoListTimestamp(for: now), zone: zone) ?? "", timeZone: zone) {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: zone) ?? .current
            let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: today), to: calendar.startOfDay(for: target)).day ?? 0
            return days == 0 ? "D-Day" : days > 0 ? "D-\(days)" : "D+0"
        }
        if remaining <= 0 {
            return "D+0"
        }
        if remaining >= 86_400 { return "D-\(Int(ceil(remaining / 86_400)))" }
        let seconds = Int(remaining)
        let hours = seconds / 3_600
        let minutes = seconds % 3_600 / 60
        let remainder = seconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, remainder)
    }

    static func elapsedFraction(_ timing: ItemTiming, now: Date) -> Double? {
        let start: Date?
        let end: Date?
        switch timing {
        case .unscheduled:
            return nil
        case let .date(startDate, endDate, zone):
            guard let startDate,
                  let startDay = TodayProjection.parseDate(startDate, timeZone: zone),
                  let endDay = TodayProjection.parseDate(endDate, timeZone: zone) else { return nil }
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: zone) ?? .current
            start = calendar.startOfDay(for: startDay)
            guard let dayAfterEnd = calendar.date(byAdding: .day, value: 1, to: endDay) else { return nil }
            end = calendar.startOfDay(for: dayAfterEnd)
        case let .time(startAt, endAt, _):
            start = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
            end = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
        }
        guard let start, let end, end > start, now >= start, now < end else { return nil }
        return min(1, max(0, now.timeIntervalSince(start) / end.timeIntervalSince(start)))
    }
}

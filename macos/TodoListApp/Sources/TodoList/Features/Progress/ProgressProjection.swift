import Foundation

struct ProgressMetrics: Equatable {
    var countdownLabel: String
    var elapsedFraction: Double?
    var completedTasks: Int
    var totalTasks: Int
}

enum ProgressProjection {
    static func compactCountdownLabel(for item: CalendarItem, now: Date) -> String {
        guard case .time = item.timing,
              let target = targetDate(for: item) else {
            return countdownLabel(target: targetDate(for: item), timing: item.timing, now: now)
        }
        let remaining = target.timeIntervalSince(now)
        guard remaining > 0, remaining < 86_400 else {
            return countdownLabel(target: target, timing: item.timing, now: now)
        }
        let hours = Int(remaining / 3_600)
        if hours > 0 { return "\(hours)시간" }
        return "\(max(1, Int(remaining / 60)))분"
    }

    static func targetDate(for item: CalendarItem) -> Date? {
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
            case let .date(_, endDate, zone): return TodayProjection.parseDate(endDate, timeZone: zone)
            case let .time(_, endAt, _): return endAt.flatMap(ISO8601DateFormatter.todoListDate(from:))
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
        let target = targetDate(for: item)
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
            return days == 0 ? "D-Day" : days > 0 ? "D-\(days)" : "D+\(-days)"
        }
        if remaining <= 0 {
            let elapsed = abs(Int(remaining))
            let days = max(1, Int(ceil(Double(elapsed) / 86_400)))
            return "D+\(days)"
        }
        if remaining >= 86_400 { return "D-\(Int(ceil(remaining / 86_400)))" }
        let seconds = Int(remaining)
        let hours = seconds / 3_600
        let minutes = seconds % 3_600 / 60
        let remainder = seconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, remainder)
    }

    private static func elapsedFraction(_ timing: ItemTiming, now: Date) -> Double? {
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

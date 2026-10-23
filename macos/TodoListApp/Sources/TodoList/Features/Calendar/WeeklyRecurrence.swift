import Foundation

extension WeeklyRecurrence {
    static func occurrence(of event: CalendarItem, on date: String) -> CalendarItem? {
        guard event.kind == .event,
              let recurrence = event.recurrence,
              !recurrence.daysOfWeek.isEmpty else { return nil }
        let timeZone: String
        switch event.timing {
        case let .date(startDate, _, zone):
            guard let startDate, date >= startDate else { return nil }
            timeZone = zone
        case let .time(startAt, _, zone):
            guard let startAt, let startDate = TodayProjection.localDate(startAt, zone: zone), date >= startDate else { return nil }
            timeZone = zone
        case .unscheduled:
            return nil
        }
        guard recurrence.untilDate.map({ date <= $0 }) ?? true,
              let target = TodayProjection.parseDate(date, timeZone: timeZone),
              let targetWeekday = weekday(date, timeZone: timeZone),
              recurrence.daysOfWeek.contains(targetWeekday) else { return nil }

        var copy = event
        switch event.timing {
        case let .date(startDate, endDate, zone):
            guard let startDate, let dayOffset = dayDistance(from: startDate, to: date, zone: zone) else { return nil }
            copy.timing = .date(startDate: date, endDate: shiftDate(endDate, by: dayOffset, zone: zone), timeZone: zone)
        case let .time(startAt, endAt, zone):
            guard let startAt,
                  let originalStart = ISO8601DateFormatter.todoListDate(from: startAt),
                  let shiftedStart = shiftInstant(originalStart, to: target, zone: zone) else { return nil }
            let shiftedEnd: String?
            if let endAt, let originalEnd = ISO8601DateFormatter.todoListDate(from: endAt) {
                let originalEndDate = TodayProjection.localDate(endAt, zone: zone) ?? date
                let originalStartDate = TodayProjection.localDate(startAt, zone: zone) ?? date
                let endDayOffset = dayDistance(from: originalStartDate, to: originalEndDate, zone: zone) ?? 0
                guard let endDate = Calendar.dateByAddingDays(endDayOffset, to: target, zone: zone),
                      let endInstant = shiftInstant(originalEnd, to: endDate, zone: zone) else { return nil }
                shiftedEnd = ISO8601DateFormatter.todoListTimestamp(for: endInstant)
            } else {
                shiftedEnd = nil
            }
            copy.timing = .time(startAt: ISO8601DateFormatter.todoListTimestamp(for: shiftedStart), endAt: shiftedEnd, timeZone: zone)
        case .unscheduled:
            return nil
        }
        return copy
    }

    private static func weekday(_ value: String, timeZone: String) -> Int? {
        guard let date = TodayProjection.parseDate(value, timeZone: timeZone) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        return calendar.component(.weekday, from: date) - 1
    }

    private static func dayDistance(from start: String, to target: String, zone: String) -> Int? {
        guard let startDate = TodayProjection.parseDate(start, timeZone: zone),
              let targetDate = TodayProjection.parseDate(target, timeZone: zone) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone) ?? .current
        return calendar.dateComponents([.day], from: startDate, to: targetDate).day
    }

    private static func shiftDate(_ value: String, by days: Int, zone: String) -> String {
        guard let parsed = TodayProjection.parseDate(value, timeZone: zone),
              let moved = Calendar.dateByAddingDays(days, to: parsed, zone: zone) else { return value }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: moved)
    }

    private static func shiftInstant(_ original: Date, to targetDate: Date, zone: String) -> Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone) ?? .current
        let components = calendar.dateComponents([.hour, .minute, .second], from: original)
        return calendar.date(
            bySettingHour: components.hour ?? 0,
            minute: components.minute ?? 0,
            second: components.second ?? 0,
            of: targetDate,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        )
    }
}

private extension Calendar {
    static func dateByAddingDays(_ days: Int, to date: Date, zone: String) -> Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone) ?? .current
        return calendar.date(byAdding: .day, value: days, to: date)
    }
}

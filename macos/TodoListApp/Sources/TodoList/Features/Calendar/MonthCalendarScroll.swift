import Foundation

struct MonthCalendarWeek: Identifiable, Equatable {
    let dates: [String]
    var id: String { dates[0] }
}

/// Date-only week identities keep adjacent months continuous, including across DST.
enum MonthCalendarScroll {
    static func firstWeek(of date: String, timeZone: String, weekStartsOn: Int) -> String {
        CalendarProjection.dates(for: .month, around: date, timeZone: timeZone, weekStartsOn: weekStartsOn).first ?? date
    }

    static func weeks(starting date: String, count: Int, timeZone: String) -> [MonthCalendarWeek] {
        guard count > 0, let start = TodayProjection.parseDate(date, timeZone: timeZone) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"

        return (0..<count).map { week in
            MonthCalendarWeek(dates: (0..<7).compactMap { day in
                calendar.date(byAdding: .day, value: week * 7 + day, to: start).map(formatter.string(from:))
            })
        }
        .filter { $0.dates.count == 7 }
    }

    static func initialWeeks(around date: String, timeZone: String, weekStartsOn: Int) -> [MonthCalendarWeek] {
        let first = firstWeek(of: date, timeZone: timeZone, weekStartsOn: weekStartsOn)
        let start = CalendarProjection.move(first, mode: .week, by: -52, timeZone: timeZone)
        return weeks(starting: start, count: 105, timeZone: timeZone)
    }

    static func viewportDate(topWeek: String, visibleWeeks: Double, timeZone: String) -> String {
        let centerDay = max(0, Int(visibleWeeks * 7 / 2))
        return CalendarProjection.move(topWeek, mode: .day, by: centerDay, timeZone: timeZone)
    }

    static func selection(_ date: String, inMonthOf visibleDate: String, timeZone: String) -> String {
        guard let source = TodayProjection.parseDate(date, timeZone: timeZone),
              let target = TodayProjection.parseDate(visibleDate, timeZone: timeZone) else { return date }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        guard let sourceMonth = calendar.dateInterval(of: .month, for: source)?.start,
              let targetMonth = calendar.dateInterval(of: .month, for: target)?.start,
              let months = calendar.dateComponents([.month], from: sourceMonth, to: targetMonth).month else { return date }
        return CalendarProjection.move(date, mode: .month, by: months, timeZone: timeZone)
    }
}

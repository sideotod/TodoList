import Foundation

enum EditorCalendarGrid {
    static func dates(in month: Date, weekStartsOn: Int, calendar: Calendar) -> [Date] {
        let components = calendar.dateComponents([.year, .month], from: month)
        guard let firstOfMonth = calendar.date(from: DateComponents(year: components.year, month: components.month, day: 1)) else {
            return []
        }
        let normalizedStart = ((weekStartsOn % 7) + 7) % 7
        let firstWeekday = normalizedStart + 1 // Calendar weekday values start with Sunday == 1.
        let leadingDays = (calendar.component(.weekday, from: firstOfMonth) - firstWeekday + 7) % 7
        guard let gridStart = calendar.date(byAdding: .day, value: -leadingDays, to: firstOfMonth) else { return [] }
        return (0..<42).compactMap { calendar.date(byAdding: .day, value: $0, to: gridStart) }
    }
}

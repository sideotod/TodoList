import Foundation

/// Immutable date lookup built once when items or calendar visibility change.
struct CalendarItemIndex: Sendable {
    let id = UUID()
    private let singleDay: [String: [CalendarItem]]
    private let spans: [EventSpan]
    private let recurring: [RecurringEvent]
    private let timeZone: String

    private struct EventSpan: Sendable {
        let item: CalendarItem
        let start: String
        let end: String
    }

    private struct RecurringEvent: Sendable {
        let item: CalendarItem
        let durationDays: Int
        let timeZone: String

        func occurrences(on date: String) -> [CalendarItem] {
            if durationDays == 0 {
                return WeeklyRecurrence.occurrence(of: item, on: date).map { [$0] } ?? []
            }
            guard let target = TodayProjection.parseDate(date, timeZone: timeZone) else { return [] }
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
            return (0...durationDays).compactMap { offset in
                guard let candidate = calendar.date(byAdding: .day, value: -offset, to: target) else { return nil }
                let start = TodayProjection.dateString(candidate, timeZone: timeZone)
                guard let occurrence = WeeklyRecurrence.occurrence(of: item, on: start),
                      let range = CalendarProjection.eventDateRange(occurrence),
                      date >= range.start, date <= range.end else { return nil }
                return occurrence
            }
        }
    }

    init(items: [CalendarItem], layers: CalendarLayerPreferences, timeZone: String) {
        var singleDay: [String: [CalendarItem]] = [:]
        var spans: [EventSpan] = []
        var recurring: [RecurringEvent] = []
        for item in items where item.deletedAt == nil {
            if Task.isCancelled { break }
            switch item.kind {
            case .task where layers.tasks:
                let date: String?
                switch item.timing {
                case let .date(_, endDate, _): date = endDate
                case let .time(_, endAt, zone): date = endAt.flatMap { TodayProjection.localDate($0, zone: zone) }
                case .unscheduled: date = nil
                }
                if let date { singleDay[date, default: []].append(item) }
            case .event where layers.events:
                if item.recurrence != nil {
                    let zone: String
                    switch item.timing {
                    case let .date(_, _, value), let .time(_, _, value): zone = value
                    case .unscheduled: continue
                    }
                    guard let range = CalendarProjection.eventDateRange(item),
                          let start = TodayProjection.parseDate(range.start, timeZone: zone),
                          let end = TodayProjection.parseDate(range.end, timeZone: zone) else { continue }
                    var calendar = Calendar(identifier: .gregorian)
                    calendar.timeZone = TimeZone(identifier: zone) ?? .current
                    let duration = max(0, calendar.dateComponents([.day], from: start, to: end).day ?? 0)
                    recurring.append(RecurringEvent(item: item, durationDays: duration, timeZone: zone))
                } else if let range = CalendarProjection.eventDateRange(item), range.start <= range.end {
                    if range.start == range.end {
                        singleDay[range.start, default: []].append(item)
                    } else {
                        spans.append(EventSpan(item: item, start: range.start, end: range.end))
                    }
                }
            case .window where layers.progress:
                if let range = CalendarProjection.eventDateRange(item), range.start <= range.end {
                    if range.start == range.end {
                        singleDay[range.start, default: []].append(item)
                    } else {
                        spans.append(EventSpan(item: item, start: range.start, end: range.end))
                    }
                }
            case .deadline:
                guard layers.progress else { continue }
                for date in Set(CalendarProjection.importantDates(for: item, timeZone: timeZone)) {
                    singleDay[date, default: []].append(item)
                }
            default:
                break
            }
        }
        self.singleDay = singleDay
        self.spans = spans
        self.recurring = recurring
        self.timeZone = timeZone
    }

    func visibleItems(on date: String, taskOrder: TaskOrderPreference? = nil, taskMonth: String? = nil) -> [CalendarItem] {
        let matches = singleDay[date] ?? []
        var result = matches.filter { $0.kind != .task }
        if taskMonth == nil || String(date.prefix(7)) == taskMonth {
            result += TodayProjection.tasks(on: date, items: matches, order: taskOrder, completedVisible: true, categoryFilter: nil)
        }
        result += spans.compactMap { date >= $0.start && date <= $0.end ? $0.item : nil }
        result += recurring.flatMap { $0.occurrences(on: date) }
        return result.sorted {
            let left = CalendarProjection.sortKey($0, timeZone: timeZone)
            let right = CalendarProjection.sortKey($1, timeZone: timeZone)
            return left == right ? $0.title.localizedStandardCompare($1.title) == .orderedAscending : left < right
        }
    }

    func visibleDates(in dates: [String], layers: CalendarLayerPreferences = .allVisible) -> Set<String> {
        var result = Set<String>()
        for date in Set(dates) {
            let singleDayVisible = singleDay[date]?.contains { item in
                switch item.kind {
                case .task: layers.tasks
                case .event: layers.events
                case .deadline, .window: layers.progress
                }
            } == true
            if singleDayVisible || spans.contains(where: { span in
                let visible = span.item.kind == .window ? layers.progress : layers.events
                return visible && date >= span.start && date <= span.end
            }) {
                result.insert(date)
            } else if layers.events && recurring.contains(where: { !$0.occurrences(on: date).isEmpty }) {
                result.insert(date)
            }
        }
        return result
    }
}

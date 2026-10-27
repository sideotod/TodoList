import Foundation

enum EditorDateTime {
    static func settingTime(
        on day: Date,
        hour: Int,
        minute: Int,
        second: Int,
        preservingOccurrenceOf referenceDate: Date,
        calendar: Calendar,
        repeatedTimePolicy: Calendar.RepeatedTimePolicy? = nil
    ) -> Date? {
        calendar.date(
            bySettingHour: hour,
            minute: minute,
            second: second,
            of: day,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: repeatedTimePolicy ?? occurrencePolicy(for: referenceDate, calendar: calendar),
            direction: .forward
        )
    }

    static func occurrencePolicy(for date: Date, calendar: Calendar) -> Calendar.RepeatedTimePolicy {
        let time = calendar.dateComponents([.hour, .minute, .second], from: date)
        let matching = DateComponents(hour: time.hour, minute: time.minute, second: time.second)
        let searchStart = calendar.startOfDay(for: date).addingTimeInterval(-1)

        guard
            let first = calendar.nextDate(
                after: searchStart,
                matching: matching,
                matchingPolicy: .strict,
                repeatedTimePolicy: .first,
                direction: .forward
            ),
            let last = calendar.nextDate(
                after: searchStart,
                matching: matching,
                matchingPolicy: .strict,
                repeatedTimePolicy: .last,
                direction: .forward
            ),
            calendar.isDate(first, inSameDayAs: date),
            calendar.isDate(last, inSameDayAs: date),
            abs(first.timeIntervalSince(last)) > 1
        else {
            return .first
        }

        return abs(date.timeIntervalSince(last)) < abs(date.timeIntervalSince(first)) ? .last : .first
    }
}

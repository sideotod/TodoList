import Foundation

/// A deterministic, memory-only workload covering five years of dense planning.
enum StressPreviewFixture {
    static let date = "2026-10-27"

    static let items: [CalendarItem] = {
        let zone = TimeZone(identifier: "Asia/Seoul")!
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let start = calendar.date(from: DateComponents(year: 2024, month: 1, day: 1))!
        let end = calendar.date(from: DateComponents(year: 2029, month: 1, day: 1))!
        let dayCount = calendar.dateComponents([.day], from: start, to: end).day!
        let categories = [("대학원 연구", "sage"), ("학교", "amber"), ("개인", "violet")]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        let referenceDay = startOfReferenceDay(calendar)
        var result: [CalendarItem] = []
        result.reserveCapacity(dayCount * 9 + 400)

        for day in 0..<dayCount {
            guard let dayDate = calendar.date(byAdding: .day, value: day, to: start) else { continue }
            let dateString = formatter.string(from: dayDate)
            for task in 0..<6 {
                let category = categories[(day + task) % categories.count]
                result.append(CalendarItem(
                    id: "stress-task-\(day)-\(task)", kind: .task,
                    title: ["자료 정리", "프로젝트 검토", "메일 처리", "운동", "공부", "다음 일정 준비"][task],
                    category: category.0, categoryColor: category.1,
                    timing: .date(startDate: nil, endDate: dateString, timeZone: zone.identifier),
                    completion: task < 3 && dayDate < referenceDay ? .completed : .pending
                ))
            }
            for event in 0..<3 {
                guard let eventStart = calendar.date(bySettingHour: 9 + event * 3, minute: 0, second: 0, of: dayDate),
                      let eventEnd = calendar.date(byAdding: .minute, value: 75, to: eventStart) else { continue }
                let category = categories[(day + event) % categories.count]
                result.append(CalendarItem(
                    id: "stress-event-\(day)-\(event)", kind: .event,
                    title: ["집중 작업", "정기 미팅", "학습 및 약속"][event],
                    category: category.0, categoryColor: category.1,
                    timing: .time(startAt: ISO8601DateFormatter.todoListTimestamp(for: eventStart), endAt: ISO8601DateFormatter.todoListTimestamp(for: eventEnd), timeZone: zone.identifier)
                ))
            }
        }

        for index in 0..<120 {
            guard let first = calendar.date(byAdding: .day, value: index * 14, to: start),
                  let last = calendar.date(byAdding: .day, value: 3 + index % 12, to: first) else { continue }
            result.append(CalendarItem(
                id: "stress-multiday-\(index)", kind: .event, title: "프로젝트 기간 \(index + 1)",
                category: categories[index % 3].0, categoryColor: categories[index % 3].1,
                timing: .date(startDate: formatter.string(from: first), endDate: formatter.string(from: last), timeZone: zone.identifier)
            ))
        }
        for index in 0..<36 {
            result.append(CalendarItem(
                id: "stress-repeat-\(index)", kind: .event, title: "반복 일정 \(index + 1)",
                category: categories[index % 3].0, categoryColor: categories[index % 3].1,
                timing: .date(startDate: "2024-01-01", endDate: "2024-01-01", timeZone: zone.identifier),
                recurrence: WeeklyRecurrence(daysOfWeek: [index % 7], untilDate: "2028-12-31")
            ))
        }
        for index in 0..<240 {
            guard let due = calendar.date(byAdding: .day, value: index * 7, to: start) else { continue }
            result.append(CalendarItem(
                id: "stress-progress-\(index)", kind: .deadline, title: "마감 목표 \(index + 1)",
                category: categories[index % 3].0, categoryColor: categories[index % 3].1,
                timing: .date(startDate: nil, endDate: formatter.string(from: due), timeZone: zone.identifier),
                completion: .pending
            ))
        }
        return result
    }()

    private static func startOfReferenceDay(_ calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 10, day: 27))!
    }
}

import XCTest
@testable import TodoList

final class ItemValidationTests: XCTestCase {
    func testRejectsInvalidRangeAndKindTiming() {
        let reversedDeadline = CalendarItem(
            id: "deadline-1",
            kind: .deadline,
            title: "마감",
            timing: .time(startAt: "2026-10-04T00:00:00.000Z", endAt: "2026-10-03T00:00:00.000Z", timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: [],
            startCountdown: CountdownSettings(enabled: true, daysBefore: 2)
        )
        XCTAssertThrowsError(try ItemValidator.validate(reversedDeadline))

        let unscheduledEvent = CalendarItem(
            id: "event-1",
            kind: .event,
            title: "잘못된 일정",
            timing: .unscheduled
        )
        XCTAssertThrowsError(try ItemValidator.validate(unscheduledEvent))

        let overlongTask = CalendarItem(
            id: "task-2",
            kind: .task,
            title: String(repeating: "가", count: 201),
            timing: .unscheduled,
            completion: .pending
        )
        XCTAssertThrowsError(try ItemValidator.validate(overlongTask))
    }

    func testRejectsInvalidTimeZoneAndEmptyID() {
        let invalidZoneTask = CalendarItem(
            id: "task-1",
            kind: .task,
            title: "과제",
            timing: .date(startDate: nil, endDate: "2026-10-03", timeZone: "Mars/Phobos"),
            completion: .pending
        )
        XCTAssertThrowsError(try ItemValidator.validate(invalidZoneTask))

        let emptyIdTask = CalendarItem(
            id: "   ",
            kind: .task,
            title: "과제",
            timing: .unscheduled,
            completion: .pending
        )
        XCTAssertThrowsError(try ItemValidator.validate(emptyIdTask))
    }
}

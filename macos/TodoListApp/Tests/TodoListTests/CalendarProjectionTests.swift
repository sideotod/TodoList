import XCTest
@testable import TodoList

final class CalendarProjectionTests: XCTestCase {
    func testWeeklyUntilDateIsInclusive() {
        let event = recurringEvent()

        XCTAssertNotNil(WeeklyRecurrence.occurrence(of: event, on: "2026-11-01"))
        XCTAssertNil(WeeklyRecurrence.occurrence(of: event, on: "2026-11-08"))
    }

    func testTimedOccurrenceResolvesDSTGapAndRepeat() throws {
        let event = CalendarItem(
            id: "dst-event",
            kind: .event,
            title: "DST 반복 수업",
            timing: .time(
                startAt: "2026-03-01T10:30:00.000Z",
                endAt: "2026-03-01T11:30:00.000Z",
                timeZone: "America/Los_Angeles"
            ),
            recurrence: WeeklyRecurrence(daysOfWeek: [0], untilDate: "2026-03-08")
        )

        let occurrence = try XCTUnwrap(WeeklyRecurrence.occurrence(of: event, on: "2026-03-08"))
        guard case let .time(startAt, _, zone) = occurrence.timing,
              let start = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:)) else {
            return XCTFail("Expected a resolved timed occurrence.")
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone)!
        XCTAssertEqual(calendar.component(.hour, from: start), 3)
        XCTAssertEqual(calendar.component(.minute, from: start), 0)
    }

    func testOverlappingEventsUseSeparateLanes() {
        let events = [
            timedEvent("a", start: "2026-10-23T09:00:00.000Z", end: "2026-10-23T10:00:00.000Z"),
            timedEvent("b", start: "2026-10-23T09:30:00.000Z", end: "2026-10-23T10:30:00.000Z"),
            timedEvent("c", start: "2026-10-23T10:30:00.000Z", end: "2026-10-23T11:00:00.000Z")
        ]

        let lanes = CalendarProjection.overlapLanes(for: events, on: "2026-10-23", timeZone: "Asia/Seoul")

        XCTAssertEqual(lanes.count, 3)
        XCTAssertEqual(lanes.first(where: { $0.id == "a" })?.laneCount, 2)
        XCTAssertEqual(lanes.first(where: { $0.id == "b" })?.laneCount, 2)
        XCTAssertEqual(lanes.first(where: { $0.id == "c" })?.laneCount, 1)
        XCTAssertNotEqual(lanes.first(where: { $0.id == "a" })?.laneIndex, lanes.first(where: { $0.id == "b" })?.laneIndex)
    }

    func testAllDayOverflowRemainsSelectable() {
        let items = (0..<6).map { index in
            CalendarItem(
                id: "event-\(index)",
                kind: .event,
                title: "종일 일정 \(index)",
                timing: .date(startDate: "2026-10-23", endDate: "2026-10-23", timeZone: "Asia/Seoul")
            )
        }

        let visible = CalendarProjection.visibleItems(on: "2026-10-23", items: items, layers: .allVisible, timeZone: "Asia/Seoul")

        XCTAssertEqual(visible.count, 6)
        XCTAssertEqual(Set(visible.map(\.id)).count, 6)
    }

    func testMultiDayTimedEventIsClippedToVisibleDay() throws {
        let event = timedEvent("overnight", start: "2026-10-22T23:00:00.000Z", end: "2026-10-23T02:00:00.000Z")

        let lane = try XCTUnwrap(CalendarProjection.overlapLanes(for: [event], on: "2026-10-23", timeZone: "UTC").first)

        XCTAssertEqual(lane.start, ISO8601DateFormatter.todoListDate(from: "2026-10-23T00:00:00.000Z"))
        XCTAssertEqual(lane.end, ISO8601DateFormatter.todoListDate(from: "2026-10-23T02:00:00.000Z"))
    }

    private func recurringEvent() -> CalendarItem {
        CalendarItem(
            id: "weekly",
            kind: .event,
            title: "세미나",
            timing: .date(startDate: "2026-10-18", endDate: "2026-10-18", timeZone: "Asia/Seoul"),
            recurrence: WeeklyRecurrence(daysOfWeek: [0], untilDate: "2026-11-01")
        )
    }

    private func timedEvent(_ id: String, start: String, end: String) -> CalendarItem {
        CalendarItem(
            id: id,
            kind: .event,
            title: id,
            timing: .time(startAt: start, endAt: end, timeZone: "UTC")
        )
    }
}

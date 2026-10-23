import Foundation
import XCTest
@testable import TodoList

final class ItemCodingTests: XCTestCase {
    func testProposalOmitsMissingMetadataAndOptionalNulls() throws {
        let task = CalendarItem(
            id: "task-1",
            kind: .task,
            title: "제출",
            timing: .date(startDate: nil, endDate: "2026-10-03", timeZone: "Asia/Seoul"),
            completion: .pending
        )

        let data = try ItemCoding.encodeProposal(task)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertNil(object["revision"])
        XCTAssertNil(object["updatedAt"])
        XCTAssertNil(object["deletedAt"])
        XCTAssertNil(object["lastMutationId"])
        XCTAssertNil(object["lastMutationDigest"])
        XCTAssertNil(object["category"])
        XCTAssertNil(object["notes"])
        let timing = try XCTUnwrap(object["timing"] as? [String: Any])
        XCTAssertTrue(timing["startDate"] is NSNull)
        XCTAssertEqual(timing["endDate"] as? String, "2026-10-03")
        XCTAssertEqual(try ItemCoding.decode(data), task)
    }

    func testDateOnlySerializationStaysLiteralAcrossTimeZones() throws {
        for zone in ["Asia/Seoul", "America/Los_Angeles"] {
            let task = CalendarItem(
                id: "date-\(zone)",
                kind: .task,
                title: "날짜 보존",
                timing: .date(startDate: nil, endDate: "2026-11-01", timeZone: zone),
                completion: .pending
            )
            let data = try ItemCoding.encodeProposal(task)
            let decoded = try ItemCoding.decode(data)
            XCTAssertEqual(decoded.timing, .date(startDate: nil, endDate: "2026-11-01", timeZone: zone))
        }
    }

    func testCanonicalRoundTripPreservesLinkedChecklistAndRecurrence() throws {
        let event = CalendarItem(
            id: "event-1",
            kind: .event,
            title: "세미나",
            timing: .date(startDate: "2026-10-03", endDate: "2026-10-03", timeZone: "Asia/Seoul"),
            countdown: EventCountdown(enabled: true, daysBefore: 3, reference: .start),
            recurrence: WeeklyRecurrence(daysOfWeek: [1, 3], untilDate: "2026-12-30"),
            revision: 2,
            updatedAt: "2026-10-02T15:00:00.000Z",
            deletedAt: nil,
            lastMutationId: "operation-2",
            lastMutationDigest: String(repeating: "a", count: 64)
        )
        let period = CalendarItem(
            id: "deadline-1",
            kind: .deadline,
            title: "장학금 신청",
            timing: .date(startDate: nil, endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: [ChecklistRow(id: "row-1", title: "서류 준비", completed: false, linkedTaskId: "task-1")],
            startCountdown: nil
        )

        let decodedEvent = try ItemCoding.decode(ItemCoding.encode(event))
        let decodedPeriod = try ItemCoding.decode(ItemCoding.encode(period))
        XCTAssertEqual(decodedEvent, event)
        XCTAssertEqual(decodedEvent.recurrence?.daysOfWeek, [1, 3])
        XCTAssertEqual(decodedEvent.recurrence?.untilDate, "2026-12-30")
        XCTAssertEqual(decodedEvent.countdown?.reference, .start)
        XCTAssertEqual(decodedPeriod.checklist?.first?.linkedTaskId, "task-1")
        XCTAssertEqual(decodedPeriod.timing, .date(startDate: nil, endDate: "2026-10-30", timeZone: "Asia/Seoul"))
    }
}

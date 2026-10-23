import XCTest
@testable import TodoList

final class TodayProjectionTests: XCTestCase {
    func testNearbyReturnsFourNearestStartsAndDeadlines() {
        let values = [
            period("today", kind: .deadline, end: "2026-10-23"),
            period("tomorrow", kind: .deadline, end: "2026-10-24"),
            period("two-days", kind: .window, start: "2026-10-25", end: "2026-10-30"),
            period("three-days", kind: .deadline, end: "2026-10-26"),
            period("four-days", kind: .deadline, end: "2026-10-27")
        ]
        let now = ISO8601DateFormatter.todoListDate(from: "2026-10-23T00:00:00Z")!

        let nearby = TodayProjection.nearby(items: values, now: now, timeZone: "Asia/Seoul")

        XCTAssertEqual(nearby.map(\.id), ["today", "tomorrow", "two-days", "three-days"])
    }

    func testCategoryFilterKeepsSelectedDateTasks() {
        let values = [
            task("research", category: "연구", date: "2026-10-23"),
            task("life", category: "생활", date: "2026-10-23"),
            task("tomorrow", category: "연구", date: "2026-10-24")
        ]

        let tasks = TodayProjection.tasks(
            on: "2026-10-23",
            items: values,
            order: nil,
            completedVisible: true,
            categoryFilter: "연구"
        )

        XCTAssertEqual(tasks.map(\.id), ["research"])
    }

    func testMissingLinkedTaskUsesSavedChecklistValue() {
        let row = ChecklistRow(id: "row", title: "기존 스냅샷", completed: true, linkedTaskId: "deleted-task")

        let snapshot = TodayProjection.checklistSnapshot(row, in: [])

        XCTAssertEqual(snapshot, ChecklistSnapshot(title: "기존 스냅샷", completed: true))
    }

    private func task(_ id: String, category: String, date: String) -> CalendarItem {
        CalendarItem(
            id: id,
            kind: .task,
            title: id,
            category: category,
            timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"),
            completion: .pending
        )
    }

    private func period(_ id: String, kind: ItemKind, start: String? = nil, end: String) -> CalendarItem {
        CalendarItem(
            id: id,
            kind: kind,
            title: id,
            timing: .date(startDate: start, endDate: end, timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: []
        )
    }
}

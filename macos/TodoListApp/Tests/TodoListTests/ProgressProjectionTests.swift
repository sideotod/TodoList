import XCTest
@testable import TodoList

final class ProgressProjectionTests: XCTestCase {
    func testStartOnlyHasNoElapsedBar() {
        let startOnly = CalendarItem(
            id: "start-only",
            kind: .deadline,
            title: "프로젝트 시작",
            timing: .date(startDate: nil, endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            completion: .pending,
            focus: .start
        )
        let metrics = ProgressProjection.metrics(for: startOnly, now: instant("2026-10-25T00:00:00Z"), items: [startOnly])

        XCTAssertNil(metrics.elapsedFraction)
    }

    func testIntervalProgressDiffersFromChecklistCompletion() {
        let window = CalendarItem(
            id: "window",
            kind: .window,
            title: "연구 기간",
            timing: .date(startDate: "2026-10-20", endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: [
                ChecklistRow(id: "a", title: "A", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "b", title: "B", completed: false, linkedTaskId: nil)
            ]
        )
        let metrics = ProgressProjection.metrics(for: window, now: instant("2026-10-25T00:00:00Z"), items: [window])

        XCTAssertEqual(metrics.elapsedFraction ?? -1, 0.5, accuracy: 0.02)
        XCTAssertEqual(metrics.completedTasks, 1)
        XCTAssertEqual(metrics.totalTasks, 2)
    }

    func testLinkedTaskCompletionIsAuthoritative() {
        let progress = CalendarItem(
            id: "progress",
            kind: .deadline,
            title: "신청",
            timing: .date(startDate: nil, endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: [ChecklistRow(id: "row", title: "예전 이름", completed: false, linkedTaskId: "task")]
        )
        let linked = CalendarItem(
            id: "task",
            kind: .task,
            title: "서류 준비",
            timing: .unscheduled,
            completion: .completed
        )

        let snapshot = TodayProjection.checklistSnapshot(progress.checklist![0], in: [progress, linked])
        let metrics = ProgressProjection.metrics(for: progress, now: instant("2026-10-23T00:00:00Z"), items: [progress, linked])

        XCTAssertTrue(snapshot.completed)
        XCTAssertEqual(snapshot.title, "서류 준비")
        XCTAssertEqual(metrics.completedTasks, 1)
    }

    func testOptedInEventAppearsInProgress() {
        let included = CalendarItem(
            id: "included",
            kind: .event,
            title: "발표",
            timing: .date(startDate: "2026-10-30", endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            countdown: EventCountdown(enabled: true, daysBefore: 1, reference: .start),
            showInProgressSummary: true
        )
        let excluded = CalendarItem(
            id: "excluded",
            kind: .event,
            title: "일반 일정",
            timing: .date(startDate: "2026-10-30", endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            showInProgressSummary: false
        )

        XCTAssertEqual(ProgressProjection.cards(from: [included, excluded]).map(\.id), ["included"])
    }

    private func instant(_ value: String) -> Date {
        ISO8601DateFormatter.todoListDate(from: value)!
    }
}

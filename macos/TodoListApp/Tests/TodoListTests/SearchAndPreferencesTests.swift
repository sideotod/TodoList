import XCTest
@testable import TodoList

@MainActor
final class SearchAndPreferencesTests: XCTestCase {
    func testSearchMatchesTitleCategoryNotesAndURL() {
        let items = [
            task("title-hit", title: "Radiometry 발표"),
            task("category-hit", title: "읽기", category: "Radiometry"),
            task("notes-hit", title: "정리", notes: "radiometry 뜻 정리"),
            task("url-hit", title: "자료", url: "https://example.com/radiometry"),
            task("other", title: "다른 할 일")
        ]

        XCTAssertEqual(Set(ItemSearchProjection.matches(query: " radiometry ", in: items).map(\.id)), ["category-hit", "title-hit", "notes-hit", "url-hit"])
        XCTAssertTrue(ItemSearchProjection.matches(query: "\n", in: items).isEmpty)
    }

    func testSearchResultSelectsRelevantRouteAndPreservesInspectorContext() {
        let model = AppModel(repository: InMemoryItemRepository(), selectedDate: "2026-10-23")
        let event = CalendarItem(
            id: "event",
            kind: .event,
            title: "세미나",
            timing: .date(startDate: "2026-10-30", endDate: "2026-10-30", timeZone: "Asia/Seoul")
        )
        model.searchPresented = true

        model.openSearchResult(event)

        XCTAssertFalse(model.searchPresented)
        XCTAssertEqual(model.route, .calendar)
        XCTAssertEqual(model.calendarViewMode, .day)
        XCTAssertEqual(model.selectedDate, "2026-10-30")
        XCTAssertEqual(model.selectedItemID, event.id)
        XCTAssertTrue(model.inspectorPresented)
    }

    private func task(_ id: String, title: String, category: String? = nil, notes: String? = nil, url: String? = nil) -> CalendarItem {
        CalendarItem(
            id: id,
            kind: .task,
            title: title,
            category: category,
            notes: notes,
            sourceUrl: url,
            timing: .unscheduled,
            completion: .pending
        )
    }
}

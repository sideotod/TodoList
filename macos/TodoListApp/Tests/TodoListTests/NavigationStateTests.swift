import XCTest
@testable import TodoList

@MainActor
final class NavigationStateTests: XCTestCase {
    func testInspectorDismissalPreservesRouteDateAndCategory() {
        let model = AppModel(repository: InMemoryItemRepository(), selectedDate: "2026-10-23")
        model.route = .calendar
        model.calendarViewMode = .week
        model.selectedCategoryFilter = "연구"
        model.selectItem("event-1")

        XCTAssertTrue(model.inspectorPresented)
        model.dismissInspector()

        XCTAssertFalse(model.inspectorPresented)
        XCTAssertEqual(model.route, .calendar)
        XCTAssertEqual(model.selectedDate, "2026-10-23")
        XCTAssertEqual(model.calendarViewMode, .week)
        XCTAssertEqual(model.selectedCategoryFilter, "연구")
        XCTAssertEqual(model.selectedItemID, "event-1")
    }
}

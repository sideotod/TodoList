import XCTest
@testable import TodoList

@MainActor
final class AppLaunchTests: XCTestCase {
    func testRootViewConstructsWithTodaySelected() {
        let model = AppModel(repository: InMemoryItemRepository())
        let rootView = RootView(model: model)

        XCTAssertEqual(model.route, .today)
        _ = rootView.body
    }

    func testOfflineLaunchNeedsNoSupabaseConfiguration() async {
        let repository = InMemoryItemRepository()
        let model = AppModel(repository: repository)

        await model.load()

        XCTAssertEqual(model.repositoryStatus, .local)
        XCTAssertTrue(model.items.isEmpty)
        _ = RootView(model: model).body
    }
}

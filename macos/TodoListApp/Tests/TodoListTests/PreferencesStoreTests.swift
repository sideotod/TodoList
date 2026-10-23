import Foundation
import XCTest
@testable import TodoList

@MainActor
final class PreferencesStoreTests: XCTestCase {
    func testLegacyDefaultsAndRoundTrip() throws {
        let suiteName = "TodoListPreferencesTests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = PreferencesStore(defaults: defaults)

        XCTAssertEqual(try store.load(), .defaults)

        let legacyData = Data(#"{"version":1,"preferences":{"version":1,"weekStartsOn":0,"calendarVisibility":{"events":false}}}"#.utf8)
        defaults.set(legacyData, forKey: "todolist.preferences.v1")
        var migrated = try store.load()
        XCTAssertEqual(migrated.weekStartsOn, 0)
        XCTAssertEqual(migrated.calendarVisibility, CalendarLayerPreferences(tasks: true, events: false, progress: true))
        XCTAssertEqual(migrated.visibleHours, VisibleHoursPreference(start: 6, end: 23))

        migrated.timeFormat = "12h"
        migrated.timeZone = "America/Los_Angeles"
        migrated.colorTheme = "arctic"
        migrated.taskCategories = [TaskCategoryPreference(name: "연구", color: "violet")]
        migrated.visibleHours = VisibleHoursPreference(start: 8, end: 22)
        migrated.taskOrders = ["2026-10-23": TaskOrderPreference(pending: ["task-1"], completed: [])]
        migrated.reminderOffsets = ["event-1": 30]
        migrated.remindersEnabled = true
        try store.save(migrated)

        XCTAssertEqual(try PreferencesStore(defaults: defaults).load(), migrated)
    }
}

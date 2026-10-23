import Foundation
import XCTest
@testable import TodoList

@MainActor
final class BackupCodecTests: XCTestCase {
    func testDecodesBrowserLocalV1AndAppliesNativeDefaults() throws {
        let data = try localBackupData(items: [task("one")])

        let backup = try BackupCodec.decodeLocal(data)

        XCTAssertEqual(backup.schemaVersion, 1)
        XCTAssertEqual(backup.items.map(\.id), ["one"])
        XCTAssertEqual(backup.preferences.timeZone, "Asia/Seoul")
        XCTAssertEqual(backup.preferences.appearance, "system")
    }

    func testRejectsDuplicateIDsBeforeRepositoryMutation() throws {
        let item = task("duplicate")
        let data = try localBackupData(items: [item, item])

        XCTAssertThrowsError(try BackupCodec.decodeLocal(data)) { error in
            guard case BackupCodecError.duplicateItemID("duplicate") = error else {
                return XCTFail("Expected duplicate ID validation, got \(error).")
            }
        }
    }

    func testRejectsOversizedBackup() {
        XCTAssertThrowsError(try BackupCodec.decodeLocal(Data(repeating: 0, count: BackupCodec.maximumSize + 1))) { error in
            guard case BackupCodecError.tooLarge = error else { return XCTFail("Expected size validation.") }
        }
    }

    func testLocalBackupEncodeRoundTripKeepsLinkedIDsAndPreferences() throws {
        let period = CalendarItem(
            id: "period",
            kind: .deadline,
            title: "제출",
            timing: .date(startDate: nil, endDate: "2026-10-30", timeZone: "Asia/Seoul"),
            completion: .pending,
            checklist: [ChecklistRow(id: "row", title: "서류", completed: false, linkedTaskId: "task")]
        )
        var preferences = AppPreferences.defaults
        preferences.weekStartsOn = 0
        preferences.taskOrders["2026-10-23"] = TaskOrderPreference(pending: ["task"], completed: [])

        let data = try BackupCodec.encodeLocal(items: [task("task"), period], preferences: preferences)
        let decoded = try BackupCodec.decodeLocal(data)

        XCTAssertEqual(decoded.items.first(where: { $0.id == "period" })?.checklist?.first?.linkedTaskId, "task")
        XCTAssertEqual(decoded.taskOrders["2026-10-23"]?.pending, ["task"])
        XCTAssertEqual(decoded.preferences.weekStartsOn, 0)
    }

    private func task(_ id: String) -> CalendarItem {
        CalendarItem(
            id: id,
            kind: .task,
            title: id,
            timing: .date(startDate: nil, endDate: "2026-10-23", timeZone: "Asia/Seoul"),
            completion: .pending
        )
    }

    private func localBackupData(items: [CalendarItem]) throws -> Data {
        let legacyPreferences: [String: Any] = [
            "weekStartsOn": 1,
            "timeFormat": "24h",
            "timeZone": "Asia/Seoul",
            "colorTheme": "sage",
            "taskCategories": [],
            "calendarVisibility": ["tasks": true, "events": true, "progress": true]
        ]
        return try JSONSerialization.data(withJSONObject: [
            "schemaVersion": 1,
            "exportedAt": "2026-10-23T00:00:00.000Z",
            "items": try items.map { try JSONSerialization.jsonObject(with: ItemCoding.encode($0)) },
            "taskOrders": [:] as [String: Any],
            "reminderOffsets": [:] as [String: Int],
            "remindersEnabled": false,
            "preferences": legacyPreferences
        ])
    }
}

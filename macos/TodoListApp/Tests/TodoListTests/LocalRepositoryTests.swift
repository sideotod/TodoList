import Foundation
import SwiftData
import XCTest
@testable import TodoList

@MainActor
final class LocalRepositoryTests: XCTestCase {
    func testUpsertSurvivesContainerReopen() async throws {
        let storeURL = try makeStoreURL()
        defer { try? FileManager.default.removeItem(at: storeURL.deletingLastPathComponent()) }
        let original = makeTask(title: "저장 후 재실행")

        do {
            let store = try LocalStore(storeURL: storeURL)
            let repository = SwiftDataItemRepository(store: store)
            try await repository.upsert(original)
        }

        let reopened = SwiftDataItemRepository(store: try LocalStore(storeURL: storeURL))
        let reopenedItem = try await reopened.item(id: original.id)
        XCTAssertEqual(reopenedItem, original)
    }

    func testDeletePersistsTombstone() async throws {
        let storeURL = try makeStoreURL()
        defer { try? FileManager.default.removeItem(at: storeURL.deletingLastPathComponent()) }
        let fixedDate = Date(timeIntervalSince1970: 1_790_000_000)
        let store = try LocalStore(storeURL: storeURL)
        let repository = SwiftDataItemRepository(store: store, clock: { fixedDate })
        let item = makeTask()
        try await repository.upsert(item)
        try await repository.delete(id: item.id)

        let reopened = SwiftDataItemRepository(store: try LocalStore(storeURL: storeURL))
        let storedTombstone = try await reopened.item(id: item.id)
        let tombstone = try XCTUnwrap(storedTombstone)
        XCTAssertEqual(tombstone.deletedAt, ISO8601DateFormatter.todoListTimestamp(for: fixedDate))
    }

    func testFailedTransactionKeepsPreviousPayload() async throws {
        let store = try LocalStore.inMemory()
        let repository = SwiftDataItemRepository(store: store)
        let original = makeTask(title: "원본")
        try await repository.upsert(original)
        store.failNextSave = SimulatedSaveFailure()
        let changed = makeTask(title: "저장에 실패할 변경")
        let mutation = PendingMutationDraft(ownerUID: "user-1", operationID: "operation-1")

        do {
            try await repository.upsert(changed, pendingMutation: mutation)
            XCTFail("The injected transaction failure should be surfaced.")
        } catch ItemRepositoryError.persistence {
            // Expected: the repository reports persistence failure and rolls back both writes.
        }

        let retainedItem = try await repository.item(id: original.id)
        XCTAssertEqual(retainedItem?.title, "원본")
        XCTAssertTrue(try repository.pendingOperations(ownerUID: "user-1").isEmpty)
    }

    func testBatchImportRollsBackAllItemsOnStoreFailure() async throws {
        let store = try LocalStore.inMemory()
        let repository = SwiftDataItemRepository(store: store)
        store.failNextSave = SimulatedSaveFailure()
        let first = makeTask(title: "가져오기 첫 항목")
        let second = CalendarItem(id: "task-2", kind: .task, title: "가져오기 두 번째", timing: .unscheduled, completion: .pending)

        do {
            try await repository.upsertMany([first, second])
            XCTFail("The injected save failure should reject the whole batch.")
        } catch ItemRepositoryError.persistence {
            // A batch restore must never leave only part of an import behind.
        }

        let retainedItems = try await repository.listItems()
        XCTAssertTrue(retainedItems.isEmpty)
    }

    func testDuplicateIDUpdatesOneRecordAndCorruptPayloadIsReported() async throws {
        let store = try LocalStore.inMemory()
        let repository = SwiftDataItemRepository(store: store)
        try await repository.upsert(makeTask(title: "첫 저장"))
        try await repository.upsert(makeTask(title: "수정"))
        let items = try await repository.listItems()
        let updatedItem = try await repository.item(id: "task-1")
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(updatedItem?.title, "수정")

        store.context.insert(StoredItem(id: "damaged", payload: Data("{".utf8), kind: "task", title: "손상", deletedAt: nil))
        try store.context.save()
        do {
            _ = try await repository.item(id: "damaged")
            XCTFail("Corrupt saved JSON must be surfaced as a repository error.")
        } catch ItemRepositoryError.corruptPayload(let itemID, _) {
            XCTAssertEqual(itemID, "damaged")
        }
        XCTAssertEqual(try store.context.fetch(FetchDescriptor<StoredItem>()).count, 2)
    }

    private func makeStoreURL() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("TodoList-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("local.store")
    }

    private func makeTask(title: String = "기본 할 일") -> CalendarItem {
        CalendarItem(id: "task-1", kind: .task, title: title, timing: .unscheduled, completion: .pending)
    }
}

private struct SimulatedSaveFailure: Error {}

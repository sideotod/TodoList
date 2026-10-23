import Foundation
import SwiftData

@MainActor
final class SwiftDataItemRepository: ItemRepository {
    private let store: LocalStore
    private let clock: () -> Date

    init(store: LocalStore, clock: @escaping () -> Date = Date.init) {
        self.store = store
        self.clock = clock
    }

    convenience init(storeURL: URL? = nil) throws {
        try self.init(store: LocalStore(storeURL: storeURL))
    }

    func listItems() async throws -> [CalendarItem] {
        let records = try store.context.fetch(FetchDescriptor<StoredItem>())
        return try records.sorted { $0.id < $1.id }.map(decode)
    }

    func item(id: String) async throws -> CalendarItem? {
        guard let record = try findStoredItem(id: id) else { return nil }
        return try decode(record)
    }

    func upsert(_ item: CalendarItem) async throws {
        try await upsert(item, pendingMutation: nil)
    }

    func upsert(_ item: CalendarItem, pendingMutation: PendingMutationDraft?) async throws {
        try ItemValidator.validate(item)
        if let pendingMutation { try validate(pendingMutation) }

        do {
            let payload = try ItemCoding.encode(item)
            let record = try findStoredItem(id: item.id)
            if let record {
                record.payload = payload
                record.kind = item.kind.rawValue
                record.title = item.title
                record.deletedAt = item.deletedAt
            } else {
                store.context.insert(StoredItem(id: item.id, payload: payload, kind: item.kind.rawValue, title: item.title, deletedAt: item.deletedAt))
            }
            if let pendingMutation {
                try append(pendingMutation, item: item)
            }
            try store.save()
        } catch {
            store.context.rollback()
            if let error = error as? ItemRepositoryError { throw error }
            throw ItemRepositoryError.persistence(underlying: error)
        }
    }

    func delete(id: String) async throws {
        try await delete(id: id, pendingMutation: nil)
    }

    func delete(id: String, pendingMutation: PendingMutationDraft?) async throws {
        guard let record = try findStoredItem(id: id) else { return }
        var item = try decode(record)
        item.deletedAt = ISO8601DateFormatter.todoListTimestamp(for: clock())
        if let pendingMutation {
            guard pendingMutation.kind == .delete else { throw ItemRepositoryError.invalidPendingMutation }
            try validate(pendingMutation)
        }

        do {
            let payload = try ItemCoding.encode(item)
            record.payload = payload
            record.deletedAt = item.deletedAt
            if let pendingMutation {
                try append(pendingMutation, item: item)
            }
            try store.save()
        } catch {
            store.context.rollback()
            if let error = error as? ItemRepositoryError { throw error }
            throw ItemRepositoryError.persistence(underlying: error)
        }
    }

    func pendingOperations(ownerUID: String) throws -> [StoredOperation] {
        try store.context.fetch(FetchDescriptor<StoredOperation>())
            .filter { $0.ownerUID == ownerUID }
            .sorted { $0.localSequence < $1.localSequence }
    }

    private func findStoredItem(id: String) throws -> StoredItem? {
        try store.context.fetch(FetchDescriptor<StoredItem>()).first { $0.id == id }
    }

    private func decode(_ stored: StoredItem) throws -> CalendarItem {
        do {
            return try ItemCoding.decode(stored.payload)
        } catch {
            throw ItemRepositoryError.corruptPayload(itemID: stored.id, underlying: error)
        }
    }

    private func validate(_ mutation: PendingMutationDraft) throws {
        guard !mutation.ownerUID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !mutation.operationID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              ISO8601DateFormatter.todoListDate(from: mutation.createdAt) != nil else {
            throw ItemRepositoryError.invalidPendingMutation
        }
    }

    private func append(_ mutation: PendingMutationDraft, item: CalendarItem) throws {
        let all = try store.context.fetch(FetchDescriptor<StoredOperation>())
        let ownerOperations = all.filter { $0.ownerUID == mutation.ownerUID && $0.itemID == item.id }
        let predecessor = ownerOperations.max { $0.localSequence < $1.localSequence }
        let sequence = (predecessor?.localSequence ?? 0) + 1
        let baseSnapshot = try mutation.baseSnapshot.map(ItemCoding.encodeProposal)
        let proposedSnapshot = try ItemCoding.encodeProposal(item)
        let operation = StoredOperation(
            id: "\(mutation.ownerUID)|\(mutation.operationID)",
            ownerUID: mutation.ownerUID,
            itemID: item.id,
            localSequence: sequence,
            operationID: mutation.operationID,
            predecessorOperationID: predecessor?.operationID,
            baseRevision: mutation.baseRevision,
            baseSnapshot: baseSnapshot,
            proposedSnapshot: proposedSnapshot,
            mutationKind: mutation.kind.rawValue,
            payloadDigest: nil,
            createdAt: mutation.createdAt,
            updatedAt: ISO8601DateFormatter.todoListTimestamp(for: clock())
        )
        store.context.insert(operation)
    }
}

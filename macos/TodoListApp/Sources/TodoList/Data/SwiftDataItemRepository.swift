import Foundation
import SwiftData

@MainActor
final class SwiftDataItemRepository: ItemRepository {
    private let store: LocalStore
    private let clock: () -> Date
    var syncOwner: String?
    var syncBaseIsTrusted = false
    var onPendingChange: (() -> Void)?

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
        let previous = try findStoredItem(id: item.id).map(decode)
        let mutation = syncOwner.map { PendingMutationDraft(ownerUID: $0, baseRevision: syncBaseIsTrusted ? item.revision : nil, baseSnapshot: previous) }
        try saveUpsert(item, pendingMutation: mutation)
        if mutation != nil { onPendingChange?() }
    }

    func upsert(_ item: CalendarItem, expected: CalendarItem?) async throws {
        let previous = try findStoredItem(id: item.id).map(decode)
        switch (previous, expected) {
        case (nil, nil): break
        case let (current?, original?):
            guard current.deletedAt == original.deletedAt,
                  try ItemCoding.encodeProposal(current) == ItemCoding.encodeProposal(original) else {
                throw ItemRepositoryError.staleLocal
            }
        default: throw ItemRepositoryError.staleLocal
        }
        let mutation = syncOwner.map { PendingMutationDraft(ownerUID: $0, baseRevision: syncBaseIsTrusted ? previous?.revision : nil, baseSnapshot: previous) }
        try saveUpsert(item, pendingMutation: mutation)
        if mutation != nil { onPendingChange?() }
    }

    func upsert(_ item: CalendarItem, pendingMutation: PendingMutationDraft?) async throws {
        try saveUpsert(item, pendingMutation: pendingMutation)
    }

    private func saveUpsert(_ item: CalendarItem, pendingMutation: PendingMutationDraft?) throws {
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

    func upsertMany(_ items: [CalendarItem]) async throws {
        var uniqueIDs = Set<String>()
        for item in items {
            try ItemValidator.validate(item)
            guard uniqueIDs.insert(item.id).inserted else {
                throw ItemValidationError.invalid(path: "items.id", reason: "Imported item identifiers must be unique.")
            }
        }

        do {
            for item in items {
                let payload = try ItemCoding.encode(item)
                let record = try findStoredItem(id: item.id)
                let previous = try record.map(decode)
                if let record {
                    record.payload = payload
                    record.kind = item.kind.rawValue
                    record.title = item.title
                    record.deletedAt = item.deletedAt
                } else {
                    store.context.insert(StoredItem(id: item.id, payload: payload, kind: item.kind.rawValue, title: item.title, deletedAt: item.deletedAt))
                }
                if let syncOwner {
                    try append(PendingMutationDraft(ownerUID: syncOwner, baseRevision: syncBaseIsTrusted ? previous?.revision : nil, baseSnapshot: previous,
                                                    kind: item.deletedAt == nil ? .upsert : .delete), item: item)
                }
            }
            try store.save()
            if syncOwner != nil { onPendingChange?() }
        } catch {
            store.context.rollback()
            if let error = error as? ItemRepositoryError { throw error }
            throw ItemRepositoryError.persistence(underlying: error)
        }
    }

    func delete(id: String) async throws {
        let previous = try await item(id: id)
        let mutation = syncOwner.map { PendingMutationDraft(ownerUID: $0, baseRevision: syncBaseIsTrusted ? previous?.revision : nil, baseSnapshot: previous, kind: .delete) }
        try await delete(id: id, pendingMutation: mutation)
        if mutation != nil { onPendingChange?() }
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
        let descriptor = FetchDescriptor<StoredOperation>(predicate: #Predicate { $0.ownerUID == ownerUID })
        return try store.context.fetch(descriptor)
            .sorted { $0.localSequence < $1.localSequence }
    }

    private func findStoredItem(id: String) throws -> StoredItem? {
        var descriptor = FetchDescriptor<StoredItem>(predicate: #Predicate { $0.id == id })
        descriptor.fetchLimit = 1
        return try store.context.fetch(descriptor).first
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

    @discardableResult
    private func append(_ mutation: PendingMutationDraft, item: CalendarItem) throws -> StoredOperation {
        let owner = mutation.ownerUID
        let itemID = item.id
        let descriptor = FetchDescriptor<StoredOperation>(predicate: #Predicate { $0.ownerUID == owner && $0.itemID == itemID })
        let ownerOperations = try store.context.fetch(descriptor)
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
        return operation
    }

    func reconcileInitial(owner: String, remoteItems: [CalendarItem]) throws {
        do {
            let pendingIDs = Set(try pendingOperations(ownerUID: owner).map(\.itemID))
            let records = try store.context.fetch(FetchDescriptor<StoredItem>())
            let localIDs = Set(records.map(\.id))
            guard Set(remoteItems.map(\.id)).count == remoteItems.count else { throw SyncError.invalidRemote }
            let remoteByID = Dictionary(uniqueKeysWithValues: remoteItems.map { ($0.id, $0) })
            for record in records where !pendingIDs.contains(record.id) {
                let local = try decode(record)
                if let remote = remoteByID[record.id] {
                    if try sameActiveProposal(local, remote) {
                        try set(record, to: remote)
                    } else {
                        let draft = PendingMutationDraft(ownerUID: owner, kind: local.deletedAt == nil ? .upsert : .delete)
                        let operation = try append(draft, item: local)
                        operation.stage = "conflicted"
                        operation.baseSnapshot = try ItemCoding.encode(remote)
                    }
                } else if local.deletedAt == nil {
                    try append(PendingMutationDraft(ownerUID: owner), item: local)
                }
            }
            for remote in remoteItems where !localIDs.contains(remote.id) {
                store.context.insert(StoredItem(id: remote.id, payload: try ItemCoding.encode(remote), kind: remote.kind.rawValue, title: remote.title, deletedAt: remote.deletedAt))
            }
            try store.save()
        } catch {
            store.context.rollback()
            throw error
        }
    }

    func mergeRemote(owner: String, remoteItems: [CalendarItem]) throws {
        do {
            let pendingIDs = Set(try pendingOperations(ownerUID: owner).map(\.itemID))
            for remote in remoteItems where !pendingIDs.contains(remote.id) {
                if let record = try findStoredItem(id: remote.id) {
                    let local = try decode(record)
                    if let localRevision = local.revision {
                        guard let remoteRevision = remote.revision, remoteRevision >= localRevision else { throw SyncError.invalidRemote }
                        if remoteRevision > localRevision {
                            try set(record, to: remote)
                        } else if local != remote {
                            let operation = try append(PendingMutationDraft(ownerUID: owner,
                                kind: local.deletedAt == nil ? .upsert : .delete), item: local)
                            operation.stage = "conflicted"
                            operation.baseSnapshot = try ItemCoding.encode(remote)
                        }
                    } else if try sameActiveProposal(local, remote) {
                        try set(record, to: remote)
                    } else {
                        let draft = PendingMutationDraft(ownerUID: owner, kind: local.deletedAt == nil ? .upsert : .delete)
                        let operation = try append(draft, item: local)
                        operation.stage = "conflicted"
                        operation.baseSnapshot = try ItemCoding.encode(remote)
                    }
                } else {
                    store.context.insert(StoredItem(id: remote.id, payload: try ItemCoding.encode(remote), kind: remote.kind.rawValue, title: remote.title, deletedAt: remote.deletedAt))
                }
            }
            try store.save()
        } catch {
            store.context.rollback()
            throw error
        }
    }

    func nextMutation(owner: String, remoteItems: [CalendarItem]) throws -> SyncMutation? {
        while true {
            let operations = try pendingOperations(ownerUID: owner)
            guard let operation = operations.first(where: { $0.stage != "conflicted" && $0.predecessorOperationID == nil }) else { return nil }
            if operation.mutationKind == "delete" && operation.baseRevision == nil {
                if let remote = remoteItems.first(where: { $0.id == operation.itemID }) {
                    operation.stage = "conflicted"
                    operation.baseSnapshot = try ItemCoding.encode(remote)
                } else {
                    if let successor = operations.first(where: { $0.predecessorOperationID == operation.operationID }) {
                        successor.predecessorOperationID = nil
                    }
                    store.context.delete(operation)
                }
                do { try store.save() } catch { store.context.rollback(); throw error }
                continue
            }
            let digest = try operation.payloadDigest ?? SupabaseRemoteStore.digest(itemID: operation.itemID,
                baseRevision: operation.baseRevision, kind: operation.mutationKind, proposal: operation.proposedSnapshot)
            operation.payloadDigest = digest
            operation.stage = "sending"
            do { try store.save() } catch { store.context.rollback(); throw error }
            return SyncMutation(itemID: operation.itemID, operationID: operation.operationID, baseRevision: operation.baseRevision,
                                kind: operation.mutationKind, proposal: operation.proposedSnapshot, digest: digest)
        }
    }

    func recordConflict(owner: String, mutation: SyncMutation, remote: CalendarItem) throws {
        guard let operation = try pendingOperations(ownerUID: owner).first(where: { $0.operationID == mutation.operationID }) else { return }
        operation.stage = "conflicted"
        operation.baseSnapshot = try ItemCoding.encode(remote)
        do { try store.save() } catch { store.context.rollback(); throw error }
    }

    func acknowledge(owner: String, mutation: SyncMutation, result: SyncCommitResult) throws {
        let operations = try pendingOperations(ownerUID: owner)
        guard let operation = operations.first(where: { $0.operationID == mutation.operationID }),
              let revision = result.receiptRevision, operation.payloadDigest == mutation.digest else { throw SyncError.invalidRemote }
        do {
            if let successor = operations.first(where: { $0.predecessorOperationID == operation.operationID }) {
                successor.predecessorOperationID = nil
                successor.baseRevision = revision
                successor.baseSnapshot = mutation.proposal
                successor.payloadDigest = nil
                if let record = try findStoredItem(id: mutation.itemID) {
                    var local = try decode(record)
                    local.revision = revision
                    local.updatedAt = result.remote.updatedAt
                    local.lastMutationId = mutation.operationID
                    local.lastMutationDigest = mutation.digest
                    try set(record, to: local)
                }
            } else if let record = try findStoredItem(id: mutation.itemID) {
                try set(record, to: result.remote)
            }
            store.context.delete(operation)
            try store.save()
        } catch { store.context.rollback(); throw error }
    }

    func conflicts(owner: String) throws -> [(item: CalendarItem, remote: CalendarItem)] {
        try pendingOperations(ownerUID: owner).filter { $0.stage == "conflicted" }.compactMap { operation in
            guard let record = try findStoredItem(id: operation.itemID), let snapshot = operation.baseSnapshot else { return nil }
            return (try decode(record), try ItemCoding.decode(snapshot))
        }
    }

    func resolveConflict(owner: String, itemID: String, keepLocal: Bool) throws {
        let operations = try pendingOperations(ownerUID: owner).filter { $0.itemID == itemID }
        guard let conflict = operations.first(where: { $0.stage == "conflicted" }),
              let snapshot = conflict.baseSnapshot, let record = try findStoredItem(id: itemID) else { throw SyncError.invalidRemote }
        let remote = try ItemCoding.decode(snapshot)
        let local = try decode(record)
        if keepLocal && remote.deletedAt != nil { throw SyncError.deletedRemotely }
        do {
            for operation in operations { store.context.delete(operation) }
            if keepLocal {
                try append(PendingMutationDraft(ownerUID: owner, baseRevision: remote.revision, baseSnapshot: remote,
                                                kind: local.deletedAt == nil ? .upsert : .delete), item: local)
            } else {
                try set(record, to: remote)
            }
            try store.save()
            onPendingChange?()
        } catch { store.context.rollback(); throw error }
    }

    private func set(_ record: StoredItem, to item: CalendarItem) throws {
        record.payload = try ItemCoding.encode(item)
        record.kind = item.kind.rawValue
        record.title = item.title
        record.deletedAt = item.deletedAt
    }

    private func sameActiveProposal(_ local: CalendarItem, _ remote: CalendarItem) throws -> Bool {
        guard local.deletedAt == nil, remote.deletedAt == nil else { return false }
        return try ItemCoding.encodeProposal(local) == ItemCoding.encodeProposal(remote)
    }
}

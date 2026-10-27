import Foundation

@MainActor
protocol ItemRepository: AnyObject {
    func listItems() async throws -> [CalendarItem]
    func item(id: String) async throws -> CalendarItem?
    func upsert(_ item: CalendarItem) async throws
    func upsert(_ item: CalendarItem, expected: CalendarItem?) async throws
    func upsertMany(_ items: [CalendarItem]) async throws
    func upsert(_ item: CalendarItem, pendingMutation: PendingMutationDraft?) async throws
    func delete(id: String) async throws
    func delete(id: String, pendingMutation: PendingMutationDraft?) async throws
}

enum ItemRepositoryError: Error, LocalizedError {
    case corruptPayload(itemID: String, underlying: Error)
    case invalidPendingMutation
    case staleLocal
    case persistence(underlying: Error)

    var errorDescription: String? {
        switch self {
        case let .corruptPayload(itemID, underlying): "Saved item \(itemID) is unreadable: \(underlying.localizedDescription)"
        case .invalidPendingMutation: "The pending account mutation is missing a valid owner or operation ID."
        case .staleLocal: "편집하는 동안 항목이 변경되었습니다. 입력 내용은 유지되며, 최신 항목을 확인한 뒤 다시 편집해 주세요."
        case let .persistence(underlying): "Local changes could not be saved: \(underlying.localizedDescription)"
        }
    }
}

@MainActor
final class InMemoryItemRepository: ItemRepository {
    private var items: [String: CalendarItem] = [:]

    init(initialItems: [CalendarItem] = []) {
        items = Dictionary(uniqueKeysWithValues: initialItems.map { ($0.id, $0) })
    }

    func listItems() async throws -> [CalendarItem] {
        items.values.sorted { $0.id < $1.id }
    }

    func item(id: String) async throws -> CalendarItem? {
        items[id]
    }

    func upsert(_ item: CalendarItem) async throws {
        try ItemValidator.validate(item)
        items[item.id] = item
    }

    func upsert(_ item: CalendarItem, expected: CalendarItem?) async throws {
        guard items[item.id] == expected else { throw ItemRepositoryError.staleLocal }
        try ItemValidator.validate(item)
        items[item.id] = item
    }

    func upsertMany(_ items: [CalendarItem]) async throws {
        var uniqueIDs = Set<String>()
        for item in items {
            try ItemValidator.validate(item)
            guard uniqueIDs.insert(item.id).inserted else {
                throw ItemValidationError.invalid(path: "items.id", reason: "Imported item identifiers must be unique.")
            }
        }
        for item in items { self.items[item.id] = item }
    }

    func upsert(_ item: CalendarItem, pendingMutation: PendingMutationDraft?) async throws {
        guard pendingMutation == nil else { throw ItemRepositoryError.invalidPendingMutation }
        try await upsert(item)
    }

    func delete(id: String) async throws {
        guard var item = items[id] else { return }
        item.deletedAt = ISO8601DateFormatter.todoListTimestamp()
        items[id] = item
    }

    func delete(id: String, pendingMutation: PendingMutationDraft?) async throws {
        guard pendingMutation == nil else { throw ItemRepositoryError.invalidPendingMutation }
        try await delete(id: id)
    }
}

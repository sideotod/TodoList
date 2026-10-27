import Foundation
import SwiftData

@Model
final class StoredOperation {
    @Attribute(.unique) var id: String
    var ownerUID: String
    var itemID: String
    var localSequence: Int
    var operationID: String
    var predecessorOperationID: String?
    var baseRevision: Int?
    var baseSnapshot: Data?
    var proposedSnapshot: Data
    var mutationKind: String
    var stage: String
    var payloadDigest: String?
    var createdAt: String
    var updatedAt: String

    init(
        id: String,
        ownerUID: String,
        itemID: String,
        localSequence: Int,
        operationID: String,
        predecessorOperationID: String?,
        baseRevision: Int?,
        baseSnapshot: Data?,
        proposedSnapshot: Data,
        mutationKind: String,
        stage: String = "queued",
        payloadDigest: String?,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.ownerUID = ownerUID
        self.itemID = itemID
        self.localSequence = localSequence
        self.operationID = operationID
        self.predecessorOperationID = predecessorOperationID
        self.baseRevision = baseRevision
        self.baseSnapshot = baseSnapshot
        self.proposedSnapshot = proposedSnapshot
        self.mutationKind = mutationKind
        self.stage = stage
        self.payloadDigest = payloadDigest
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct PendingMutationDraft: Sendable {
    enum Kind: String, Sendable {
        case upsert
        case delete
    }

    var ownerUID: String
    var operationID: String
    var baseRevision: Int?
    var baseSnapshot: CalendarItem?
    var kind: Kind
    var createdAt: String

    init(
        ownerUID: String,
        operationID: String = UUID().uuidString.lowercased(),
        baseRevision: Int? = nil,
        baseSnapshot: CalendarItem? = nil,
        kind: Kind = .upsert,
        createdAt: String = ISO8601DateFormatter.todoListTimestamp()
    ) {
        self.ownerUID = ownerUID
        self.operationID = operationID
        self.baseRevision = baseRevision
        self.baseSnapshot = baseSnapshot
        self.kind = kind
        self.createdAt = createdAt
    }
}

extension ISO8601DateFormatter {
    static func todoListTimestamp(for date: Date = Date()) -> String {
        TodoListISO8601Formatters.shared.timestamp(for: date)
    }

    static func todoListDate(from value: String) -> Date? {
        TodoListISO8601Formatters.shared.date(from: value)
    }
}

private final class TodoListISO8601Formatters: @unchecked Sendable {
    static let shared = TodoListISO8601Formatters()

    private let lock = NSLock()
    private let fractional: ISO8601DateFormatter
    private let standard: ISO8601DateFormatter

    private init() {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fractional.timeZone = TimeZone(secondsFromGMT: 0)
        self.fractional = fractional

        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        standard.timeZone = TimeZone(secondsFromGMT: 0)
        self.standard = standard
    }

    func timestamp(for date: Date) -> String {
        lock.lock()
        defer { lock.unlock() }
        return fractional.string(from: date)
    }

    func date(from value: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        return fractional.date(from: value) ?? standard.date(from: value)
    }
}

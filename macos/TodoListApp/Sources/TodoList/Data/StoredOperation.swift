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
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter.string(from: date)
    }

    static func todoListDate(from value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        if let fractional = formatter.date(from: value) { return fractional }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}

import CryptoKit
import Foundation
import Supabase

struct SyncMutation: Sendable {
    let itemID: String
    let operationID: String
    let baseRevision: Int?
    let kind: String
    let proposal: Data
    let digest: String
}

struct SyncCommitResult: Sendable {
    let status: String
    let remote: CalendarItem
    let receiptRevision: Int?
}

@MainActor
protocol SyncRemoteStore {
    func fetchItems(userID: String) async throws -> [CalendarItem]
    func commit(_ mutation: SyncMutation, userID: String) async throws -> SyncCommitResult
}

enum SyncError: LocalizedError {
    case invalidRemote
    case wrongAccount
    case accountMismatch
    case deletedRemotely

    var errorDescription: String? {
        switch self {
        case .invalidRemote: "서버에서 받은 일정 또는 저장 결과를 검증하지 못했습니다. 로컬 변경을 보존합니다."
        case .wrongAccount: "로그인한 계정이 동기화할 계정과 일치하지 않습니다."
        case .accountMismatch: "이 Mac의 데이터는 다른 Supabase 계정에 연결되어 있어 동기화를 중지했습니다."
        case .deletedRemotely: "서버에서 삭제된 항목은 같은 ID로 덮어쓸 수 없습니다."
        }
    }
}

@MainActor
final class SupabaseRemoteStore: SyncRemoteStore {
    private let authClient: SupabaseClient
    private let client: SupabaseClient
    private let expectedUserID: String

    init(authClient: SupabaseClient, configuration: SupabaseConfiguration, userID: String, session: URLSession = .shared) {
        self.authClient = authClient
        self.expectedUserID = userID.lowercased()
        let expectedUserID = userID.lowercased()
        self.client = SupabaseClient(supabaseURL: configuration.url, supabaseKey: configuration.publishableKey,
            options: .init(auth: .init(autoRefreshToken: false, accessToken: {
                let session = try await authClient.auth.session
                guard session.user.id.uuidString.lowercased() == expectedUserID else { throw SyncError.wrongAccount }
                return session.accessToken
            }), global: .init(session: session)))
    }

    private struct Row: Decodable {
        let item_id: String
        let item_data: CalendarItem
    }

    private struct Receipt: Decodable {
        let itemId: String
        let payloadDigest: String
        let resultRevision: Int
        let createdAt: String
    }

    private struct Response: Decodable {
        let status: String
        let receipt: Receipt?
        let remote: CalendarItem
    }

    private struct Parameters: Encodable {
        let p_item_id: String
        let p_operation_id: String
        let p_payload_digest: String
        let p_base_revision: Int?
        let p_mutation_kind: String
        let p_proposed_snapshot: AnyJSON

        enum CodingKeys: String, CodingKey {
            case p_item_id, p_operation_id, p_payload_digest, p_base_revision, p_mutation_kind, p_proposed_snapshot
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(p_item_id, forKey: .p_item_id)
            try container.encode(p_operation_id, forKey: .p_operation_id)
            try container.encode(p_payload_digest, forKey: .p_payload_digest)
            try container.encode(p_base_revision, forKey: .p_base_revision)
            try container.encode(p_mutation_kind, forKey: .p_mutation_kind)
            try container.encode(p_proposed_snapshot, forKey: .p_proposed_snapshot)
        }
    }

    private func verifyUser(_ userID: String) async throws {
        let session = try await authClient.auth.session
        guard userID.lowercased() == expectedUserID, session.user.id.uuidString.lowercased() == expectedUserID else {
            throw SyncError.wrongAccount
        }
    }

    func fetchItems(userID: String) async throws -> [CalendarItem] {
        try await verifyUser(userID)
        var items: [CalendarItem] = []
        let pageSize = 500
        var lastID: String?
        while true {
            let query = client.from("calendar_items")
                .select("item_id,item_data")
                .eq("user_id", value: userID)
            if let lastID { _ = query.gt("item_id", value: lastID) }
            let rows: [Row] = try await query
                .order("item_id")
                .limit(pageSize)
                .execute().value
            for row in rows {
                guard row.item_id == row.item_data.id else { throw SyncError.invalidRemote }
                items.append(try Self.normalize(row.item_data))
            }
            guard rows.count == pageSize else { break }
            guard let next = rows.last?.item_id, next != lastID else { throw SyncError.invalidRemote }
            lastID = next
        }
        return items
    }

    func commit(_ mutation: SyncMutation, userID: String) async throws -> SyncCommitResult {
        try await verifyUser(userID)
        let proposal = try JSONDecoder().decode(AnyJSON.self, from: mutation.proposal)
        let params = Parameters(p_item_id: mutation.itemID, p_operation_id: mutation.operationID,
            p_payload_digest: mutation.digest, p_base_revision: mutation.baseRevision,
            p_mutation_kind: mutation.kind, p_proposed_snapshot: proposal)
        let response: Response = try await client.rpc("apply_calendar_item_mutation", params: params).execute().value
        guard response.remote.id == mutation.itemID else { throw SyncError.invalidRemote }
        if response.status == "conflict" {
            return SyncCommitResult(status: response.status, remote: try Self.normalize(response.remote), receiptRevision: nil)
        }
        guard ["applied", "already-applied"].contains(response.status), let receipt = response.receipt,
              receipt.itemId == mutation.itemID, receipt.payloadDigest == mutation.digest,
              receipt.resultRevision > 0, let revision = response.remote.revision,
              revision >= receipt.resultRevision else { throw SyncError.invalidRemote }
        if revision == receipt.resultRevision {
            guard response.remote.lastMutationId == mutation.operationID,
                  response.remote.lastMutationDigest == mutation.digest,
                  response.remote.updatedAt == receipt.createdAt else { throw SyncError.invalidRemote }
        }
        return SyncCommitResult(status: response.status, remote: try Self.normalize(response.remote), receiptRevision: receipt.resultRevision)
    }

    static func digest(itemID: String, baseRevision: Int?, kind: String, proposal: Data) throws -> String {
        let proposed = try JSONDecoder().decode(AnyJSON.self, from: proposal)
        let value = AnyJSON.object(["itemId": .string(itemID), "baseRevision": baseRevision.map(AnyJSON.integer) ?? .null,
                                    "mutationKind": .string(kind), "proposedSnapshot": proposed])
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return SHA256.hash(data: try encoder.encode(value)).map { String(format: "%02x", $0) }.joined()
    }

    private static func normalize(_ input: CalendarItem) throws -> CalendarItem {
        var item = input
        guard item.revision != nil, item.updatedAt != nil, item.lastMutationId != nil, item.lastMutationDigest != nil else {
            throw SyncError.invalidRemote
        }
        func timestamp(_ value: String?) throws -> String? {
            guard let value else { return nil }
            guard let date = ISO8601DateFormatter.todoListDate(from: value) else { throw SyncError.invalidRemote }
            return ISO8601DateFormatter.todoListTimestamp(for: date)
        }
        item.updatedAt = try timestamp(item.updatedAt)
        item.deletedAt = try timestamp(item.deletedAt)
        try ItemValidator.validate(item)
        return item
    }
}

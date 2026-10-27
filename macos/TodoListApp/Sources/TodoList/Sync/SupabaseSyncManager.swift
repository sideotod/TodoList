import CryptoKit
import Foundation
import Observation

struct SyncConflict: Identifiable {
    let item: CalendarItem
    let remote: CalendarItem
    var id: String { item.id }
}

@MainActor
@Observable
final class SupabaseSyncManager {
    private(set) var status = "로그인하면 동기화를 시작합니다"
    private(set) var conflicts: [SyncConflict] = []
    private(set) var pendingCount = 0
    private(set) var isSyncing = false

    @ObservationIgnored private let repository: SwiftDataItemRepository
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let onItemsChanged: @MainActor () -> Void
    @ObservationIgnored private var owner: String?
    @ObservationIgnored private var userID: String?
    @ObservationIgnored private var remote: (any SyncRemoteStore)?
    @ObservationIgnored private var worker: Task<Void, Never>?
    @ObservationIgnored private var timer: Task<Void, Never>?
    @ObservationIgnored private var requested = false
    @ObservationIgnored private var generation = 0
    private static let ownerKey = "todolist.sync.owner.v1"

    init(repository: SwiftDataItemRepository, defaults: UserDefaults = .standard, onItemsChanged: @escaping @MainActor () -> Void) {
        self.repository = repository
        self.defaults = defaults
        self.onItemsChanged = onItemsChanged
        repository.syncOwner = defaults.string(forKey: Self.ownerKey)
        if let owner = repository.syncOwner { repository.syncBaseIsTrusted = defaults.bool(forKey: Self.initialKey(owner)) }
        repository.onPendingChange = { [weak self] in self?.requestSync() }
    }

    func connect(userID: String, project: String, remote: any SyncRemoteStore) {
        let identity = "\(project.lowercased())|\(userID.lowercased())"
        if owner == identity, self.remote != nil { return }
        disconnect()
        if let saved = defaults.string(forKey: Self.ownerKey), saved != identity {
            status = SyncError.accountMismatch.localizedDescription
            return
        }
        defaults.set(identity, forKey: Self.ownerKey)
        repository.syncOwner = identity
        repository.syncBaseIsTrusted = defaults.bool(forKey: Self.initialKey(identity))
        owner = identity
        self.userID = userID
        self.remote = remote
        status = "동기화 준비 중"
        requestSync()
        timer = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                guard !Task.isCancelled else { return }
                self?.requestSync()
            }
        }
    }

    func disconnect() {
        generation += 1
        worker?.cancel()
        timer?.cancel()
        worker = nil
        timer = nil
        owner = nil
        userID = nil
        remote = nil
        requested = false
        isSyncing = false
        conflicts = []
        status = "로그인하면 동기화를 시작합니다"
    }

    func requestSync() {
        guard owner != nil, userID != nil, remote != nil else { return }
        if worker != nil { requested = true; return }
        let currentGeneration = generation
        worker = Task { [weak self] in
            guard let self else { return }
            await self.synchronize(generation: currentGeneration)
            guard self.generation == currentGeneration else { return }
            self.worker = nil
            if self.requested {
                self.requested = false
                self.requestSync()
            }
        }
    }

    private func synchronize(generation expected: Int) async {
        guard let owner, let userID, let remote else { return }
        isSyncing = true
        status = "동기화 중"
        defer { if generation == expected { isSyncing = false } }
        do {
            let items = try await remote.fetchItems(userID: userID)
            try ensureCurrent(expected)
            let initialKey = Self.initialKey(owner)
            if defaults.bool(forKey: initialKey) {
                try repository.mergeRemote(owner: owner, remoteItems: items)
            } else {
                try repository.reconcileInitial(owner: owner, remoteItems: items)
                defaults.set(true, forKey: initialKey)
                repository.syncBaseIsTrusted = true
            }
            onItemsChanged()
            while let mutation = try repository.nextMutation(owner: owner, remoteItems: items) {
                try ensureCurrent(expected)
                let result = try await remote.commit(mutation, userID: userID)
                try ensureCurrent(expected)
                if result.status == "conflict" {
                    try repository.recordConflict(owner: owner, mutation: mutation, remote: result.remote)
                } else {
                    try repository.acknowledge(owner: owner, mutation: mutation, result: result)
                }
                onItemsChanged()
            }
            try updateSummary(owner: owner)
            status = conflicts.isEmpty ? "동기화됨" : "충돌 \(conflicts.count)건 확인 필요"
        } catch is CancellationError {
            return
        } catch {
            guard generation == expected else { return }
            try? updateSummary(owner: owner)
            status = "동기화 대기: \(error.localizedDescription)"
        }
    }

    func resolve(_ conflict: SyncConflict, keepLocal: Bool) {
        guard let owner else { return }
        do {
            try repository.resolveConflict(owner: owner, itemID: conflict.id, keepLocal: keepLocal)
            try updateSummary(owner: owner)
            onItemsChanged()
            requestSync()
        } catch { status = error.localizedDescription }
    }

    private func updateSummary(owner: String) throws {
        pendingCount = try repository.pendingOperations(ownerUID: owner).count
        conflicts = try repository.conflicts(owner: owner).map { SyncConflict(item: $0.item, remote: $0.remote) }
    }

    private func ensureCurrent(_ expected: Int) throws {
        guard !Task.isCancelled, generation == expected else { throw CancellationError() }
    }

    private static func initialKey(_ owner: String) -> String {
        let digest = SHA256.hash(data: Data(owner.utf8)).map { String(format: "%02x", $0) }.joined()
        return "todolist.sync.initial.v1.\(digest)"
    }
}

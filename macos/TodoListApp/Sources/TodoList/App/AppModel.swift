import Foundation
import Observation

/// Shared application data and services. Navigation and presentation state live in WindowModel.
@MainActor
@Observable
final class AppModel {
    private(set) var items: [CalendarItem] = []
    private(set) var preferences: AppPreferences = .defaults
    private(set) var repositoryStatus: RepositoryStatus = .loading
    private(set) var preferencesError: String?
    let repository: any ItemRepository
    let preferencesStore: PreferencesStore
    let authService: SupabaseAuthService
    private(set) var syncManager: SupabaseSyncManager?

    private let startupWarning: String?
    private var didStartInitialLoad = false

    init(
        repository: any ItemRepository,
        preferencesStore: PreferencesStore? = nil,
        startupWarning: String? = nil,
        authService: SupabaseAuthService = SupabaseAuthService()
    ) {
        self.repository = repository
        self.preferencesStore = preferencesStore ?? PreferencesStore()
        self.authService = authService
        self.startupWarning = startupWarning
    }

    var categoryNames: [String] {
        let names = Set(preferences.taskCategories.map(\.name) + items.compactMap { item in
            item.kind == .task ? item.category : nil
        })
        return names.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    func load() async {
        await loadLocal()
        await authService.restoreSession()
    }

    private func loadLocal() async {
        do {
            items = try await repository.listItems()
            repositoryStatus = startupWarning.map(RepositoryStatus.memoryFallback) ?? .local
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
        do {
            preferences = try preferencesStore.load()
            Theme.apply(colorTheme: preferences.colorTheme)
            preferencesError = nil
        } catch {
            preferences = .defaults
            Theme.apply(colorTheme: preferences.colorTheme)
            preferencesError = error.localizedDescription
        }
    }

    func loadIfNeeded() async {
        guard !didStartInitialLoad else { return }
        didStartInitialLoad = true
        await load()
    }

    func refresh() async { await loadLocal() }

    private func installSync(repository: SwiftDataItemRepository) {
        syncManager = SupabaseSyncManager(repository: repository) { [weak self] in
            Task { await self?.loadLocal() }
        }
        authService.onAccountChanged = { [weak self] in self?.updateSyncAccount() }
        updateSyncAccount()
    }

    private func updateSyncAccount() {
        guard let syncManager else { return }
        guard case let .signedIn(userID, _) = authService.state,
              let client = authService.client, let project = authService.projectIdentifier,
              let configuration = authService.configuration else {
            syncManager.disconnect()
            return
        }
        syncManager.connect(userID: userID, project: project,
                            remote: SupabaseRemoteStore(authClient: client, configuration: configuration, userID: userID))
    }

    func presentRepositoryError(_ error: Error) {
        repositoryStatus = .loadFailed(error.localizedDescription)
    }

    func clearPreferencesError() { preferencesError = nil }

    func updatePreferences(_ update: (inout AppPreferences) -> Void) {
        var changed = preferences
        update(&changed)
        do {
            try preferencesStore.save(changed)
            preferences = changed
            Theme.apply(colorTheme: changed.colorTheme)
            preferencesError = nil
        } catch {
            preferencesError = error.localizedDescription
        }
    }

    func toggleTask(_ item: CalendarItem) async {
        guard item.kind == .task, let completion = item.completion else { return }
        var changed = item
        changed.completion = completion == .completed ? .pending : .completed
        do {
            try await repository.upsert(changed)
            await refresh()
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    func setCompletion(_ item: CalendarItem) async {
        guard item.kind != .event, let completion = item.completion else { return }
        var changed = item
        changed.completion = completion == .completed ? .pending : .completed
        do {
            try await repository.upsert(changed)
            await refresh()
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    func reorderTasks(on date: String, order: TaskOrderPreference, moving itemID: String, by offset: Int) {
        var pending = order.pending
        var completed = order.completed
        let isPending = pending.contains(itemID)
        var ids = isPending ? pending : completed
        guard let index = ids.firstIndex(of: itemID) else { return }
        let next = index + offset
        guard ids.indices.contains(next) else { return }
        ids.swapAt(index, next)
        if isPending { pending = ids } else { completed = ids }
        var nextPreferences = preferences
        nextPreferences.taskOrders[date] = TaskOrderPreference(pending: pending, completed: completed)
        do {
            try preferencesStore.save(nextPreferences)
            preferences = nextPreferences
            preferencesError = nil
        } catch {
            preferencesError = error.localizedDescription
        }
    }

    func deleteItem(_ itemID: String) async {
        do {
            try await repository.delete(id: itemID)
            await refresh()
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    static func bootstrap() -> AppModel {
        let emptyPreview = ProcessInfo.processInfo.arguments.contains("--empty-preview")
        let stressPreview = ProcessInfo.processInfo.arguments.contains("--stress-preview")
        if ProcessInfo.processInfo.arguments.contains("--design-preview") || emptyPreview || stressPreview {
            let defaults = UserDefaults(suiteName: stressPreview ? "com.sideotod.TodoList.StressPreview" : "com.sideotod.TodoList.DesignPreview") ?? .standard
            let preferencesStore = PreferencesStore(defaults: defaults, storageKey: "todolist.design-preview.preferences.v1")
            var preferences = AppPreferences.defaults
            preferences.taskCategories = [
                TaskCategoryPreference(name: "대학원 연구", color: "sage"),
                TaskCategoryPreference(name: "학교", color: "amber"),
                TaskCategoryPreference(name: "개인", color: "violet")
            ]
            try? preferencesStore.save(preferences)
            return AppModel(
                repository: InMemoryItemRepository(initialItems: emptyPreview ? [] : stressPreview ? StressPreviewFixture.items : DesignPreviewFixture.items),
                preferencesStore: preferencesStore
            )
        }
        do {
            let repository = try SwiftDataItemRepository()
            let app = AppModel(repository: repository)
            app.installSync(repository: repository)
            return app
        } catch {
            return AppModel(
                repository: InMemoryItemRepository(),
                startupWarning: "영구 저장소를 열지 못해 이번 실행에서는 메모리 저장을 사용합니다. 원인: \(error.localizedDescription)"
            )
        }
    }
}

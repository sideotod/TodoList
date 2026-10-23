import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    var route: AppRoute = .today
    var selectedDate: String
    var calendarViewMode: CalendarViewMode = .month
    var selectedItemID: String?
    var selectedCategoryFilter: String?
    var inspectorPresented = false
    var searchPresented = false
    var newTaskRequestID: UUID?
    var editingItemID: String?
    var editorKind: ItemKind = .task
    var editorContext: ItemEditorContext?
    private(set) var items: [CalendarItem] = []
    private(set) var preferences: AppPreferences = .defaults
    private(set) var repositoryStatus: RepositoryStatus = .loading
    private(set) var preferencesError: String?
    let repository: any ItemRepository
    let preferencesStore: PreferencesStore
    let authService: SupabaseAuthService

    private let startupWarning: String?
    init(
        repository: any ItemRepository,
        selectedDate: String? = nil,
        preferencesStore: PreferencesStore? = nil,
        startupWarning: String? = nil,
        authService: SupabaseAuthService = SupabaseAuthService()
    ) {
        self.repository = repository
        self.selectedDate = selectedDate ?? Self.todayDate()
        self.preferencesStore = preferencesStore ?? PreferencesStore()
        self.authService = authService
        self.startupWarning = startupWarning
    }

    var selectedItem: CalendarItem? {
        guard let selectedItemID else { return nil }
        return items.first { $0.id == selectedItemID && $0.deletedAt == nil }
    }

    var categoryNames: [String] {
        let names = Set(preferences.taskCategories.map(\.name) + items.compactMap { item in
            item.kind == .task ? item.category : nil
        })
        return names.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    var visibleItems: [CalendarItem] {
        items.filter { item in
            item.deletedAt == nil && (selectedCategoryFilter == nil || item.category == selectedCategoryFilter)
        }
    }

    func load() async {
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
        await authService.restoreSession()
    }

    func refresh() async {
        await load()
    }

    func presentRepositoryError(_ error: Error) {
        repositoryStatus = .loadFailed(error.localizedDescription)
    }

    func clearPreferencesError() {
        preferencesError = nil
    }

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

    func selectItem(_ itemID: String) {
        selectedItemID = itemID
        inspectorPresented = true
    }

    func openSearchResult(_ item: CalendarItem) {
        searchPresented = false
        switch item.kind {
        case .task:
            route = .today
            if case let .date(_, date, _) = item.timing { selectedDate = date }
            else if case let .time(_, instant, zone) = item.timing, let instant {
                selectedDate = Self.localDate(for: instant, timeZone: zone) ?? selectedDate
            }
        case .event:
            route = .calendar
            calendarViewMode = .day
            if case let .date(start, end, _) = item.timing { selectedDate = start ?? end }
            else if case let .time(start, end, zone) = item.timing, let instant = start ?? end {
                selectedDate = Self.localDate(for: instant, timeZone: zone) ?? selectedDate
            }
        case .deadline, .window:
            route = .progress
            if case let .date(start, end, _) = item.timing { selectedDate = start ?? end }
            else if case let .time(start, end, zone) = item.timing, let instant = start ?? end {
                selectedDate = Self.localDate(for: instant, timeZone: zone) ?? selectedDate
            }
        }
        selectItem(item.id)
    }

    func dismissInspector() {
        inspectorPresented = false
    }

    var editorPresented: Bool {
        newTaskRequestID != nil || editingItemID != nil
    }

    func requestNewTask() {
        requestCreateItem(kind: .task)
    }

    func requestCreateItem(kind: ItemKind, context: ItemEditorContext? = nil) {
        editingItemID = nil
        editorKind = kind
        editorContext = context ?? ItemEditorContext(dateOnly: selectedDate, startInstant: nil, timeZone: preferences.timeZone)
        newTaskRequestID = UUID()
    }

    func clearNewTaskRequest() {
        newTaskRequestID = nil
    }

    func requestEdit(_ itemID: String) {
        guard let item = items.first(where: { $0.id == itemID }) else { return }
        editingItemID = itemID
        editorKind = item.kind
        editorContext = ItemEditorContext(dateOnly: selectedDate, startInstant: nil, timeZone: preferences.timeZone)
    }

    func clearEditRequest() {
        editingItemID = nil
    }

    func clearEditorRequest() {
        clearNewTaskRequest()
        clearEditRequest()
        editorContext = nil
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

    func toggleCategoryFilter(_ category: String?) {
        selectedCategoryFilter = selectedCategoryFilter == category ? nil : category
    }

    func showCalendar(for item: CalendarItem) {
        if case let .date(_, endDate, _) = item.timing {
            selectedDate = endDate
        } else if case let .time(startAt, endAt, zone) = item.timing,
                  let instant = startAt ?? endAt {
            selectedDate = Self.localDate(for: instant, timeZone: zone) ?? selectedDate
        }
        route = .calendar
        calendarViewMode = .day
        inspectorPresented = false
    }

    func setSelectedItemCompletion() async {
        guard let item = selectedItem, item.kind != .event, let completion = item.completion else { return }
        var changed = item
        changed.completion = completion == .completed ? .pending : .completed
        do {
            try await repository.upsert(changed)
            await refresh()
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    func deleteSelectedItem() async {
        guard let itemID = selectedItemID else { return }
        await deleteItem(itemID)
    }

    func deleteItem(_ itemID: String) async {
        do {
            try await repository.delete(id: itemID)
            if selectedItemID == itemID {
                selectedItemID = nil
                inspectorPresented = false
            }
            await refresh()
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    static func bootstrap() -> AppModel {
        if ProcessInfo.processInfo.arguments.contains("--design-preview") {
            let defaults = UserDefaults(suiteName: "com.sideotod.TodoList.DesignPreview") ?? .standard
            let preferencesStore = PreferencesStore(defaults: defaults, storageKey: "todolist.design-preview.preferences.v1")
            var preferences = AppPreferences.defaults
            preferences.taskCategories = [
                TaskCategoryPreference(name: "대학원 연구", color: "sage"),
                TaskCategoryPreference(name: "학교", color: "amber"),
                TaskCategoryPreference(name: "개인", color: "violet")
            ]
            try? preferencesStore.save(preferences)
            return AppModel(
                repository: InMemoryItemRepository(initialItems: DesignPreviewFixture.items),
                selectedDate: DesignPreviewFixture.date,
                preferencesStore: preferencesStore
            )
        }
        do {
            return AppModel(repository: try SwiftDataItemRepository())
        } catch {
            return AppModel(
                repository: InMemoryItemRepository(),
                startupWarning: "영구 저장소를 열지 못해 이번 실행에서는 메모리 저장을 사용합니다. 원인: \(error.localizedDescription)"
            )
        }
    }

    private static func todayDate() -> String {
        let formatter = dateFormatter(timeZone: "Asia/Seoul")
        return formatter.string(from: Date())
    }

    private static func localDate(for instant: String, timeZone: String) -> String? {
        guard let date = ISO8601DateFormatter.todoListDate(from: instant) else { return nil }
        return dateFormatter(timeZone: timeZone).string(from: date)
    }

    private static func dateFormatter(timeZone: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }
}

enum AppRoute: String, CaseIterable, Identifiable, Hashable {
    case today
    case progress
    case calendar

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "오늘"
        case .progress: "Progress"
        case .calendar: "캘린더"
        }
    }

    var symbol: String {
        switch self {
        case .today: "sun.max"
        case .progress: "circle.lefthalf.filled"
        case .calendar: "calendar"
        }
    }
}

enum CalendarViewMode: String, CaseIterable, Identifiable {
    case day
    case week
    case month
    case year

    var id: String { rawValue }
}

enum RepositoryStatus: Equatable {
    case loading
    case local
    case memoryFallback(String)
    case loadFailed(String)

    var title: String {
        switch self {
        case .loading: "로컬 데이터 불러오는 중"
        case .local: "이 Mac에 저장됨 · 동기화 설정 없음"
        case .memoryFallback: "메모리 저장 · 재실행 시 유지되지 않음"
        case .loadFailed: "로컬 데이터를 불러오지 못함"
        }
    }

    var detail: String? {
        switch self {
        case .memoryFallback(let message), .loadFailed(let message): message
        case .loading, .local: nil
        }
    }
}

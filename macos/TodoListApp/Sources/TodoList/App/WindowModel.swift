import Foundation
import Observation

/// UI state belongs to a window. The shared AppModel owns persistent data and services.
@MainActor
@Observable
final class WindowModel {
    let app: AppModel
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

    init(app: AppModel, selectedDate: String? = nil) {
        self.app = app
        self.selectedDate = selectedDate ?? TodayView.currentDate(timeZone: app.preferences.timeZone)
    }

    var items: [CalendarItem] { app.items }
    var preferences: AppPreferences { app.preferences }
    var calendarWeekStartsOn: Int { 0 }
    var repositoryStatus: RepositoryStatus { app.repositoryStatus }
    var preferencesError: String? { app.preferencesError }
    var repository: any ItemRepository { app.repository }
    var categoryNames: [String] { app.categoryNames }
    var visibleItems: [CalendarItem] {
        items.filter { $0.deletedAt == nil && (selectedCategoryFilter == nil || $0.category == selectedCategoryFilter) }
    }
    var selectedItem: CalendarItem? {
        guard let selectedItemID else { return nil }
        return items.first { $0.id == selectedItemID && $0.deletedAt == nil }
    }
    var editorPresented: Bool { newTaskRequestID != nil || editingItemID != nil }

    func loadIfNeeded() async { await app.loadIfNeeded() }
    func refresh() async { await app.refresh() }
    func updatePreferences(_ update: (inout AppPreferences) -> Void) { app.updatePreferences(update) }
    func presentRepositoryError(_ error: Error) { app.presentRepositoryError(error) }
    func clearPreferencesError() { app.clearPreferencesError() }
    func toggleTask(_ item: CalendarItem) async { await app.toggleTask(item) }
    func reorderTasks(on date: String, order: TaskOrderPreference, moving itemID: String, by offset: Int) {
        app.reorderTasks(on: date, order: order, moving: itemID, by: offset)
    }

    func selectItem(_ itemID: String) {
        selectedItemID = itemID
        inspectorPresented = true
    }

    func dismissInspector() { inspectorPresented = false }

    func requestNewTask() { requestCreateItem(kind: .task) }

    func requestCreateItem(kind: ItemKind, context: ItemEditorContext? = nil) {
        editingItemID = nil
        editorKind = kind
        editorContext = context ?? ItemEditorContext(dateOnly: selectedDate, startInstant: nil, timeZone: preferences.timeZone, weekStartsOn: calendarWeekStartsOn)
        newTaskRequestID = UUID()
    }

    func requestEdit(_ itemID: String) {
        guard let item = items.first(where: { $0.id == itemID }) else { return }
        editingItemID = itemID
        editorKind = item.kind
        editorContext = ItemEditorContext(dateOnly: selectedDate, startInstant: nil, timeZone: preferences.timeZone, weekStartsOn: calendarWeekStartsOn)
    }

    func clearEditorRequest() {
        newTaskRequestID = nil
        editingItemID = nil
        editorContext = nil
    }

    func toggleCategoryFilter(_ category: String?) {
        selectedCategoryFilter = selectedCategoryFilter == category ? nil : category
    }

    func openSearchResult(_ item: CalendarItem) {
        searchPresented = false
        switch item.kind {
        case .task:
            route = .today
            if case let .date(_, date, _) = item.timing { selectedDate = date }
            else if case let .time(_, instant, zone) = item.timing, let instant {
                selectedDate = localDate(for: instant, timeZone: zone) ?? selectedDate
            }
        case .event:
            route = .calendar
            calendarViewMode = .day
            setDate(from: item)
        case .deadline, .window:
            route = .progress
            setDate(from: item)
        }
        selectItem(item.id)
    }

    func showCalendar(for item: CalendarItem) {
        setDate(from: item)
        route = .calendar
        calendarViewMode = .day
        inspectorPresented = false
    }

    func setSelectedItemCompletion() async {
        guard let item = selectedItem, item.kind != .event else { return }
        await app.setCompletion(item)
    }

    func deleteSelectedItem() async {
        guard let itemID = selectedItemID else { return }
        await deleteItem(itemID)
    }

    func deleteItem(_ itemID: String) async {
        await app.deleteItem(itemID)
        if selectedItemID == itemID {
            selectedItemID = nil
            inspectorPresented = false
        }
    }

    func restore(route: String, date: String, calendarMode: String, selectedItemID: String?, category: String?, inspectorPresented: Bool) {
        self.route = AppRoute(rawValue: route) ?? .today
        if !date.isEmpty { selectedDate = date }
        self.calendarViewMode = CalendarViewMode(rawValue: calendarMode) ?? .month
        self.selectedItemID = selectedItemID
        self.selectedCategoryFilter = category
        self.inspectorPresented = inspectorPresented && selectedItem != nil
    }

    private func setDate(from item: CalendarItem) {
        switch item.timing {
        case let .date(start, end, _): selectedDate = start ?? end
        case let .time(start, end, zone):
            if let instant = start ?? end { selectedDate = localDate(for: instant, timeZone: zone) ?? selectedDate }
        case .unscheduled: break
        }
    }

    private func localDate(for instant: String, timeZone: String) -> String? {
        guard let date = ISO8601DateFormatter.todoListDate(from: instant) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

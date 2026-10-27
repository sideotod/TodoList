import SwiftUI

struct RootView: View {
    let appModel: AppModel
    private let appDelegate: TodoListAppDelegate?
    @State private var model: WindowModel
    @Environment(\.openSettings) private var openSettings
    @Environment(\.openWindow) private var openWindow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @SceneStorage("todolist.route") private var savedRoute = AppRoute.today.rawValue
    @SceneStorage("todolist.selected-date") private var savedDate = ""
    @SceneStorage("todolist.calendar-mode") private var savedCalendarMode = CalendarViewMode.month.rawValue
    @SceneStorage("todolist.selected-item") private var savedSelectedItemID = ""
    @SceneStorage("todolist.category-filter") private var savedCategory = ""
    @SceneStorage("todolist.inspector-presented") private var savedInspectorPresented = false
    @State private var hoveredSidebarRow: String?
    @SceneStorage("todolist.sidebar-visible") private var sidebarVisible = true

    init(model: AppModel, appDelegate: TodoListAppDelegate? = nil) {
        self.appModel = model
        self.appDelegate = appDelegate
        let arguments = ProcessInfo.processInfo.arguments
        let previewDate = arguments.contains("--stress-preview") ? StressPreviewFixture.date : arguments.contains("--design-preview") ? DesignPreviewFixture.date : nil
        _model = State(initialValue: WindowModel(app: model, selectedDate: previewDate))
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                sidebar
                    .frame(width: 216)
                    .frame(width: sidebarVisible ? 216 : 0, alignment: .leading)
                    .clipped()
                    .accessibilityHidden(!sidebarVisible)
                routeContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.canvas)
            }
            .toolbar {
                ToolbarItem(placement: .navigation) {
                    Button {
                        withAnimation(reduceMotion ? nil : .smooth(duration: 0.28, extraBounce: 0)) {
                            sidebarVisible.toggle()
                        }
                    } label: {
                        Image(systemName: "sidebar.left")
                    }
                    .accessibilityLabel(sidebarVisible ? "사이드바 가리기" : "사이드바 보기")
                    .help("사이드바 보기/가리기")
                }
            }
        }
        .navigationTitle("")
        .focusedSceneValue(\.todoListWindowModel, model)
        .onAppear {
            appDelegate?.reopenMainWindow = { openWindow(id: "main") }
        }
        .inspector(isPresented: inspectorBinding) {
            if let item = model.selectedItem {
                ItemInspectorView(
                    item: item,
                    repository: model.repository,
                    timeFormat: model.preferences.timeFormat,
                    onEdit: { model.requestEdit(item.id) },
                    onComplete: { Task { await model.setSelectedItemCompletion() } },
                    onDelete: { Task { await model.deleteSelectedItem() } },
                    onShowInCalendar: { model.showCalendar(for: item) },
                    onRefresh: { Task { await model.refresh() } },
                    onClose: { model.dismissInspector() }
                )
                .inspectorColumnWidth(min: 360, ideal: 440, max: 520)
            } else {
                EmptyView()
            }
        }
        .tint(Theme.accent)
        .preferredColorScheme(preferredColorScheme)
        .onOpenURL { url in Task { await appModel.authService.handleCallback(url) } }
        .onExitCommand { model.dismissInspector() }
        .task {
            await appModel.loadIfNeeded()
            if savedDate.isEmpty {
                model.selectedDate = TodayView.currentDate(timeZone: model.preferences.timeZone)
            }
            restoreSceneState()
        }
        .sheet(isPresented: editorPresentationBinding) {
            let initial = model.items.first { $0.id == model.editingItemID }
            ItemEditorView(
                initialItem: initial,
                defaultKind: model.editorKind,
                context: model.editorContext ?? ItemEditorContext(dateOnly: model.selectedDate, startInstant: nil, timeZone: model.preferences.timeZone, weekStartsOn: model.calendarWeekStartsOn),
                repository: model.repository,
                categoryItems: model.items,
                categoryPreferences: model.preferences.taskCategories,
                onSaved: { _ in
                    Task { await model.refresh(); model.clearEditorRequest() }
                },
                onCancel: { model.clearEditorRequest() },
                timeFormat: model.preferences.timeFormat
            )
        }
        .sheet(isPresented: searchPresentationBinding) {
            GlobalSearchView(items: model.items.filter { $0.deletedAt == nil }, onSelect: model.openSearchResult, onClose: { model.searchPresented = false }, timeFormat: model.preferences.timeFormat)
                .background { SheetOutsideClickDismiss { model.searchPresented = false }.allowsHitTesting(false) }
        }
        .toolbar {
            ToolbarItem(placement: .automatic) { Spacer() }
            if model.route != .today {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        model.route = .today
                        model.selectedCategoryFilter = nil
                        model.selectedDate = TodayView.currentDate(timeZone: model.preferences.timeZone)
                    } label: {
                        Image(systemName: "house")
                    }
                    .accessibilityLabel("오늘로 이동")
                    .help("오늘로 이동")
                    if model.route == .calendar {
                        Button {
                            model.requestNewTask()
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("새 할 일")
                        .help("새 할 일 (⌘N)")
                    }
                }
            }
        }
        .toolbar(removing: .sidebarToggle)
        .onChange(of: model.route) { _, value in savedRoute = value.rawValue }
        .onChange(of: model.selectedDate) { _, value in savedDate = value }
        .onChange(of: model.calendarViewMode) { _, value in savedCalendarMode = value.rawValue }
        .onChange(of: model.selectedItemID) { _, value in savedSelectedItemID = value ?? "" }
        .onChange(of: model.selectedCategoryFilter) { _, value in savedCategory = value ?? "" }
        .onChange(of: model.inspectorPresented) { _, value in savedInspectorPresented = value }
    }

    private var sidebar: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(Theme.accent.opacity(0.9), lineWidth: 1.2)
                        .frame(width: 24, height: 24)
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.accent)
                        .offset(x: 1)
                }
                .rotationEffect(.degrees(-6))
                .frame(width: 24, height: 24)
                Text("todo")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .tracking(-0.7)
                Spacer(minLength: 0)
            }
            .padding(.leading, 25)
            .padding(.trailing, 16)
            .padding(.top, 24)
            .padding(.bottom, 12)

            List {
                Section("WORKSPACE") {
                    ForEach(AppRoute.allCases) { route in
                        sidebarRoute(route)
                    }
                }
                if !orderedCategoryNames.isEmpty {
                    Section("MY AREAS") {
                        ForEach(orderedCategoryNames, id: \.self) { category in
                            let color = model.preferences.taskCategories.first(where: { $0.name == category }).map { areaColor($0.color) } ?? Theme.accent
                            sidebarArea(category, color: color)
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)
            .padding(.horizontal, 6)

            Divider()
            Button {
                model.dismissInspector()
                openSettings()
            } label: {
                Label("설정", systemImage: "gearshape")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 19)
                    .padding(.vertical, 13)
                    .background(hoveredSidebarRow == "settings" ? Theme.rowHover : .clear)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .onHover { hoveredSidebarRow = $0 ? "settings" : nil }
            .accessibilityLabel("설정 열기")
        }
        .background(Theme.sidebar)
        .background { SidebarToolbarLayout().frame(width: 0, height: 0) }
    }

    private func sidebarRoute(_ route: AppRoute) -> some View {
        let isSelected = model.route == route && model.selectedCategoryFilter == nil
        return Button {
            model.route = route
            model.selectedCategoryFilter = nil
        } label: {
            HStack(spacing: 10) {
                Label(route.title, systemImage: route.symbol)
                    .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                Spacer(minLength: 4)
                if route != model.route, let count = sidebarCount(for: route), count > 0 {
                    Text("\(count)")
                        .font(.system(size: 10, design: .rounded).monospacedDigit())
                        .foregroundStyle(Theme.tertiaryText)
                }
            }
            .foregroundStyle(isSelected ? Theme.accent : Theme.primaryText)
            .padding(.horizontal, 10)
            .frame(height: 34)
            .contentShape(Rectangle())
            .background(isSelected ? Theme.sageSelection : hoveredSidebarRow == route.rawValue ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .onHover { hoveredSidebarRow = $0 ? route.rawValue : nil }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .accessibilityAddTraits(model.route == route && model.selectedCategoryFilter == nil ? .isSelected : [])
    }

    private func sidebarArea(_ category: String, color: Color) -> some View {
        let selected = model.selectedCategoryFilter == category
        return Button {
            model.toggleCategoryFilter(category)
        } label: {
            HStack(spacing: 10) {
                Circle().fill(color.opacity(0.82)).frame(width: 8, height: 8)
                Text(category).font(.system(size: 11, weight: selected ? .medium : .regular))
                Spacer(minLength: 4)
            }
            .foregroundStyle(Theme.primaryText)
            .padding(.horizontal, 11)
            .frame(height: 31)
            .contentShape(Rectangle())
            .background(selected ? Theme.sageSelection : hoveredSidebarRow == "category:\(category)" ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .onHover { hoveredSidebarRow = $0 ? "category:\(category)" : nil }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func sidebarCount(for route: AppRoute) -> Int? {
        switch route {
        case .today:
            let today = TodayView.currentDate(timeZone: model.preferences.timeZone)
            return TodayProjection.tasks(on: today, items: model.visibleItems, order: nil, completedVisible: false, categoryFilter: nil).count
        case .progress:
            return ProgressProjection.cards(from: model.visibleItems).filter { $0.completion != .completed }.count
        case .calendar:
            return nil
        }
    }

    private var orderedCategoryNames: [String] {
        let available = Set(model.categoryNames)
        let configured = model.preferences.taskCategories.map(\.name).filter(available.contains)
        return configured + model.categoryNames.filter { !configured.contains($0) }
    }

    private func areaColor(_ name: String) -> Color {
        Theme.categoryColor(name)
    }

    @ViewBuilder
    private var routeContent: some View {
        switch model.route {
        case .today: TodayView(model: model, repository: model.repository)
        case .progress: ProgressGalleryView(model: model, repository: model.repository)
        case .calendar: CalendarView(model: model, repository: model.repository)
        }
    }

    private var inspectorBinding: Binding<Bool> {
        Binding(get: { model.inspectorPresented }, set: { model.inspectorPresented = $0 })
    }

    private var editorPresentationBinding: Binding<Bool> {
        Binding(get: { model.editorPresented }, set: { if !$0 { model.clearEditorRequest() } })
    }

    private var searchPresentationBinding: Binding<Bool> {
        Binding(get: { model.searchPresented }, set: { model.searchPresented = $0 })
    }

    private var preferredColorScheme: ColorScheme? {
        switch model.preferences.appearance {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    private func restoreSceneState() {
        model.restore(
            route: savedRoute,
            date: savedDate,
            calendarMode: savedCalendarMode,
            selectedItemID: savedSelectedItemID.isEmpty ? nil : savedSelectedItemID,
            category: savedCategory.isEmpty ? nil : savedCategory,
            inspectorPresented: savedInspectorPresented
        )
    }
}

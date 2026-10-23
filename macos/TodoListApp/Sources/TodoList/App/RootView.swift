import SwiftUI

struct RootView: View {
    let model: AppModel
    @State private var settingsPresented = false

    var body: some View {
        GeometryReader { windowGeometry in
            NavigationSplitView {
                sidebar
                    .navigationSplitViewColumnWidth(
                        min: 160,
                        ideal: min(216, max(160, windowGeometry.size.width * 0.15)),
                        max: 240
                    )
            } detail: {
                ZStack(alignment: .trailing) {
                routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.canvas)
                if model.inspectorPresented, let item = model.selectedItem {
                    GeometryReader { geometry in
                        ZStack(alignment: .trailing) {
                        Color.black.opacity(0.13)
                            .contentShape(Rectangle())
                            .onTapGesture { model.dismissInspector() }
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
                        .frame(width: min(420, max(280, geometry.size.width - 240)))
                        .frame(maxHeight: .infinity)
                        .background(.white)
                        .shadow(color: .black.opacity(0.12), radius: 18, x: -4)
                        }
                    }
                    .transition(.opacity)
                    .zIndex(2)
                }
                if settingsPresented {
                    GeometryReader { geometry in
                        ZStack(alignment: .trailing) {
                            Color.black.opacity(0.13)
                                .contentShape(Rectangle())
                                .onTapGesture { settingsPresented = false }
                            SettingsView(model: model, onClose: { settingsPresented = false })
                                .frame(width: min(420, max(300, geometry.size.width - 240)))
                                .frame(maxHeight: .infinity)
                                .background(.white)
                                .shadow(color: .black.opacity(0.12), radius: 18, x: -4)
                        }
                    }
                    .transition(.opacity)
                    .zIndex(3)
                }
            }
            .background(Theme.canvas)
            .onExitCommand {
                if settingsPresented { settingsPresented = false }
                else { model.dismissInspector() }
            }
            }
            .navigationSplitViewStyle(.balanced)
            .navigationTitle(model.route == .today ? "내 공간" : model.route.title)
            .tint(Theme.accent)
            .preferredColorScheme(preferredColorScheme)
            .toolbarBackground(Theme.titlebar, for: .windowToolbar)
            .toolbarColorScheme(.light, for: .windowToolbar)
            .onOpenURL { url in Task { await model.authService.handleCallback(url) } }
            .sheet(isPresented: editorPresentationBinding) {
            let initial = model.items.first { $0.id == model.editingItemID }
            ItemEditorView(
                initialItem: initial,
                defaultKind: model.editorKind,
                context: model.editorContext ?? ItemEditorContext(dateOnly: model.selectedDate, startInstant: nil, timeZone: model.preferences.timeZone),
                repository: model.repository,
                onSaved: { _ in
                    Task { await model.refresh(); model.clearEditorRequest() }
                },
                onCancel: { model.clearEditorRequest() }
            )
            }
            .sheet(isPresented: searchPresentationBinding) {
            GlobalSearchView(items: model.items.filter { $0.deletedAt == nil }, onSelect: model.openSearchResult, onClose: { model.searchPresented = false })
            }
            .toolbar {
            ToolbarItem(placement: .principal) {
                Text("todo")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(red: 0.43, green: 0.47, blue: 0.44))
                    .offset(x: -108)
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    model.route = .today
                    model.selectedDate = TodayView.currentDate(timeZone: model.preferences.timeZone)
                } label: {
                    Image(systemName: "house")
                }
                .help("오늘")
            }
            ToolbarItem(placement: .primaryAction) {
                Button { model.requestNewTask() } label: {
                    Image(systemName: "plus")
                }
                .keyboardShortcut("n", modifiers: .command)
                .help("새 할 일 (⌘N)")
            }
            ToolbarItem(placement: .primaryAction) {
                Button { model.searchPresented = true } label: {
                    Image(systemName: "magnifyingglass")
                }
                .keyboardShortcut("k", modifiers: .command)
                .help("검색 (⌘K)")
            }
            }
        }
    }

    private var sidebar: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 9) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 7)
                                .stroke(Color(red: 0.26, green: 0.37, blue: 0.30), lineWidth: 1.2)
                                .frame(width: 24, height: 24)
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Theme.accent)
                        }
                        .rotationEffect(.degrees(-6))
                        Text("todo")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .tracking(-0.7)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 15)
                    .padding(.top, 5)
                    .padding(.bottom, 25)

                    sidebarSectionLabel("WORKSPACE")
                    ForEach(AppRoute.allCases) { route in
                        sidebarRoute(route)
                    }

                    if !model.categoryNames.isEmpty {
                        Rectangle().fill(Theme.separator).frame(height: 1)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 17)
                        sidebarSectionLabel("MY AREAS")
                        ForEach(orderedCategoryNames, id: \.self) { category in
                            let color = model.preferences.taskCategories.first(where: { $0.name == category }).map { areaColor($0.color) } ?? Theme.accent
                            sidebarArea(category, color: color, selected: model.selectedCategoryFilter == category) {
                                model.toggleCategoryFilter(category)
                            }
                        }
                    }
                }
                .padding(.horizontal, 11)
                .padding(.top, 22)
                .padding(.bottom, 18)
            }
            .scrollContentBackground(.hidden)

            Divider()
            Button {
                model.dismissInspector()
                settingsPresented = true
            } label: {
                HStack(spacing: 9) {
                    Text("S")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color(red: 0.37, green: 0.45, blue: 0.39))
                        .frame(width: 27, height: 27)
                        .background(Theme.sageSelection, in: Circle())
                    Text("설정 · 내 공간")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.secondary)
                    Spacer(minLength: 0)
                    Image(systemName: "gearshape")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.secondary)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .background(Theme.sidebar)
        .overlay {
            if settingsPresented || model.inspectorPresented {
                Color.black.opacity(0.13)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        settingsPresented = false
                        model.dismissInspector()
                    }
            }
        }
    }

    private func sidebarSectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 9, weight: .semibold))
            .tracking(1.1)
            .foregroundStyle(Color(red: 0.62, green: 0.66, blue: 0.62))
            .padding(.horizontal, 15)
            .padding(.bottom, 8)
            .padding(.top, 1)
    }

    private func sidebarRoute(_ route: AppRoute) -> some View {
        Button {
            model.route = route
            model.selectedCategoryFilter = nil
        } label: {
            HStack(spacing: 11) {
                Image(systemName: route.symbol)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(model.route == route ? Theme.accent : Color.secondary)
                    .frame(width: 19)
                Text(route.title)
                    .font(.system(size: 12, weight: model.route == route ? .semibold : .regular))
                Spacer(minLength: 4)
                if let count = sidebarCount(for: route) {
                    Text("\(count)")
                        .font(.system(size: 9, design: .rounded).monospacedDigit())
                        .foregroundStyle(Color.secondary.opacity(0.7))
                }
            }
            .padding(.horizontal, 11)
            .frame(height: 36)
            .background(model.route == route ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 7))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func sidebarArea(_ title: String, color: Color, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Circle().fill(color.opacity(0.78)).frame(width: 7, height: 7)
                Text(title).font(.system(size: 11, weight: selected ? .medium : .regular))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .frame(height: 30)
            .background(selected ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 7))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
        let additional = model.categoryNames.filter { !configured.contains($0) }
        return configured + additional
    }

    private func areaColor(_ name: String) -> Color {
        switch name {
        case "amber": Color(red: 0.82, green: 0.68, blue: 0.48)
        case "blue", "arctic", "apple-blue": Theme.blue
        case "violet": Color(red: 0.63, green: 0.60, blue: 0.74)
        case "coral": Color(red: 0.79, green: 0.56, blue: 0.52)
        case "rose": Color(red: 0.75, green: 0.57, blue: 0.64)
        default: Theme.accent
        }
    }

    @ViewBuilder
    private var routeContent: some View {
        Group {
            switch model.route {
            case .today:
                TodayView(model: model, repository: model.repository)
            case .progress:
                ProgressGalleryView(model: model, repository: model.repository)
            case .calendar:
                CalendarView(model: model, repository: model.repository)
            }
        }
    }

    private var editorPresentationBinding: Binding<Bool> {
        Binding(
            get: { model.editorPresented },
            set: { if !$0 { model.clearEditorRequest() } }
        )
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
}

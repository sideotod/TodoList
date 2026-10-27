import SwiftUI

private struct TodoListWindowModelKey: FocusedValueKey {
    typealias Value = WindowModel
}

extension FocusedValues {
    var todoListWindowModel: WindowModel? {
        get { self[TodoListWindowModelKey.self] }
        set { self[TodoListWindowModelKey.self] = newValue }
    }
}

struct AppCommands: Commands {
    @FocusedValue(\.todoListWindowModel) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("새 할 일") { model?.requestNewTask() }
                .keyboardShortcut("n", modifiers: .command)
                .disabled(model == nil)
            Button("새 창") { openWindow(id: "main") }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            Divider()
            Button("검색") { model?.searchPresented = true }
                .keyboardShortcut("f", modifiers: .command)
                .disabled(model == nil)
            Divider()
            Button("오늘") { model?.route = .today; model?.selectedCategoryFilter = nil }
                .keyboardShortcut("1", modifiers: .command)
                .disabled(model == nil)
            Button("Progress") { model?.route = .progress; model?.selectedCategoryFilter = nil }
                .keyboardShortcut("2", modifiers: .command)
                .disabled(model == nil)
            Button("캘린더") { model?.route = .calendar; model?.selectedCategoryFilter = nil }
                .keyboardShortcut("3", modifiers: .command)
                .disabled(model == nil)
        }
        CommandGroup(replacing: .appSettings) {
            SettingsLink()
                .keyboardShortcut(",", modifiers: .command)
        }
        CommandGroup(after: .sidebar) {
            Button(model?.inspectorPresented == true ? "인스펙터 닫기" : "인스펙터 보기") {
                model?.inspectorPresented.toggle()
            }
            .keyboardShortcut("i", modifiers: [.command, .option])
            .disabled(model == nil || model?.selectedItem == nil)
        }
    }
}

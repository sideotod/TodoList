import SwiftUI

struct AppCommands: Commands {
    let model: AppModel

    var body: some Commands {
        CommandGroup(after: .newItem) {
            Button("새 할 일") { model.requestNewTask() }
                .keyboardShortcut("n", modifiers: .command)
            Button("검색") { model.searchPresented = true }
                .keyboardShortcut("k", modifiers: .command)
        }
        CommandGroup(replacing: .appSettings) {
            SettingsLink()
                .keyboardShortcut(",", modifiers: .command)
        }
        CommandMenu("보기") {
            Button("상세 닫기") { model.dismissInspector() }
                .keyboardShortcut(.escape, modifiers: [])
                .disabled(!model.inspectorPresented)
        }
    }
}

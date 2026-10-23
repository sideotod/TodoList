import SwiftUI

@main
struct TodoListApp: App {
    @State private var model = AppModel.bootstrap()

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .frame(minWidth: 860, minHeight: 620)
                .task {
                    await LegacyReminderCleanup.clearPendingRequests()
                    await model.load()
                }
        }
        .windowResizability(.contentSize)
        .commands { AppCommands(model: model) }

        Settings {
            SettingsView(model: model)
        }
    }
}

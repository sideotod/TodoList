import SwiftUI

@main
struct TodoListApp: App {
    @NSApplicationDelegateAdaptor(TodoListAppDelegate.self) private var appDelegate
    @State private var model = AppModel.bootstrap()

    var body: some Scene {
        WindowGroup(id: "main") {
            RootView(model: model, appDelegate: appDelegate)
                .frame(minWidth: 1000, minHeight: 700)
                .task {
                    await LegacyReminderCleanup.clearPendingRequests()
                    await model.loadIfNeeded()
                }
        }
        .defaultSize(width: 1150, height: 780)
        .windowResizability(.contentMinSize)
        .windowToolbarStyle(.unified)
        .commands { AppCommands() }

        Settings {
            SettingsView(model: model)
                .tint(Theme.accent)
                .preferredColorScheme(preferredColorScheme)
        }
        .windowResizability(.contentSize)
    }

    private var preferredColorScheme: ColorScheme? {
        switch model.preferences.appearance {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }
}

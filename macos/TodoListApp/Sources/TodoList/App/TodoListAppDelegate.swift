import AppKit

@MainActor
final class TodoListAppDelegate: NSObject, NSApplicationDelegate {
    var reopenMainWindow: (() -> Void)?

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        guard !hasVisibleWindows else { return false }
        reopenMainWindow?()
        return true
    }
}

import Foundation
import UserNotifications

/// Removes requests created by the retired reminder feature without asking for notification access.
@MainActor
enum LegacyReminderCleanup {
    private static let identifierPrefix = "com.sideotod.TodoList.reminder."

    static func clearPendingRequests() async {
        let center = UNUserNotificationCenter.current()
        let pendingIDs = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(identifierPrefix) }
        if !pendingIDs.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: pendingIDs)
        }

        let deliveredIDs = await center.deliveredNotifications()
            .map(\.request.identifier)
            .filter { $0.hasPrefix(identifierPrefix) }
        if !deliveredIDs.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: deliveredIDs)
        }
    }
}

import Foundation

struct LocalBackupV1: Codable, Sendable {
    var schemaVersion: Int
    var exportedAt: String
    var items: [CalendarItem]
    var taskOrders: [String: TaskOrderPreference]
    var reminderOffsets: [String: Int]
    var remindersEnabled: Bool
    var preferences: AppPreferences
}

enum BackupCodecError: Error, LocalizedError {
    case tooLarge
    case unsupportedFormat
    case duplicateItemID(String)
    case invalidItem(String, String)
    case invalidPreferences(String)
    case invalidTaskOrder(String)
    case invalidReminder(String)

    var errorDescription: String? {
        switch self {
        case .tooLarge: "백업 파일은 5 MiB 이하만 가져올 수 있습니다."
        case .unsupportedFormat: "지원하지 않는 JSON 백업 형식입니다."
        case let .duplicateItemID(id): "백업에 중복된 항목 ID가 있습니다: \(id)"
        case let .invalidItem(id, reason): "항목 \(id)를 가져올 수 없습니다: \(reason)"
        case let .invalidPreferences(reason): "백업의 설정을 가져올 수 없습니다: \(reason)"
        case let .invalidTaskOrder(date): "\(date) 날짜의 할 일 순서를 확인해 주세요."
        case let .invalidReminder(id): "\(id) 항목의 알림 설정을 확인해 주세요."
        }
    }
}

@MainActor
enum BackupCodec {
    static let maximumSize = 5 * 1024 * 1024

    static func decodeLocal(_ data: Data) throws -> LocalBackupV1 {
        guard data.count <= maximumSize else { throw BackupCodecError.tooLarge }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["schemaVersion"] as? Int == 1,
              object["items"] is [Any] else { throw BackupCodecError.unsupportedFormat }
        var backup: LocalBackupV1
        do {
            backup = try JSONDecoder().decode(LocalBackupV1.self, from: data)
        } catch {
            throw BackupCodecError.unsupportedFormat
        }
        var ids = Set<String>()
        for item in backup.items {
            guard ids.insert(item.id).inserted else { throw BackupCodecError.duplicateItemID(item.id) }
            do { try ItemValidator.validate(item) }
            catch { throw BackupCodecError.invalidItem(item.id, error.localizedDescription) }
        }
        do { try PreferencesStore.validate(backup.preferences) }
        catch { throw BackupCodecError.invalidPreferences(error.localizedDescription) }
        for (date, order) in backup.taskOrders {
            guard date == "undated" || validDate(date),
                  uniqueExistingTaskIDs(order.pending, items: backup.items),
                  uniqueExistingTaskIDs(order.completed, items: backup.items),
                  Set(order.pending).isDisjoint(with: order.completed) else {
                throw BackupCodecError.invalidTaskOrder(date)
            }
        }
        for (id, offset) in backup.reminderOffsets {
            guard ids.contains(id), [0, 10, 30, 60, 1_440].contains(offset) else {
                throw BackupCodecError.invalidReminder(id)
            }
        }
        backup.preferences.taskOrders = backup.taskOrders
        backup.preferences.reminderOffsets = backup.reminderOffsets
        backup.preferences.remindersEnabled = backup.remindersEnabled
        return backup
    }

    static func encodeLocal(items: [CalendarItem], preferences: AppPreferences, exportedAt: Date = Date()) throws -> Data {
        var unique = Set<String>()
        for item in items {
            try ItemValidator.validate(item)
            guard unique.insert(item.id).inserted else { throw BackupCodecError.duplicateItemID(item.id) }
        }
        try PreferencesStore.validate(preferences)
        let backup = LocalBackupV1(
            schemaVersion: 1,
            exportedAt: ISO8601DateFormatter.todoListTimestamp(for: exportedAt),
            items: items,
            taskOrders: preferences.taskOrders,
            reminderOffsets: preferences.reminderOffsets,
            remindersEnabled: preferences.remindersEnabled,
            preferences: preferences
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        let data = try encoder.encode(backup)
        guard data.count <= maximumSize else { throw BackupCodecError.tooLarge }
        return data
    }

    private static func uniqueExistingTaskIDs(_ ids: [String], items: [CalendarItem]) -> Bool {
        var unique = Set<String>()
        return ids.allSatisfy { id in
            unique.insert(id).inserted && items.contains { $0.id == id && $0.kind == .task }
        }
    }

    private static func validDate(_ value: String) -> Bool {
        TodayProjection.parseDate(value, timeZone: "UTC") != nil
    }
}

import Foundation

struct TaskCategoryPreference: Codable, Equatable, Sendable {
    var name: String
    var color: String
}

struct TaskOrderPreference: Codable, Equatable, Sendable {
    var pending: [String]
    var completed: [String]
}

struct CalendarLayerPreferences: Codable, Equatable, Sendable {
    var tasks: Bool
    var events: Bool
    var progress: Bool

    static let allVisible = CalendarLayerPreferences(tasks: true, events: true, progress: true)

    private enum CodingKeys: String, CodingKey { case tasks, events, progress }

    init(tasks: Bool, events: Bool, progress: Bool) {
        self.tasks = tasks
        self.events = events
        self.progress = progress
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        tasks = try values.decodeIfPresent(Bool.self, forKey: .tasks) ?? true
        events = try values.decodeIfPresent(Bool.self, forKey: .events) ?? true
        progress = try values.decodeIfPresent(Bool.self, forKey: .progress) ?? true
    }
}

struct VisibleHoursPreference: Codable, Equatable, Sendable {
    var start: Int
    var end: Int

    private enum CodingKeys: String, CodingKey { case start, end }

    init(start: Int, end: Int) {
        self.start = start
        self.end = end
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        start = try values.decodeIfPresent(Int.self, forKey: .start) ?? 6
        end = try values.decodeIfPresent(Int.self, forKey: .end) ?? 23
    }
}

struct AppPreferences: Codable, Equatable, Sendable {
    var version: Int
    var appearance: String
    var weekStartsOn: Int
    var timeFormat: String
    var timeZone: String
    var colorTheme: String
    var taskCategories: [TaskCategoryPreference]
    var calendarVisibility: CalendarLayerPreferences
    var visibleHours: VisibleHoursPreference
    var taskOrders: [String: TaskOrderPreference]
    var reminderOffsets: [String: Int]
    var remindersEnabled: Bool

    static let defaults = AppPreferences(
        version: 1,
        appearance: "system",
        weekStartsOn: 1,
        timeFormat: "24h",
        timeZone: "Asia/Seoul",
        colorTheme: "sage",
        taskCategories: [],
        calendarVisibility: .allVisible,
        visibleHours: VisibleHoursPreference(start: 6, end: 23),
        taskOrders: [:],
        reminderOffsets: [:],
        remindersEnabled: false
    )

    private enum CodingKeys: String, CodingKey {
        case version, appearance, weekStartsOn, timeFormat, timeZone, colorTheme, taskCategories
        case calendarVisibility, visibleHours, taskOrders, reminderOffsets, remindersEnabled
    }

    init(
        version: Int = 1,
        appearance: String = "system",
        weekStartsOn: Int = 1,
        timeFormat: String = "24h",
        timeZone: String = "Asia/Seoul",
        colorTheme: String = "sage",
        taskCategories: [TaskCategoryPreference] = [],
        calendarVisibility: CalendarLayerPreferences = .allVisible,
        visibleHours: VisibleHoursPreference = VisibleHoursPreference(start: 6, end: 23),
        taskOrders: [String: TaskOrderPreference] = [:],
        reminderOffsets: [String: Int] = [:],
        remindersEnabled: Bool = false
    ) {
        self.version = version
        self.appearance = appearance
        self.weekStartsOn = weekStartsOn
        self.timeFormat = timeFormat
        self.timeZone = timeZone
        self.colorTheme = colorTheme
        self.taskCategories = taskCategories
        self.calendarVisibility = calendarVisibility
        self.visibleHours = visibleHours
        self.taskOrders = taskOrders
        self.reminderOffsets = reminderOffsets
        self.remindersEnabled = remindersEnabled
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        version = try values.decodeIfPresent(Int.self, forKey: .version) ?? 1
        appearance = try values.decodeIfPresent(String.self, forKey: .appearance) ?? "system"
        weekStartsOn = try values.decodeIfPresent(Int.self, forKey: .weekStartsOn) ?? 1
        timeFormat = try values.decodeIfPresent(String.self, forKey: .timeFormat) ?? "24h"
        timeZone = try values.decodeIfPresent(String.self, forKey: .timeZone) ?? "Asia/Seoul"
        colorTheme = try values.decodeIfPresent(String.self, forKey: .colorTheme) ?? "sage"
        taskCategories = try values.decodeIfPresent([TaskCategoryPreference].self, forKey: .taskCategories) ?? []
        calendarVisibility = try values.decodeIfPresent(CalendarLayerPreferences.self, forKey: .calendarVisibility) ?? .allVisible
        visibleHours = try values.decodeIfPresent(VisibleHoursPreference.self, forKey: .visibleHours) ?? VisibleHoursPreference(start: 6, end: 23)
        taskOrders = try values.decodeIfPresent([String: TaskOrderPreference].self, forKey: .taskOrders) ?? [:]
        reminderOffsets = try values.decodeIfPresent([String: Int].self, forKey: .reminderOffsets) ?? [:]
        remindersEnabled = try values.decodeIfPresent(Bool.self, forKey: .remindersEnabled) ?? false
    }
}

@MainActor
final class PreferencesStore {
    private let defaults: UserDefaults
    private let storageKey: String

    init(defaults: UserDefaults = .standard, storageKey: String = "todolist.preferences.v1") {
        self.defaults = defaults
        self.storageKey = storageKey
    }

    func load() throws -> AppPreferences {
        guard let data = defaults.data(forKey: storageKey) else { return .defaults }
        let envelope = try JSONDecoder().decode(VersionedPreferences.self, from: data)
        guard envelope.version == 1, envelope.preferences.version == 1 else {
            throw PreferencesStoreError.unsupportedVersion(envelope.version)
        }
        try Self.validate(envelope.preferences)
        return envelope.preferences
    }

    func save(_ preferences: AppPreferences) throws {
        try Self.validate(preferences)
        let envelope = VersionedPreferences(version: 1, preferences: preferences)
        defaults.set(try JSONEncoder().encode(envelope), forKey: storageKey)
    }

    static func validate(_ preferences: AppPreferences) throws {
        guard ["system", "light", "dark"].contains(preferences.appearance) else { throw PreferencesStoreError.invalidValue("appearance") }
        guard preferences.weekStartsOn == 0 || preferences.weekStartsOn == 1 else { throw PreferencesStoreError.invalidValue("weekStartsOn") }
        guard ["12h", "24h"].contains(preferences.timeFormat) else { throw PreferencesStoreError.invalidValue("timeFormat") }
        guard preferences.timeZone.utf16.count <= 64, TimeZone(identifier: preferences.timeZone) != nil else { throw PreferencesStoreError.invalidValue("timeZone") }
        guard ["sage", "arctic", "rose", "amber", "apple-blue"].contains(preferences.colorTheme) else { throw PreferencesStoreError.invalidValue("colorTheme") }
        guard (0...23).contains(preferences.visibleHours.start), (1...24).contains(preferences.visibleHours.end),
              preferences.visibleHours.start < preferences.visibleHours.end else { throw PreferencesStoreError.invalidValue("visibleHours") }
        let categoryNames = preferences.taskCategories.map { $0.name.lowercased() }
        guard preferences.taskCategories.allSatisfy({
            !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.name.utf16.count <= 64 && Self.validCategoryColor($0.color)
        }), Set(categoryNames).count == categoryNames.count else { throw PreferencesStoreError.invalidValue("taskCategories") }
        guard preferences.reminderOffsets.values.allSatisfy({ [0, 10, 30, 60, 1440].contains($0) }) else { throw PreferencesStoreError.invalidValue("reminderOffsets") }
    }

    private static func validCategoryColor(_ color: String) -> Bool {
        ["teal", "amber", "blue", "violet", "coral", "sage"].contains(color)
            || color.range(of: #"^#[0-9a-fA-F]{6}$"#, options: .regularExpression) != nil
    }
}

private struct VersionedPreferences: Codable {
    var version: Int
    var preferences: AppPreferences
}

enum PreferencesStoreError: Error, LocalizedError {
    case unsupportedVersion(Int)
    case invalidValue(String)

    var errorDescription: String? {
        switch self {
        case let .unsupportedVersion(version): "Unsupported preferences version: \(version)."
        case let .invalidValue(field): "Invalid preferences value: \(field)."
        }
    }
}

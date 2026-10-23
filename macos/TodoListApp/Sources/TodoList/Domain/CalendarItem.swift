import Foundation

enum ItemKind: String, Codable, CaseIterable, Sendable {
    case event
    case task
    case deadline
    case window
}

enum ItemCompletion: String, Codable, Sendable {
    case pending
    case completed
}

enum PeriodFocus: String, Codable, Sendable {
    case start
    case deadline
}

struct ChecklistRow: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var title: String
    var completed: Bool
    var linkedTaskId: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, completed, linkedTaskId
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(completed, forKey: .completed)
        try container.encodeIfPresent(linkedTaskId, forKey: .linkedTaskId)
    }
}

struct CountdownSettings: Codable, Hashable, Sendable {
    var enabled: Bool
    var daysBefore: Int
}

struct EventCountdown: Codable, Hashable, Sendable {
    var enabled: Bool
    var daysBefore: Int
    var reference: Reference

    enum Reference: String, Codable, Sendable {
        case start
        case end
    }
}

struct WeeklyRecurrence: Hashable, Sendable, Codable {
    var frequency: Frequency = .weekly
    var daysOfWeek: [Int]
    var untilDate: String?

    enum Frequency: String, Codable, Sendable {
        case weekly
    }

    private enum CodingKeys: String, CodingKey {
        case frequency, daysOfWeek, untilDate
    }

    init(frequency: Frequency = .weekly, daysOfWeek: [Int], untilDate: String?) {
        self.frequency = frequency
        self.daysOfWeek = daysOfWeek
        self.untilDate = untilDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        frequency = try container.decode(Frequency.self, forKey: .frequency)
        daysOfWeek = try container.decode([Int].self, forKey: .daysOfWeek)
        guard container.contains(.untilDate) else {
            throw DecodingError.keyNotFound(CodingKeys.untilDate, .init(codingPath: decoder.codingPath, debugDescription: "untilDate is required and may be null."))
        }
        untilDate = try container.decodeIfPresent(String.self, forKey: .untilDate)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(frequency, forKey: .frequency)
        try container.encode(daysOfWeek, forKey: .daysOfWeek)
        try container.encode(untilDate, forKey: .untilDate)
    }
}

struct ImportSource: Codable, Hashable, Sendable {
    var uid: String
    var occurrenceKey: String
    var componentFingerprint: String
}

struct CalendarItem: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var kind: ItemKind
    var title: String
    var category: String?
    var categoryColor: String?
    var notes: String?
    var sourceUrl: String?
    var importSource: ImportSource?
    var timing: ItemTiming
    var completion: ItemCompletion?
    var checklist: [ChecklistRow]?
    var countdown: EventCountdown?
    var showInProgressSummary: Bool?
    var recurrence: WeeklyRecurrence?
    var startCountdown: CountdownSettings?
    var focus: PeriodFocus?
    var revision: Int?
    var updatedAt: String?
    var deletedAt: String?
    var lastMutationId: String?
    var lastMutationDigest: String?

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, category, categoryColor, notes, sourceUrl, importSource
        case timing, completion, checklist, countdown, showInProgressSummary, recurrence
        case startCountdown, focus, revision, updatedAt, deletedAt, lastMutationId, lastMutationDigest
    }

    init(
        id: String,
        kind: ItemKind,
        title: String,
        category: String? = nil,
        categoryColor: String? = nil,
        notes: String? = nil,
        sourceUrl: String? = nil,
        importSource: ImportSource? = nil,
        timing: ItemTiming,
        completion: ItemCompletion? = nil,
        checklist: [ChecklistRow]? = nil,
        countdown: EventCountdown? = nil,
        showInProgressSummary: Bool? = nil,
        recurrence: WeeklyRecurrence? = nil,
        startCountdown: CountdownSettings? = nil,
        focus: PeriodFocus? = nil,
        revision: Int? = nil,
        updatedAt: String? = nil,
        deletedAt: String? = nil,
        lastMutationId: String? = nil,
        lastMutationDigest: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.category = category
        self.categoryColor = categoryColor
        self.notes = notes
        self.sourceUrl = sourceUrl
        self.importSource = importSource
        self.timing = timing
        self.completion = completion
        self.checklist = checklist
        self.countdown = countdown
        self.showInProgressSummary = showInProgressSummary
        self.recurrence = recurrence
        self.startCountdown = startCountdown
        self.focus = focus
        self.revision = revision
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.lastMutationId = lastMutationId
        self.lastMutationDigest = lastMutationDigest
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        kind = try container.decode(ItemKind.self, forKey: .kind)
        title = try container.decode(String.self, forKey: .title)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        categoryColor = try container.decodeIfPresent(String.self, forKey: .categoryColor)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl)
        importSource = try container.decodeIfPresent(ImportSource.self, forKey: .importSource)
        timing = try container.decode(ItemTiming.self, forKey: .timing)
        completion = try container.decodeIfPresent(ItemCompletion.self, forKey: .completion)
        checklist = try container.decodeIfPresent([ChecklistRow].self, forKey: .checklist)
        countdown = try container.decodeIfPresent(EventCountdown.self, forKey: .countdown)
        showInProgressSummary = try container.decodeIfPresent(Bool.self, forKey: .showInProgressSummary)
        recurrence = try container.decodeIfPresent(WeeklyRecurrence.self, forKey: .recurrence)
        startCountdown = try container.decodeIfPresent(CountdownSettings.self, forKey: .startCountdown)
        focus = try container.decodeIfPresent(PeriodFocus.self, forKey: .focus)
        revision = try container.decodeIfPresent(Int.self, forKey: .revision)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        deletedAt = try container.decodeIfPresent(String.self, forKey: .deletedAt)
        lastMutationId = try container.decodeIfPresent(String.self, forKey: .lastMutationId)
        lastMutationDigest = try container.decodeIfPresent(String.self, forKey: .lastMutationDigest)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(kind, forKey: .kind)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(category, forKey: .category)
        try container.encodeIfPresent(categoryColor, forKey: .categoryColor)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encodeIfPresent(sourceUrl, forKey: .sourceUrl)
        try container.encodeIfPresent(importSource, forKey: .importSource)
        try container.encode(timing, forKey: .timing)
        try container.encodeIfPresent(completion, forKey: .completion)
        if let checklist {
            try container.encode(checklist, forKey: .checklist)
        } else if kind == .deadline || kind == .window {
            try container.encodeNil(forKey: .checklist)
        }
        try container.encodeIfPresent(countdown, forKey: .countdown)
        try container.encodeIfPresent(showInProgressSummary, forKey: .showInProgressSummary)
        try container.encodeIfPresent(recurrence, forKey: .recurrence)
        if let startCountdown {
            try container.encode(startCountdown, forKey: .startCountdown)
        } else if kind == .deadline || kind == .window {
            try container.encodeNil(forKey: .startCountdown)
        }
        try container.encodeIfPresent(focus, forKey: .focus)
        try container.encodeIfPresent(revision, forKey: .revision)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        // Canonical records include an explicit null tombstone; proposals strip server metadata.
        try container.encode(deletedAt, forKey: .deletedAt)
        try container.encodeIfPresent(lastMutationId, forKey: .lastMutationId)
        try container.encodeIfPresent(lastMutationDigest, forKey: .lastMutationDigest)
    }
}

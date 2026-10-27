import Foundation

struct ItemEditorContext: Equatable, Sendable {
    var dateOnly: String?
    var startInstant: String?
    var timeZone: String
    var weekStartsOn: Int = 0
}

enum ItemTimingMode: String, CaseIterable, Identifiable {
    case date
    case time
    case unscheduled

    var id: String { rawValue }

    var title: String {
        switch self {
        case .date: "날짜"
        case .time: "날짜와 시간"
        case .unscheduled: "날짜 미정"
        }
    }
}

struct ItemEditorDraft {
    private let initialDate: String
    var id: String?
    var kind: ItemKind
    var title: String
    var category: String
    var categoryColor: String
    var notes: String
    var sourceUrl: String
    var timeZone: String
    var timingMode: ItemTimingMode
    var startDate: String
    var endDate: String
    var startAt: String
    var endAt: String
    var hasPeriodStart: Bool
    var hasPeriodEnd: Bool
    var completion: ItemCompletion
    var checklist: [ChecklistRow]
    var startCountdownEnabled: Bool
    var startCountdownDays: Int
    var eventCountdownEnabled: Bool
    var eventCountdownDays: Int
    var eventCountdownReference: EventCountdown.Reference
    var isRecurring: Bool
    var recurrenceDays: Set<Int>
    var recurrenceUntilDate: String
    var showInProgressSummary: Bool
    var focus: PeriodFocus
    var revision: Int?
    var updatedAt: String?
    var deletedAt: String?
    var lastMutationId: String?
    var lastMutationDigest: String?
    var importSource: ImportSource?

    init(item: CalendarItem?, defaultKind: ItemKind, context: ItemEditorContext) {
        initialDate = context.dateOnly ?? Self.today(in: context.timeZone)
        id = item?.id
        kind = item?.kind ?? defaultKind
        title = item?.title ?? ""
        category = item?.category ?? ""
        categoryColor = item?.categoryColor ?? "teal"
        notes = item?.notes ?? ""
        sourceUrl = item?.sourceUrl ?? ""
        timeZone =
            switch item?.timing {
            case .date(_, _, let zone), .time(_, _, let zone): zone
            case .unscheduled, nil: context.timeZone
            }
        completion = item?.completion ?? .pending
        checklist = item?.checklist ?? []
        startCountdownEnabled = item?.startCountdown?.enabled ?? true
        startCountdownDays = item?.startCountdown?.daysBefore ?? 1
        eventCountdownEnabled = item?.countdown?.enabled ?? false
        eventCountdownDays = item?.countdown?.daysBefore ?? 1
        eventCountdownReference = item?.countdown?.reference ?? .start
        isRecurring = item?.recurrence != nil
        recurrenceDays = Set(item?.recurrence?.daysOfWeek ?? [])
        recurrenceUntilDate = item?.recurrence?.untilDate ?? ""
        showInProgressSummary = item?.showInProgressSummary ?? false
        focus = item?.focus ?? .deadline
        revision = item?.revision
        updatedAt = item?.updatedAt
        deletedAt = item?.deletedAt
        lastMutationId = item?.lastMutationId
        lastMutationDigest = item?.lastMutationDigest
        importSource = item?.importSource

        switch item?.timing {
        case .date(let startDate, let endDate, _):
            timingMode = .date
            self.startDate = startDate ?? ""
            self.endDate = endDate
            startAt = ""
            endAt = ""
            hasPeriodStart = startDate != nil
            hasPeriodEnd = true
        case .time(let startAt, let endAt, _):
            timingMode = .time
            self.startAt = startAt ?? ""
            self.endAt = endAt ?? ""
            startDate = ""
            endDate = ""
            hasPeriodStart = startAt != nil
            hasPeriodEnd = endAt != nil
        case .unscheduled:
            timingMode = .unscheduled
            startDate = ""
            endDate = ""
            startAt = ""
            endAt = ""
            hasPeriodStart = false
            hasPeriodEnd = false
        case nil:
            let date = context.dateOnly ?? Self.today(in: context.timeZone)
            timingMode = .date
            startDate = defaultKind == .event || defaultKind == .window ? date : ""
            endDate = date
            startAt = context.startInstant ?? ""
            endAt = ""
            hasPeriodStart = defaultKind == .event || defaultKind == .window
            hasPeriodEnd = false
            if context.startInstant != nil {
                timingMode = .time
                hasPeriodStart = defaultKind != .task && defaultKind != .deadline
                if defaultKind == .task { hasPeriodStart = false }
                if defaultKind == .task || defaultKind == .deadline {
                    endAt = context.startInstant ?? ""
                    startAt = ""
                    hasPeriodEnd = true
                }
            }
        }
        if recurrenceDays.isEmpty, let date = context.dateOnly {
            recurrenceDays = [Self.weekday(date, timeZone: context.timeZone) ?? 1]
        }
        ensureTimingDefaults()
    }

    mutating func changeKind(to newKind: ItemKind) {
        kind = newKind
        switch newKind {
        case .event:
            if timingMode == .unscheduled { timingMode = .date }
            hasPeriodStart = true
        case .task:
            if timingMode == .unscheduled { return }
            hasPeriodStart = false
        case .deadline:
            if timingMode == .unscheduled { timingMode = .date }
        case .window:
            if timingMode == .unscheduled { timingMode = .date }
            hasPeriodStart = true
        }
        ensureTimingDefaults()
    }

    mutating func changeTimingMode(to mode: ItemTimingMode) {
        let previous = timingMode
        if previous == .time && mode == .date {
            startDate = TodayProjection.localDate(startAt, zone: timeZone) ?? endDate
            if (kind == .event || kind == .window) && !hasPeriodEnd {
                endDate = startDate
            } else if kind == .event || kind == .window,
                let end = ISO8601DateFormatter.todoListDate(from: endAt)
            {
                // Timed ranges exclude their end; date ranges include their final day.
                endDate = TodayProjection.localDate(ISO8601DateFormatter.todoListTimestamp(for: end.addingTimeInterval(-0.001)), zone: timeZone) ?? startDate
            } else {
                endDate = TodayProjection.localDate(endAt, zone: timeZone) ?? startDate
            }
        } else if previous != .time && mode == .time {
            let firstDate = TodayProjection.parseDate(startDate, timeZone: timeZone) == nil ? endDate : startDate
            startAt = instant(on: firstDate, preserving: startAt, defaultHour: kind == .deadline ? 8 : 9)
            endAt = instant(on: endDate, preserving: endAt, defaultHour: kind == .event || kind == .window ? 10 : 9)
        }
        timingMode = mode
        ensureTimingDefaults()
    }

    /// Seed the exact values rendered by DatePicker; never leave display-only fallbacks.
    mutating func ensureTimingDefaults() {
        guard timingMode != .unscheduled else { return }
        if TodayProjection.parseDate(endDate, timeZone: timeZone) == nil {
            endDate = TodayProjection.localDate(endAt, zone: timeZone) ?? TodayProjection.localDate(startAt, zone: timeZone) ?? initialDate
        }
        if TodayProjection.parseDate(startDate, timeZone: timeZone) == nil {
            startDate = TodayProjection.localDate(startAt, zone: timeZone) ?? endDate
        }
        guard timingMode == .time else { return }
        if ISO8601DateFormatter.todoListDate(from: startAt) == nil {
            if let end = ISO8601DateFormatter.todoListDate(from: endAt) {
                startAt = ISO8601DateFormatter.todoListTimestamp(for: end.addingTimeInterval(-3600))
            } else {
                startAt = instant(on: startDate, preserving: "", defaultHour: kind == .deadline ? 8 : 9)
            }
        }
        if ISO8601DateFormatter.todoListDate(from: endAt) == nil {
            if kind == .event || kind == .window, startDate == endDate,
                let start = ISO8601DateFormatter.todoListDate(from: startAt)
            {
                endAt = ISO8601DateFormatter.todoListTimestamp(for: start.addingTimeInterval(3600))
            } else {
                endAt = instant(on: endDate, preserving: "", defaultHour: 9)
            }
        }
    }

    private func instant(on date: String, preserving value: String, defaultHour: Int) -> String {
        guard let day = TodayProjection.parseDate(date, timeZone: timeZone) ?? TodayProjection.parseDate(initialDate, timeZone: timeZone) else { return value }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        let original = ISO8601DateFormatter.todoListDate(from: value)
        let hour = original.map { calendar.component(.hour, from: $0) } ?? defaultHour
        let minute = original.map { calendar.component(.minute, from: $0) } ?? 0
        guard let instant = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) else { return value }
        return ISO8601DateFormatter.todoListTimestamp(for: instant)
    }

    func makeItem() -> CalendarItem {
        let timing: ItemTiming
        switch timingMode {
        case .unscheduled:
            timing = .unscheduled
        case .date:
            let start: String? = kind == .task ? nil : (hasPeriodStart ? nonEmpty(startDate) : nil)
            timing = .date(startDate: start, endDate: endDate, timeZone: timeZone)
        case .time:
            let start: String? = kind == .task ? nil : (hasPeriodStart ? nonEmpty(startAt) : nil)
            let end: String? = hasPeriodEnd ? nonEmpty(endAt) : (kind == .task || kind == .deadline ? nonEmpty(endAt) : nil)
            timing = .time(startAt: start, endAt: end, timeZone: timeZone)
        }
        let isPeriod = kind == .deadline || kind == .window
        let hasTimingStart =
            switch timing {
            case .unscheduled: false
            case .date(let start, _, _): start != nil
            case .time(let start, _, _): start != nil
            }
        let recurrence =
            kind == .event && isRecurring
            ? WeeklyRecurrence(daysOfWeek: recurrenceDays.sorted(), untilDate: nonEmpty(recurrenceUntilDate))
            : nil
        return CalendarItem(
            id: id ?? UUID().uuidString.lowercased(),
            kind: kind,
            title: title,
            category: nonEmpty(category),
            categoryColor: nonEmpty(category).map { _ in categoryColor },
            notes: nonEmpty(notes),
            sourceUrl: nonEmpty(sourceUrl),
            importSource: importSource,
            timing: timing,
            completion: kind == .event ? nil : completion,
            checklist: isPeriod ? checklist : nil,
            countdown: kind == .event && eventCountdownEnabled
                ? EventCountdown(enabled: true, daysBefore: eventCountdownDays, reference: eventCountdownReference)
                : nil,
            showInProgressSummary: kind == .event ? showInProgressSummary : nil,
            recurrence: recurrence,
            startCountdown: isPeriod && (kind == .window || hasTimingStart)
                ? CountdownSettings(enabled: startCountdownEnabled, daysBefore: startCountdownDays)
                : nil,
            focus: isPeriod ? focus : nil,
            revision: revision,
            updatedAt: updatedAt,
            deletedAt: deletedAt,
            lastMutationId: lastMutationId,
            lastMutationDigest: lastMutationDigest
        )
    }

    private static func today(in timeZone: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private static func weekday(_ date: String, timeZone: String) -> Int? {
        guard let value = TodayProjection.parseDate(date, timeZone: timeZone) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        return calendar.component(.weekday, from: value) - 1
    }

    private func nonEmpty(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

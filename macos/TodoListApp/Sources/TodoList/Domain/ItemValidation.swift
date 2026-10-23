import Foundation

enum ItemValidationError: Error, LocalizedError, Equatable {
    case invalid(path: String, reason: String)

    var errorDescription: String? {
        switch self {
        case let .invalid(path, reason): "\(path): \(reason)"
        }
    }
}

enum ItemValidator {
    static func validate(_ item: CalendarItem) throws {
        func reject(_ path: String, _ reason: String) throws -> Never {
            throw ItemValidationError.invalid(path: path, reason: reason)
        }
        func nonEmpty(_ value: String) -> Bool { !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        func isDateOnly(_ value: String) -> Bool {
            let parts = value.split(separator: "-", omittingEmptySubsequences: false)
            guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
                  let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
                  (1...12).contains(month) else { return false }
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0)!
            var components = DateComponents()
            components.year = year
            components.month = month
            components.day = day
            guard let date = calendar.date(from: components) else { return false }
            let result = calendar.dateComponents([.year, .month, .day], from: date)
            return result.year == year && result.month == month && result.day == day
        }
        func isUTCInstant(_ value: String) -> Bool {
            guard value.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"#, options: .regularExpression) != nil else { return false }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard let date = formatter.date(from: value) else { return false }
            return formatter.string(from: date) == value
        }
        func validTimeZone(_ value: String) -> Bool {
            value.count <= 64 && !value.hasPrefix("+") && !value.hasPrefix("-") && TimeZone(identifier: value) != nil
        }

        guard nonEmpty(item.id) else { try reject("id", "A non-empty stable identifier is required.") }
        guard nonEmpty(item.title), item.title.utf16.count <= 200 else { try reject("title", "Title must be non-empty and at most 200 UTF-16 code units.") }
        if let category = item.category, category.utf16.count > 64 { try reject("category", "Category is limited to 64 UTF-16 code units.") }
        if let notes = item.notes, notes.utf16.count > 10_000 { try reject("notes", "Notes are limited to 10,000 UTF-16 code units.") }
        if let urlString = item.sourceUrl {
            guard urlString.utf16.count <= 2_048,
                  let url = URL(string: urlString),
                  let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
                  url.host != nil else { try reject("sourceUrl", "URL must be an absolute HTTP or HTTPS address under 2,048 characters.") }
        }
        if let color = item.categoryColor {
            let names = ["teal", "amber", "blue", "violet", "coral", "sage"]
            let customColor = color.range(of: #"^#[0-9a-fA-F]{6}$"#, options: .regularExpression) != nil
            guard names.contains(color) || customColor else { try reject("categoryColor", "Unsupported category color.") }
        }
        if let importSource = item.importSource,
           !nonEmpty(importSource.uid) || !nonEmpty(importSource.occurrenceKey) || !nonEmpty(importSource.componentFingerprint) {
            try reject("importSource", "Import source identifiers must not be empty.")
        }
        if let revision = item.revision, revision < 1 { try reject("revision", "Revision must be a positive integer.") }
        if let updatedAt = item.updatedAt, !isUTCInstant(updatedAt) { try reject("updatedAt", "Expected a millisecond UTC ISO instant.") }
        if let deletedAt = item.deletedAt, !isUTCInstant(deletedAt) { try reject("deletedAt", "Expected a millisecond UTC ISO instant or null.") }
        if let operationId = item.lastMutationId, !nonEmpty(operationId) { try reject("lastMutationId", "Mutation ID must not be empty.") }
        if let digest = item.lastMutationDigest,
           digest.range(of: #"^[a-f0-9]{64}$"#, options: .regularExpression) == nil {
            try reject("lastMutationDigest", "Expected 64 lowercase hexadecimal characters.")
        }

        let timingStart: String?
        let timingEnd: String?
        switch item.timing {
        case .unscheduled:
            guard item.kind == .task else { try reject("timing", "Only tasks may be unscheduled.") }
            timingStart = nil
            timingEnd = nil
        case let .date(startDate, endDate, timeZone):
            guard isDateOnly(endDate) else { try reject("timing.endDate", "Expected a valid YYYY-MM-DD date.") }
            if let startDate, !isDateOnly(startDate) { try reject("timing.startDate", "Expected a valid YYYY-MM-DD date or null.") }
            if let startDate, startDate > endDate { try reject("timing", "Start date must not be after end date.") }
            guard validTimeZone(timeZone) else { try reject("timing.timeZone", "Expected a valid IANA time zone.") }
            if (item.kind == .event || item.kind == .window) && startDate == nil {
                try reject("timing.startDate", "This item kind requires a start date.")
            }
            if item.kind == .task && startDate != nil { try reject("timing.startDate", "Tasks cannot have a range start.") }
            timingStart = startDate
            timingEnd = endDate
        case let .time(startAt, endAt, timeZone):
            if let startAt, !isUTCInstant(startAt) { try reject("timing.startAt", "Expected a millisecond UTC ISO instant or null.") }
            if let endAt, !isUTCInstant(endAt) { try reject("timing.endAt", "Expected a millisecond UTC ISO instant or null.") }
            guard validTimeZone(timeZone) else { try reject("timing.timeZone", "Expected a valid IANA time zone.") }
            if (item.kind == .event || item.kind == .window) && startAt == nil { try reject("timing.startAt", "This item kind requires a start instant.") }
            if (item.kind == .task || item.kind == .deadline) && endAt == nil { try reject("timing.endAt", "This item kind requires an end instant.") }
            if item.kind == .task && startAt != nil { try reject("timing.startAt", "Tasks cannot have a range start.") }
            if let startAt, let endAt, startAt >= endAt { try reject("timing", "Timed end must be after start.") }
            timingStart = startAt
            timingEnd = endAt
        }

        if item.kind == .event {
            guard item.completion == nil, item.checklist == nil, item.startCountdown == nil, item.focus == nil else {
                try reject("kind", "Events cannot contain completion or period fields.")
            }
            if let countdown = item.countdown {
                guard (0...30).contains(countdown.daysBefore) else { try reject("countdown.daysBefore", "Countdown must be 0 through 30 days.") }
                if countdown.reference == .end, case .time(_, nil, _) = item.timing { try reject("countdown.reference", "An event without an end instant must count down to its start.") }
            }
            if let recurrence = item.recurrence {
                guard !recurrence.daysOfWeek.isEmpty, recurrence.daysOfWeek.count <= 7,
                      recurrence.daysOfWeek.allSatisfy({ (0...6).contains($0) }),
                      Set(recurrence.daysOfWeek).count == recurrence.daysOfWeek.count else {
                    try reject("recurrence.daysOfWeek", "Choose 1–7 distinct weekdays from Sunday 0 through Saturday 6.")
                }
                if let untilDate = recurrence.untilDate {
                    guard isDateOnly(untilDate) else { try reject("recurrence.untilDate", "Expected a valid YYYY-MM-DD date or null.") }
                    let localStart: String?
                    switch item.timing {
                    case let .date(start, _, _):
                        localStart = start
                    case let .time(start, _, zone):
                        if let start,
                           let date = ISO8601DateFormatter().date(from: start),
                           let timeZone = TimeZone(identifier: zone) {
                            let formatter = DateFormatter()
                            formatter.locale = Locale(identifier: "en_US_POSIX")
                            formatter.calendar = Calendar(identifier: .gregorian)
                            formatter.timeZone = timeZone
                            formatter.dateFormat = "yyyy-MM-dd"
                            localStart = formatter.string(from: date)
                        } else {
                            localStart = nil
                        }
                    case .unscheduled:
                        localStart = nil
                    }
                    if let localStart, untilDate < localStart { try reject("recurrence.untilDate", "Repeat end date must be on or after the start date.") }
                }
            }
        } else {
            guard let completion = item.completion else { try reject("completion", "Tasks and periods require a completion state.") }
            _ = completion
            guard item.countdown == nil, item.recurrence == nil, item.showInProgressSummary == nil else {
                try reject("kind", "Only events may contain event fields.")
            }
        }

        if item.kind == .deadline || item.kind == .window {
            guard let checklist = item.checklist else { try reject("checklist", "Periods require a checklist array.") }
            guard checklist.count <= 4 else { try reject("checklist", "A period may contain at most four checklist rows.") }
            var ids = Set<String>()
            for (index, row) in checklist.enumerated() {
                guard nonEmpty(row.id), ids.insert(row.id).inserted else { try reject("checklist.\(index).id", "Checklist IDs must be non-empty and unique.") }
                guard nonEmpty(row.title), row.title.utf16.count <= 200 else { try reject("checklist.\(index).title", "Checklist title must be non-empty and at most 200 characters.") }
                if let linkedTaskId = row.linkedTaskId, !nonEmpty(linkedTaskId) { try reject("checklist.\(index).linkedTaskId", "Linked task ID must not be empty.") }
            }
            let hasStart = timingStart != nil
            if item.kind == .window && !hasStart { try reject("timing", "A window requires a start.") }
            if hasStart {
                guard let countdown = item.startCountdown else { try reject("startCountdown", "A period with a start requires start countdown settings.") }
                guard (0...30).contains(countdown.daysBefore) else { try reject("startCountdown.daysBefore", "Countdown must be 0 through 30 days.") }
            } else if item.startCountdown != nil {
                try reject("startCountdown", "A deadline without a start cannot have start countdown settings.")
            }
            if item.kind == .window && item.startCountdown == nil { try reject("startCountdown", "Windows require start countdown settings.") }
        } else {
            guard item.checklist == nil, item.startCountdown == nil, item.focus == nil else {
                try reject("kind", "Only periods may contain checklist, focus, or start countdown fields.")
            }
        }

        _ = timingEnd
    }
}

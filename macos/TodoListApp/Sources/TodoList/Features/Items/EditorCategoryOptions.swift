import Foundation

struct EditorCategoryOption: Hashable, Identifiable {
    let name: String
    let color: String

    var id: String { name.folding(options: .caseInsensitive, locale: .current) }
}

enum EditorCategoryOptions {
    static func from(items: [CalendarItem], configuredCategories: [TaskCategoryPreference] = []) -> [EditorCategoryOption] {
        var options: [String: EditorCategoryOption] = [:]

        for category in configuredCategories {
            add(category.name, color: category.color, to: &options)
        }
        for item in items where item.deletedAt == nil {
            guard let name = item.category else { continue }
            add(name, color: item.categoryColor ?? "teal", to: &options)
        }

        return options.values.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private static func add(_ rawName: String, color: String, to options: inout [String: EditorCategoryOption]) {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let key = name.folding(options: .caseInsensitive, locale: .current)
        guard options[key] == nil else { return }
        options[key] = EditorCategoryOption(name: name, color: color)
    }
}

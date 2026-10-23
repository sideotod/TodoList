import Foundation

enum ItemCoding {
    static func encode(_ item: CalendarItem) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(item)
    }

    static func encodeProposal(_ item: CalendarItem) throws -> Data {
        try ItemValidator.validate(item)
        let canonical = try encode(item)
        guard var object = try JSONSerialization.jsonObject(with: canonical) as? [String: Any] else {
            throw ItemCodingError.expectedObject
        }
        ["revision", "updatedAt", "deletedAt", "lastMutationId", "lastMutationDigest"].forEach { object.removeValue(forKey: $0) }
        return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    static func decode(_ data: Data, validate: Bool = true) throws -> CalendarItem {
        let item = try JSONDecoder().decode(CalendarItem.self, from: data)
        if validate { try ItemValidator.validate(item) }
        return item
    }
}

enum ItemCodingError: Error, LocalizedError {
    case expectedObject

    var errorDescription: String? {
        "Calendar item JSON must be an object."
    }
}

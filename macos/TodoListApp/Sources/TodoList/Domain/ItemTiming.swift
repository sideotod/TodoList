import Foundation

enum ItemTiming: Hashable, Sendable, Codable {
    case unscheduled
    case date(startDate: String?, endDate: String, timeZone: String)
    case time(startAt: String?, endAt: String?, timeZone: String)

    private enum CodingKeys: String, CodingKey {
        case type, startDate, endDate, startAt, endAt, timeZone
    }

    private enum Kind: String, Codable {
        case unscheduled, date, time
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .type) {
        case .unscheduled:
            self = .unscheduled
        case .date:
            guard container.contains(.startDate), container.contains(.endDate) else {
                throw DecodingError.keyNotFound(CodingKeys.endDate, .init(codingPath: decoder.codingPath, debugDescription: "Date timing requires explicit startDate and endDate keys."))
            }
            self = .date(
                startDate: try container.decodeIfPresent(String.self, forKey: .startDate),
                endDate: try container.decode(String.self, forKey: .endDate),
                timeZone: try container.decode(String.self, forKey: .timeZone)
            )
        case .time:
            guard container.contains(.startAt), container.contains(.endAt) else {
                throw DecodingError.keyNotFound(CodingKeys.endAt, .init(codingPath: decoder.codingPath, debugDescription: "Time timing requires explicit startAt and endAt keys."))
            }
            self = .time(
                startAt: try container.decodeIfPresent(String.self, forKey: .startAt),
                endAt: try container.decodeIfPresent(String.self, forKey: .endAt),
                timeZone: try container.decode(String.self, forKey: .timeZone)
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .unscheduled:
            try container.encode(Kind.unscheduled, forKey: .type)
        case let .date(startDate, endDate, timeZone):
            try container.encode(Kind.date, forKey: .type)
            try container.encode(startDate, forKey: .startDate)
            try container.encode(endDate, forKey: .endDate)
            try container.encode(timeZone, forKey: .timeZone)
        case let .time(startAt, endAt, timeZone):
            try container.encode(Kind.time, forKey: .type)
            try container.encode(startAt, forKey: .startAt)
            try container.encode(endAt, forKey: .endAt)
            try container.encode(timeZone, forKey: .timeZone)
        }
    }
}

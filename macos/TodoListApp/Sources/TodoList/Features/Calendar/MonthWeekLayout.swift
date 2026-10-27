import Foundation

struct MonthWeekSegment: Identifiable {
    let id: String
    let item: CalendarItem
    let firstColumn: Int
    let lastColumn: Int
    let lane: Int
}

struct MonthWeekLayout {
    var segments: [MonthWeekSegment] = []

    init(dates: [String] = [], itemsByDate: [String: [CalendarItem]] = [:]) {
        struct Candidate {
            let id: String
            let item: CalendarItem
            var first: Int
            var last: Int
        }
        var candidates: [String: Candidate] = [:]
        for (column, date) in dates.enumerated() {
            for item in itemsByDate[date] ?? [] {
                let occurrence = item.recurrence == nil ? "" : (CalendarProjection.eventDateRange(item)?.start ?? date)
                let key = "\(item.id)|\(occurrence)"
                if var existing = candidates[key] {
                    existing.last = column
                    candidates[key] = existing
                } else {
                    candidates[key] = Candidate(id: key, item: item, first: column, last: column)
                }
            }
        }
        let ordered = candidates.values.sorted {
            if $0.first != $1.first { return $0.first < $1.first }
            if $0.last != $1.last { return $0.last > $1.last }
            return $0.id < $1.id
        }
        var laneMasks: [Int] = []
        for candidate in ordered {
            let mask = (candidate.first...candidate.last).reduce(0) { $0 | (1 << $1) }
            var lane = 0
            while lane < laneMasks.count && laneMasks[lane] & mask != 0 { lane += 1 }
            if lane == laneMasks.count { laneMasks.append(0) }
            laneMasks[lane] |= mask
            segments.append(MonthWeekSegment(id: candidate.id, item: candidate.item, firstColumn: candidate.first, lastColumn: candidate.last, lane: lane))
        }
    }

    func hiddenCount(on column: Int, capacity: Int) -> Int {
        segments.filter { $0.lane >= capacity && $0.firstColumn <= column && column <= $0.lastColumn }.count
    }
}

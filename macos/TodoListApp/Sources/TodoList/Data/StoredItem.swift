import Foundation
import SwiftData

@Model
final class StoredItem {
    @Attribute(.unique) var id: String
    var payload: Data
    var kind: String
    var title: String
    var deletedAt: String?

    init(id: String, payload: Data, kind: String, title: String, deletedAt: String?) {
        self.id = id
        self.payload = payload
        self.kind = kind
        self.title = title
        self.deletedAt = deletedAt
    }
}

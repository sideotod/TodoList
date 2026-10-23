import Foundation
import SwiftData

@MainActor
final class LocalStore {
    let container: ModelContainer
    let context: ModelContext
    var failNextSave: Error?

    init(storeURL: URL? = nil) throws {
        let schema = Schema([StoredItem.self, StoredOperation.self])
        let configuration: ModelConfiguration
        if let storeURL {
            try FileManager.default.createDirectory(
                at: storeURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            configuration = ModelConfiguration("TodoList", schema: schema, url: storeURL, cloudKitDatabase: .none)
        } else {
            configuration = ModelConfiguration("TodoList", schema: schema, cloudKitDatabase: .none)
        }
        container = try ModelContainer(for: schema, configurations: [configuration])
        context = container.mainContext
        context.autosaveEnabled = false
    }

    static func inMemory() throws -> LocalStore {
        let schema = Schema([StoredItem.self, StoredOperation.self])
        let configuration = ModelConfiguration("TodoListMemory", schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
        return try LocalStore(container: ModelContainer(for: schema, configurations: [configuration]))
    }

    private init(container: ModelContainer) {
        self.container = container
        context = container.mainContext
        context.autosaveEnabled = false
    }

    func save() throws {
        if let failure = failNextSave {
            failNextSave = nil
            throw failure
        }
        try context.save()
    }
}

import XCTest
@testable import TodoList

final class SupabaseConfigurationTests: XCTestCase {
    func testMissingConfigurationKeepsLocalMode() throws {
        let suiteName = UUID().uuidString
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        XCTAssertThrowsError(try SupabaseConfiguration.load(
            bundle: Bundle(for: Self.self),
            environment: [:],
            defaults: defaults
        )) { error in
            XCTAssertEqual(error as? SupabaseConfigurationError, .missing)
        }
    }

    func testRejectsNonHTTPSRemoteHostButAllowsLocalhost() throws {
        XCTAssertThrowsError(try SupabaseConfiguration(url: "http://example.supabase.co", publishableKey: "sb_publishable_demo"))

        let local = try SupabaseConfiguration(url: "http://localhost:54321", publishableKey: "sb_publishable_demo")
        XCTAssertEqual(local.url.host, "localhost")
    }

    func testRecognizesNativeCallbackURL() {
        XCTAssertTrue(SupabaseConfiguration.recognizesCallback(URL(string: "todolist://auth/callback?code=abc")!))
        XCTAssertFalse(SupabaseConfiguration.recognizesCallback(URL(string: "https://example.com/auth/callback")!))
        XCTAssertFalse(SupabaseConfiguration.recognizesCallback(URL(string: "todolist://other/callback")!))
    }

    func testRejectsSecretKeyFormats() {
        XCTAssertThrowsError(try SupabaseConfiguration(url: "https://project.supabase.co", publishableKey: "sb_secret_demo"))
        XCTAssertThrowsError(try SupabaseConfiguration(url: "https://project.supabase.co", publishableKey: "key with spaces"))
    }
}

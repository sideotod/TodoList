import Foundation

enum SupabaseConfigurationKeys {
    static let url = "todolist.supabase.url"
    static let publishableKey = "todolist.supabase.publishableKey"
}

struct SupabaseConfiguration: Equatable, Sendable {
    let url: URL
    let publishableKey: String

    static let callbackURL = URL(string: "todolist://auth/callback")!

    init(url: String, publishableKey: String) throws {
        let cleanedURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedKey = publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = URL(string: cleanedURL),
              let scheme = parsed.scheme?.lowercased(),
              let host = parsed.host,
              parsed.user == nil, parsed.password == nil,
              parsed.path.isEmpty || parsed.path == "/",
              parsed.query == nil, parsed.fragment == nil,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1"].contains(host.lowercased())) else {
            throw SupabaseConfigurationError.invalidURL
        }
        guard !cleanedKey.isEmpty, !cleanedKey.contains(where: \.isWhitespace),
              !cleanedKey.hasPrefix("sb_secret_"), cleanedKey != "service_role" else {
            throw SupabaseConfigurationError.invalidPublishableKey
        }
        self.url = parsed
        self.publishableKey = cleanedKey
    }

    static func load(
        bundle: Bundle = .main,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        defaults: UserDefaults = .standard
    ) throws -> SupabaseConfiguration {
        let storedURL = defaults.string(forKey: SupabaseConfigurationKeys.url)
        let storedKey = defaults.string(forKey: SupabaseConfigurationKeys.publishableKey)
        let url = storedURL ?? environment["SUPABASE_URL"] ?? environment["NEXT_PUBLIC_SUPABASE_URL"]
            ?? bundle.object(forInfoDictionaryKey: "SupabaseURL") as? String
        let key = storedKey ?? environment["SUPABASE_PUBLISHABLE_KEY"] ?? environment["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
            ?? bundle.object(forInfoDictionaryKey: "SupabasePublishableKey") as? String
        guard let url, let key, !url.isEmpty, !key.isEmpty else {
            throw SupabaseConfigurationError.missing
        }
        return try SupabaseConfiguration(url: url, publishableKey: key)
    }

    static func recognizesCallback(_ url: URL) -> Bool {
        url.scheme?.lowercased() == callbackURL.scheme
            && url.host?.lowercased() == callbackURL.host
            && url.path == callbackURL.path
    }
}

@MainActor
final class SupabaseConfigurationStore {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func save(_ configuration: SupabaseConfiguration) {
        defaults.set(configuration.url.absoluteString, forKey: SupabaseConfigurationKeys.url)
        defaults.set(configuration.publishableKey, forKey: SupabaseConfigurationKeys.publishableKey)
    }

    func clear() {
        defaults.removeObject(forKey: SupabaseConfigurationKeys.url)
        defaults.removeObject(forKey: SupabaseConfigurationKeys.publishableKey)
    }

    func storedValues() -> (url: String, publishableKey: String) {
        (
            defaults.string(forKey: SupabaseConfigurationKeys.url) ?? "",
            defaults.string(forKey: SupabaseConfigurationKeys.publishableKey) ?? ""
        )
    }
}

enum SupabaseConfigurationError: LocalizedError, Equatable {
    case missing
    case invalidURL
    case invalidPublishableKey

    var errorDescription: String? {
        switch self {
        case .missing:
            "Supabase 프로젝트 URL과 publishable key를 설정해야 계정 기능을 사용할 수 있습니다."
        case .invalidURL:
            "프로젝트 루트 URL은 HTTPS여야 합니다. HTTP는 localhost에서만 허용됩니다."
        case .invalidPublishableKey:
            "공백이 없는 publishable key를 입력해 주세요. service_role과 sb_secret 키는 사용할 수 없습니다."
        }
    }
}

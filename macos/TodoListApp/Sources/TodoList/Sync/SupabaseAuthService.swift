import AppKit
import AuthenticationServices
import Foundation
import Observation
import Supabase

enum SupabaseAccountState: Equatable {
    case localOnly
    case signedOut(projectHost: String)
    case signedIn(userID: String, email: String?)
    case error(String)

    var title: String {
        switch self {
        case .localOnly: "로컬 전용"
        case .signedOut: "로그아웃 상태"
        case .signedIn(_, let email): email ?? "로그인됨"
        case .error: "연결 오류"
        }
    }
}

@MainActor
@Observable
final class SupabaseAuthService {
    private(set) var state: SupabaseAccountState = .localOnly
    private(set) var isBusy = false
    private(set) var isConfigured = false
    private(set) var configurationValues: (url: String, publishableKey: String) = ("", "")
    @ObservationIgnored private let configurationStore: SupabaseConfigurationStore
    @ObservationIgnored private(set) var client: SupabaseClient?
    @ObservationIgnored private var authEventsTask: Task<Void, Never>?
    @ObservationIgnored private var projectHost: String?
    @ObservationIgnored private(set) var projectIdentifier: String?
    @ObservationIgnored private(set) var configuration: SupabaseConfiguration?
    @ObservationIgnored var onAccountChanged: (@MainActor () -> Void)?

    init(configurationStore: SupabaseConfigurationStore = SupabaseConfigurationStore()) {
        self.configurationStore = configurationStore
        configurationValues = configurationStore.storedValues()
        if configurationValues.url.isEmpty,
           let configuration = try? SupabaseConfiguration.load(defaults: .standard) {
            configurationValues = (configuration.url.absoluteString, configuration.publishableKey)
        }
    }

    deinit {
        authEventsTask?.cancel()
    }

    var userID: String? {
        guard case let .signedIn(userID, _) = state else { return nil }
        return userID
    }

    func restoreSession() async {
        do {
            try configureClient()
            guard let client else { return }
            observeAuthEvents(from: client)
            if let session = try? await client.auth.session {
                accept(session)
            } else if let host = projectHost {
                setState(.signedOut(projectHost: host))
            }
        } catch SupabaseConfigurationError.missing {
            setState(.localOnly)
            isConfigured = false
        } catch {
            setState(.error(error.localizedDescription))
        }
    }

    func saveConfiguration(url: String, publishableKey: String) async throws {
        let configuration = try SupabaseConfiguration(url: url, publishableKey: publishableKey)
        configurationStore.save(configuration)
        configurationValues = configurationStore.storedValues()
        authEventsTask?.cancel()
        client = nil
        try configureClient()
        projectHost = configuration.url.host
        if let client { observeAuthEvents(from: client) }
        if let host = projectHost { setState(.signedOut(projectHost: host)) }
    }

    func signInWithGoogle() async throws {
        guard let client else { throw SupabaseConfigurationError.missing }
        isBusy = true
        defer { isBusy = false }
        do {
            let session = try await client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: SupabaseConfiguration.callbackURL
            )
            accept(session)
        } catch {
            setState(.error(Self.authErrorDescription(error)))
            throw error
        }
    }

    func handleCallback(_ url: URL) async {
        guard SupabaseConfiguration.recognizesCallback(url), let client else { return }
        do {
            accept(try await client.auth.session(from: url))
        } catch {
            setState(.error(Self.authErrorDescription(error)))
        }
    }

    func signOut() async throws {
        guard let client else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            try await client.auth.signOut()
            if let host = projectHost { setState(.signedOut(projectHost: host)) }
        } catch {
            setState(.error(Self.authErrorDescription(error)))
            throw error
        }
    }

    private func configureClient() throws {
        let configuration = try SupabaseConfiguration.load(defaults: .standard)
        self.configuration = configuration
        projectHost = configuration.url.host
        projectIdentifier = configuration.url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        client = SupabaseClient(
            supabaseURL: configuration.url,
            supabaseKey: configuration.publishableKey,
            options: SupabaseClientOptions(
                auth: .init(redirectToURL: SupabaseConfiguration.callbackURL, flowType: .pkce)
            )
        )
        isConfigured = true
    }

    private func observeAuthEvents(from client: SupabaseClient) {
        authEventsTask?.cancel()
        let host = projectHost
        authEventsTask = Task { [weak self, client] in
            for await (_, session) in client.auth.authStateChanges {
                guard !Task.isCancelled else { return }
                if let session {
                    self?.accept(session)
                } else if let host {
                    self?.setState(.signedOut(projectHost: host))
                }
            }
        }
    }

    private func accept(_ session: Session) {
        setState(.signedIn(userID: session.user.id.uuidString, email: session.user.email))
    }

    private func setState(_ newState: SupabaseAccountState) {
        guard state != newState else { return }
        state = newState
        onAccountChanged?()
    }

    private static func authErrorDescription(_ error: Error) -> String {
        "Supabase 인증에 실패했습니다. Google 제공자와 todolist://auth/callback 허용 목록을 확인해 주세요. (\(error.localizedDescription))"
    }
}

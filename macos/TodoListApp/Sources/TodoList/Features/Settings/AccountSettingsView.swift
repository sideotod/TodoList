import SwiftUI

struct AccountSettingsView: View {
    let authService: SupabaseAuthService

    @State private var projectURL = ""
    @State private var publishableKey = ""
    @State private var statusMessage: String?

    var body: some View {
        Form {
            Section("Supabase 프로젝트") {
                TextField("프로젝트 URL", text: $projectURL, prompt: Text("https://project-ref.supabase.co"))
                    .textContentType(.URL)
                SecureField("Publishable key", text: $publishableKey)
                    .textContentType(.password)
                Text("publishable key만 저장합니다. service_role 또는 sb_secret 키를 입력하지 마세요. 키는 이 Mac의 사용자 설정에 보관됩니다.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                HStack {
                    Button("설정 저장") { saveConfiguration() }
                        .disabled(projectURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || publishableKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if authService.isConfigured {
                        Label("프로젝트 연결 정보 저장됨", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.accent)
                    }
                }
            }

            Section("계정") {
                LabeledContent("상태", value: authService.state.title)
                switch authService.state {
                case .signedIn:
                    Button("Google 계정에서 로그아웃", role: .destructive) { Task { await signOut() } }
                        .disabled(authService.isBusy)
                case .signedOut:
                    Button("Google로 로그인", systemImage: "person.crop.circle") { Task { await signIn() } }
                        .disabled(!authService.isConfigured || authService.isBusy)
                    Text("브라우저 인증 뒤 todolist://auth/callback로 돌아옵니다. Supabase Auth의 redirect allow list에 이 주소를 추가해야 합니다.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                case .localOnly:
                    Label("Supabase가 설정되지 않아 로컬 저장으로 동작합니다.", systemImage: "externaldrive.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                case .error(let message):
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(.red)
                    Button("다시 연결") { Task { await authService.restoreSession() } }
                        .disabled(authService.isBusy)
                }
            }

            Section("기기 간 동기화") {
                Text("현재 네이티브 앱은 로그인과 Keychain 세션 복원을 지원합니다. revision RPC, 오프라인 outbox, 충돌 해결 동기화는 아직 연결되지 않았으므로 이 앱의 로컬 변경은 Supabase에 업로드되지 않습니다.")
                    .font(.system(size: 12))
                    .foregroundStyle(.orange)
            }

            if let statusMessage {
                Section { Text(statusMessage).font(.system(size: 11)).foregroundStyle(.secondary) }
            }
        }
        .formStyle(.grouped)
        .onAppear {
            let values = authService.configurationValues
            if projectURL.isEmpty { projectURL = values.url }
            if publishableKey.isEmpty { publishableKey = values.publishableKey }
        }
    }

    private func saveConfiguration() {
        Task {
            do {
                try await authService.saveConfiguration(url: projectURL, publishableKey: publishableKey)
                statusMessage = "Supabase 설정을 저장했습니다. 로그인 버튼으로 인증을 시작할 수 있습니다."
            } catch {
                statusMessage = error.localizedDescription
            }
        }
    }

    private func signIn() async {
        do {
            try await authService.signInWithGoogle()
            statusMessage = "Google 계정에 로그인했습니다."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func signOut() async {
        do {
            try await authService.signOut()
            statusMessage = "이 앱에서 로그아웃했습니다. 이 Mac의 로컬 일정은 유지됩니다."
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

import SwiftUI

struct AccountSettingsView: View {
    let authService: SupabaseAuthService
    let syncManager: SupabaseSyncManager?

    @State private var projectURL = ""
    @State private var publishableKey = ""
    @State private var statusMessage: String?

    @State private var showsConnection = false
    @State private var selectedConflict: SyncConflict?
    @State private var showingResolution = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(authService.state.title).foregroundStyle(Theme.secondaryText)
                    Spacer()
                    accountAction
                }
                .frame(minHeight: 37)
                Divider()
                HStack {
                    Text("기기 간 동기화")
                    Spacer()
                    Text(syncManager?.status ?? "미연결").foregroundStyle(Theme.secondaryText)
                    if case .signedIn = authService.state, let syncManager {
                        Button("다시 동기화") { syncManager.requestSync() }
                            .disabled(syncManager.isSyncing)
                    }
                }
                .frame(minHeight: 37)
                if let syncManager, !syncManager.conflicts.isEmpty {
                    ForEach(syncManager.conflicts) { conflict in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("이 Mac: \(conflict.item.title)")
                                Text(conflict.remote.deletedAt == nil ? "서버: \(conflict.remote.title)" : "서버: 삭제됨")
                                    .foregroundStyle(Theme.secondaryText)
                            }
                            Spacer()
                            Button("충돌 해결") {
                                selectedConflict = conflict
                                showingResolution = true
                            }
                        }
                    }
                }
                Divider()
                DisclosureGroup("연결 설정", isExpanded: $showsConnection) {
                    VStack(alignment: .leading, spacing: 12) {
                        LabeledContent("프로젝트 URL") {
                            TextField("https://project-ref.supabase.co", text: $projectURL)
                                .textContentType(.URL)
                                .textFieldStyle(.roundedBorder)
                                .frame(maxWidth: 350)
                        }
                        LabeledContent("Publishable key") {
                            SecureField("Publishable key", text: $publishableKey)
                                .textFieldStyle(.roundedBorder)
                                .frame(maxWidth: 350)
                                .help("공개 publishable key만 저장할 수 있습니다.")
                        }
                        HStack {
                            Spacer()
                            Button("연결 설정 저장") { saveConfiguration() }
                                .disabled(
                                    projectURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                        || publishableKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                    .padding(.top, 12)
                }
                if let statusMessage {
                    Text(statusMessage).foregroundStyle(Theme.secondaryText)
                }
            }
            .font(.system(size: 12))
            .buttonStyle(FormActionButtonStyle())
            .padding(16)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.separator, lineWidth: 1))
            .padding(24)
        }
        .scrollIndicators(.automatic)
        .onAppear {
            let values = authService.configurationValues
            if projectURL.isEmpty { projectURL = values.url }
            if publishableKey.isEmpty { publishableKey = values.publishableKey }
            showsConnection = !authService.isConfigured
        }
        .confirmationDialog("어느 내용을 유지할까요?", isPresented: $showingResolution, titleVisibility: .visible) {
            if let selectedConflict, let syncManager {
                if selectedConflict.remote.deletedAt == nil {
                    Button("이 Mac 내용으로 서버 갱신") { syncManager.resolve(selectedConflict, keepLocal: true) }
                }
                Button("서버 내용으로 이 Mac 갱신", role: .destructive) { syncManager.resolve(selectedConflict, keepLocal: false) }
            }
            Button("취소", role: .cancel) { selectedConflict = nil }
        } message: {
            Text("선택한 내용으로 다른 쪽을 갱신합니다. 서버에서 삭제된 항목은 서버 내용을 선택할 수 있습니다.")
        }
    }

    @ViewBuilder
    private var accountAction: some View {
        switch authService.state {
        case .signedIn:
            Button("로그아웃", role: .destructive) { Task { await signOut() } }
                .disabled(authService.isBusy)
        case .signedOut:
            Button("Google로 로그인", systemImage: "person.crop.circle") { Task { await signIn() } }
                .disabled(!authService.isConfigured || authService.isBusy)
        case .localOnly:
            EmptyView()
        case .error(let message):
            VStack(alignment: .trailing, spacing: 6) {
                Text(message).foregroundStyle(.red)
                Button("다시 연결") { Task { await authService.restoreSession() } }
                    .disabled(authService.isBusy)
            }
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

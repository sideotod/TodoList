import SwiftUI

struct InlineTaskComposer: View {
    let onCreate: (String) async throws -> Void
    let onCancel: () -> Void

    @State private var title = ""
    @State private var errorMessage: String?
    @State private var saving = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "circle").foregroundStyle(.tertiary)
                TextField("새 할 일", text: $title)
                    .textFieldStyle(.plain)
                    .focused($focused)
                    .onSubmit { Task { await submit() } }
                Button("추가") { Task { await submit() } }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
                    .controlSize(.small)
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving)
                Button(action: onCancel) {
                    Image(systemName: "xmark")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("빠른 추가 닫기")
            }
            if let errorMessage {
                Text(errorMessage).font(.system(size: 11)).foregroundStyle(.red)
            }
        }
        .padding(10)
        .background(Theme.sageSelection.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
        .onAppear { focused = true }
        .onExitCommand(perform: onCancel)
    }

    @MainActor
    private func submit() async {
        let value = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        saving = true
        defer { saving = false }
        do {
            try await onCreate(value)
            title = ""
            onCancel()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

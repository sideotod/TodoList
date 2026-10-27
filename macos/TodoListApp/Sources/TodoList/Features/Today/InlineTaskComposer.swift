import SwiftUI

struct InlineTaskComposer: View {
    @FocusState.Binding private var focused: Bool
    let onCreate: (String) async throws -> Void
    let onCancel: () -> Void

    @State private var title = ""
    @State private var errorMessage: String?
    @State private var saving = false
    @State private var didFinish = false

    init(
        focused: FocusState<Bool>.Binding,
        onCreate: @escaping (String) async throws -> Void,
        onCancel: @escaping () -> Void
    ) {
        self._focused = focused
        self.onCreate = onCreate
        self.onCancel = onCancel
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "circle").foregroundStyle(.tertiary)
                TextField("새 할 일", text: $title)
                    .textFieldStyle(.plain)
                    .focused($focused)
                    .onSubmit { Task { await finish() } }
            }
            if let errorMessage {
                Text(errorMessage).font(.system(size: 11)).foregroundStyle(.red)
            }
        }
        .padding(10)
        .background(Theme.sageSelection.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
        .onAppear {
            DispatchQueue.main.async { focused = true }
        }
        .onChange(of: focused) { _, hasFocus in
            guard !hasFocus else { return }
            Task { await finish() }
        }
        .onDisappear { Task { await finish() } }
        .onExitCommand(perform: cancelDraft)
    }

    @MainActor
    private func finish() async {
        let value = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !saving, !didFinish else { return }
        guard !value.isEmpty else {
            didFinish = true
            onCancel()
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await onCreate(value)
            didFinish = true
            onCancel()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func cancelDraft() {
        didFinish = true
        onCancel()
    }
}

struct InlineComposerFramePreferenceKey: PreferenceKey {
    static let defaultValue: CGRect = .zero

    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}

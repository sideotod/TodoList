import AppKit
import SwiftUI

private final class BorderlessEditorTextField: NSTextField {
    override var focusRingType: NSFocusRingType {
        get { .none }
        set {}
    }
}

struct EditorTextField: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    var font: NSFont = .systemFont(ofSize: 12)
    var autofocus = false

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeNSView(context: Context) -> NSTextField {
        let field = BorderlessEditorTextField(string: text)
        field.placeholderString = placeholder
        field.font = font
        field.isBezeled = false
        field.isBordered = false
        field.cell?.isBezeled = false
        field.cell?.isBordered = false
        field.drawsBackground = false
        field.backgroundColor = .clear
        field.focusRingType = .none
        field.cell?.focusRingType = .none
        field.delegate = context.coordinator
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        context.coordinator.text = $text
        field.placeholderString = placeholder
        field.font = font
        field.isBezeled = false
        field.isBordered = false
        field.cell?.isBezeled = false
        field.cell?.isBordered = false
        field.drawsBackground = false
        field.backgroundColor = .clear
        field.focusRingType = .none
        field.cell?.focusRingType = .none
        if field.stringValue != text {
            field.stringValue = text
        }
        guard autofocus, !context.coordinator.didRequestFocus else { return }
        context.coordinator.didRequestFocus = true
        DispatchQueue.main.async { [weak field] in
            guard let field, let window = field.window else { return }
            window.makeFirstResponder(field)
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var text: Binding<String>
        var didRequestFocus = false

        init(text: Binding<String>) {
            self.text = text
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            text.wrappedValue = field.stringValue
        }
    }
}

struct FormSectionCard<Content: View>: View {
    let title: String
    var appearance: FormSectionAppearance = .card
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: appearance == .card ? 8 : 0) {
            if !title.isEmpty {
                Text(title)
                    .font(.system(size: appearance == .card ? 12 : 14, weight: .semibold))
                    .foregroundStyle(appearance == .card ? Theme.secondaryText : Theme.primaryText)
                    .padding(.bottom, appearance == .card ? 0 : 10)
            }
            VStack(alignment: .leading, spacing: 12) { content }
                .padding(appearance == .card ? 14 : 0)
                .padding(.bottom, appearance == .plain ? 8 : 0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    if appearance == .card {
                        RoundedRectangle(cornerRadius: 10).fill(Theme.card)
                    }
                }
                .overlay {
                    if appearance == .card {
                        RoundedRectangle(cornerRadius: 10).stroke(Theme.separator, lineWidth: 1)
                    }
                }
                .overlay(alignment: .bottom) {
                    if appearance == .plain {
                        Rectangle().fill(Theme.separator).frame(height: 1)
                    }
                }
        }
    }
}

enum FormSectionAppearance: Equatable {
    case card
    case plain
}

struct FormFieldRow<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(title)
                .font(.system(size: 12))
                .foregroundStyle(Theme.secondaryText)
                .frame(width: 104, alignment: .leading)
            content.frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 32)
    }
}

struct FormToggleRow: View {
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(title)
            Spacer(minLength: 12)
            Toggle(title, isOn: $isOn).labelsHidden().toggleStyle(.switch)
        }
        .frame(minHeight: 32)
    }
}

struct FormTextFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.vertical, 7)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.primary.opacity(0.14)).frame(height: 1)
            }
    }
}

struct FormActionButtonStyle: ButtonStyle {
    var primary = false

    func makeBody(configuration: Configuration) -> some View {
        ActionLabel(configuration: configuration, primary: primary)
    }

    private struct ActionLabel: View {
        let configuration: ButtonStyle.Configuration
        let primary: Bool
        @Environment(\.isEnabled) private var enabled
        @State private var hovered = false

        var body: some View {
            configuration.label
                .font(.system(size: 12, weight: primary ? .semibold : .regular))
                .foregroundStyle(primary ? Color.white : Theme.primaryText)
                .padding(.horizontal, 16)
                .frame(minWidth: 68, minHeight: 32)
                .background(primary ? (hovered ? Theme.accent.opacity(0.88) : Theme.accent) : hovered ? Theme.rowHover : Theme.control, in: RoundedRectangle(cornerRadius: 7))
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(primary ? .clear : Theme.separator, lineWidth: 1))
                .opacity(!enabled ? 0.45 : configuration.isPressed ? 0.8 : 1)
                .contentShape(Rectangle())
                .onHover { hovered = $0 }
        }
    }
}

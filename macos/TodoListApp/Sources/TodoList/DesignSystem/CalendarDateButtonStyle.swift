import SwiftUI

/// The same date selection and hover treatment in all calendar surfaces.
struct CalendarDateButtonStyle: ButtonStyle {
    var selected = false
    var today = false

    func makeBody(configuration: Configuration) -> some View {
        DateLabel(configuration: configuration, selected: selected, today: today)
    }

    private struct DateLabel: View {
        let configuration: ButtonStyle.Configuration
        let selected: Bool
        let today: Bool
        @State private var hovered = false

        var body: some View {
            configuration.label
                .foregroundStyle(selected || today ? Theme.accent : Theme.primaryText)
                .background(selected ? Theme.sageSelection : hovered || configuration.isPressed ? Theme.rowHover : .clear,
                            in: RoundedRectangle(cornerRadius: 6))
                .overlay {
                    if today && !selected {
                        RoundedRectangle(cornerRadius: 6).stroke(Theme.accent.opacity(0.55), lineWidth: 1)
                    }
                }
                .contentShape(Rectangle())
                .onHover { hovered = $0 }
        }
    }
}

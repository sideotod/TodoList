import AppKit
import SwiftUI

struct PopoverChoice<Value: Hashable>: Identifiable {
    let value: Value
    let title: String
    var color: Color?

    var id: Value { value }
}

struct PopoverSelectionField<Value: Hashable>: View {
    let title: String
    let choices: [PopoverChoice<Value>]
    @Binding var selection: Value

    @State private var isHovered = false
    @State private var isPresented = false

    private var selectedChoice: PopoverChoice<Value>? {
        choices.first { $0.value == selection }
    }

    var body: some View {
        Button {
            isPresented.toggle()
        } label: {
            HStack(spacing: 8) {
                if let color = selectedChoice?.color {
                    Circle().fill(color).frame(width: 9, height: 9)
                }
                Text(selectedChoice?.title ?? "선택")
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Theme.tertiaryText)
            }
            .font(.system(size: 12))
            .foregroundStyle(Theme.primaryText)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(isHovered ? Theme.rowHover : Theme.control, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(Theme.separator, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, minHeight: 34)
        .background {
            PopoverSelectionPanelHost(
                isPresented: $isPresented,
                selection: $selection,
                title: title,
                choices: choices
            )
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .onHover { isHovered = $0 }
        .accessibilityLabel(title)
        .accessibilityValue(selectedChoice?.title ?? "선택 안 됨")
        .focusEffectDisabled(true)
    }
}

@MainActor
private struct PopoverSelectionPanelHost<Value: Hashable>: NSViewRepresentable {
    @Binding var isPresented: Bool
    @Binding var selection: Value
    let title: String
    let choices: [PopoverChoice<Value>]

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> SelectionPanelAnchorView {
        let view = SelectionPanelAnchorView()
        view.postsFrameChangedNotifications = true
        view.onMove = { [weak coordinator = context.coordinator] in
            coordinator?.anchorDidMove()
        }
        return view
    }

    func updateNSView(_ view: SelectionPanelAnchorView, context: Context) {
        context.coordinator.update(
            anchor: view,
            isPresented: $isPresented,
            selection: $selection,
            title: title,
            choices: choices
        )
    }

    static func dismantleNSView(_ view: SelectionPanelAnchorView, coordinator: Coordinator) {
        coordinator.teardown()
    }

    @MainActor
    final class Coordinator: NSObject {
        private weak var anchor: SelectionPanelAnchorView?
        private weak var observedAnchor: SelectionPanelAnchorView?
        private weak var observedWindow: NSWindow?
        private weak var panelParentWindow: NSWindow?
        private var isPresented: Binding<Bool>?
        private var selection: Binding<Value>?
        private var panel: NSPanel?
        private var hostingView: NSHostingView<SelectionPanelContent<Value>>?
        private var eventMonitor: Any?
        private var notificationTokens: [NSObjectProtocol] = []
        private var anchorScreenFrame: CGRect = .zero
        private var choices: [PopoverChoice<Value>] = []
        private var highlightedIndex: Int?
        private var wasPresented = false

        func update(
            anchor: SelectionPanelAnchorView,
            isPresented: Binding<Bool>,
            selection: Binding<Value>,
            title: String,
            choices: [PopoverChoice<Value>]
        ) {
            self.anchor = anchor
            self.isPresented = isPresented
            self.selection = selection
            self.choices = choices

            guard isPresented.wrappedValue else {
                hidePanel()
                return
            }

            if !wasPresented {
                highlightedIndex = choices.firstIndex { $0.value == selection.wrappedValue } ?? choices.indices.first
                wasPresented = true
            }
            let content = SelectionPanelContent(title: title, choices: choices, selection: selection, isPresented: isPresented, highlightedIndex: highlightedIndex)
            ensurePanel(content: content)
            hostingView?.rootView = content
            hostingView?.layoutSubtreeIfNeeded()
            if let window = anchor.window {
                observe(anchor: anchor, window: window)
                repositionPanel()
                installEventMonitor()
            }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.isPresented?.wrappedValue == true else { return }
                if let anchor = self.anchor, let window = anchor.window {
                    self.observe(anchor: anchor, window: window)
                }
                self.repositionPanel()
                self.installEventMonitor()
            }
        }

        func anchorDidMove() {
            guard isPresented?.wrappedValue == true else { return }
            repositionPanel()
        }

        func teardown() {
            hidePanel()
            panel?.close()
            panel = nil
            hostingView = nil
            anchor = nil
        }

        private func ensurePanel(content: SelectionPanelContent<Value>) {
            guard hostingView == nil else { return }
            let view = NSHostingView(rootView: content)
            view.sizingOptions = []
            let panel = SelectionPanel(
                contentRect: CGRect(origin: .zero, size: CGSize(width: 240, height: 40)),
                styleMask: [.borderless, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            panel.isFloatingPanel = true
            panel.hidesOnDeactivate = true
            panel.becomesKeyOnlyIfNeeded = true
            panel.level = .popUpMenu
            panel.collectionBehavior = [.transient, .ignoresCycle]
            panel.backgroundColor = .clear
            panel.isOpaque = false
            panel.hasShadow = true
            panel.contentView = view
            self.panel = panel
            hostingView = view
        }

        private func repositionPanel() {
            guard
                let anchor,
                let window = anchor.window,
                let screen = window.screen ?? NSScreen.main,
                let panel,
                let hostingView
            else { return }

            hostingView.layoutSubtreeIfNeeded()
            let visibleFrame = screen.visibleFrame.insetBy(dx: 8, dy: 8)
            let rowHeight: CGFloat = 34
            let desiredHeight = CGFloat(max(1, choices.count)) * rowHeight + 12
            let height = min(max(desiredHeight, 46), 286)
            let size = CGSize(width: max(220, min(anchor.bounds.width, 320)), height: height)
            panel.setContentSize(size)
            hostingView.setFrameSize(size)

            let anchorInWindow = anchor.convert(anchor.bounds, to: nil)
            let anchorOnScreen = window.convertToScreen(anchorInWindow)
            anchorScreenFrame = anchorOnScreen

            let spaceBelow = anchorOnScreen.minY - visibleFrame.minY
            let spaceAbove = visibleFrame.maxY - anchorOnScreen.maxY
            let opensBelow = spaceBelow >= size.height + 8 || spaceBelow >= spaceAbove
            let proposedY = opensBelow
                ? anchorOnScreen.minY - size.height - 6
                : anchorOnScreen.maxY + 6
            let y = min(max(proposedY, visibleFrame.minY), visibleFrame.maxY - size.height)
            let x = min(max(anchorOnScreen.minX, visibleFrame.minX), visibleFrame.maxX - size.width)
            panel.setFrame(CGRect(origin: CGPoint(x: x, y: y), size: size), display: true)
            panel.orderFront(nil)
        }

        private func observe(anchor: SelectionPanelAnchorView, window: NSWindow) {
            guard observedAnchor !== anchor || observedWindow !== window else { return }
            removeObservers()
            observedAnchor = anchor
            observedWindow = window
            if let panel, panelParentWindow !== window {
                panelParentWindow?.removeChildWindow(panel)
                window.addChildWindow(panel, ordered: .above)
                panelParentWindow = window
            }

            let notificationCenter = NotificationCenter.default
            for name in [NSWindow.didResizeNotification, NSWindow.didMoveNotification, NSWindow.didChangeScreenNotification] {
                notificationTokens.append(notificationCenter.addObserver(forName: name, object: window, queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { self?.repositionPanel() }
                })
            }
            notificationTokens.append(notificationCenter.addObserver(forName: NSView.frameDidChangeNotification, object: anchor, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.repositionPanel() }
            })
            notificationTokens.append(notificationCenter.addObserver(forName: NSApplication.didResignActiveNotification, object: NSApp, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.dismissFromInteraction() }
            })
            var ancestor: NSView? = anchor.superview
            while let view = ancestor {
                if let clipView = view as? NSClipView {
                    clipView.postsBoundsChangedNotifications = true
                    notificationTokens.append(notificationCenter.addObserver(forName: NSView.boundsDidChangeNotification, object: clipView, queue: .main) { [weak self] _ in
                        MainActor.assumeIsolated { self?.repositionPanel() }
                    })
                    break
                }
                ancestor = view.superview
            }
        }

        private func installEventMonitor() {
            guard eventMonitor == nil else { return }
            eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .keyDown]) { [weak self] event in
                guard let self, self.panel?.isVisible == true else { return event }
                if event.type == .keyDown {
                    switch event.keyCode {
                    case 53:
                        self.dismissFromInteraction()
                        return nil
                    case 125, 126:
                        guard !self.choices.isEmpty else { return nil }
                        let direction = event.keyCode == 125 ? 1 : -1
                        let index = self.highlightedIndex ?? 0
                        self.highlightedIndex = min(max(index + direction, 0), self.choices.count - 1)
                        if let hostingView = self.hostingView {
                            var content = hostingView.rootView
                            content.highlightedIndex = self.highlightedIndex
                            hostingView.rootView = content
                        }
                        return nil
                    case 36, 76:
                        if let index = self.highlightedIndex, self.choices.indices.contains(index) {
                            self.selection?.wrappedValue = self.choices[index].value
                        }
                        self.dismissFromInteraction()
                        return nil
                    default:
                        return event
                    }
                }
                let point = event.window?.convertPoint(toScreen: event.locationInWindow) ?? NSEvent.mouseLocation
                guard self.panel?.frame.contains(point) != true, !self.anchorScreenFrame.contains(point) else { return event }
                self.dismissFromInteraction()
                return event
            }
        }

        private func dismissFromInteraction() {
            panel?.orderOut(nil)
            isPresented?.wrappedValue = false
        }

        private func hidePanel() {
            panel?.orderOut(nil)
            if let panel { panelParentWindow?.removeChildWindow(panel) }
            panelParentWindow = nil
            wasPresented = false
            highlightedIndex = nil
            if let eventMonitor {
                NSEvent.removeMonitor(eventMonitor)
                self.eventMonitor = nil
            }
            removeObservers()
        }

        private func removeObservers() {
            for token in notificationTokens {
                NotificationCenter.default.removeObserver(token)
            }
            notificationTokens.removeAll()
            observedAnchor = nil
            observedWindow = nil
        }
    }
}

private struct SelectionPanelContent<Value: Hashable>: View {
    let title: String
    let choices: [PopoverChoice<Value>]
    @Binding var selection: Value
    @Binding var isPresented: Bool
    var highlightedIndex: Int?
    @State private var hoveredIndex: Int?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 3) {
                    ForEach(Array(choices.enumerated()), id: \.element.id) { index, choice in
                        Button {
                            selection = choice.value
                            isPresented = false
                        } label: {
                            HStack(spacing: 9) {
                                if let color = choice.color {
                                    Circle().fill(color).frame(width: 9, height: 9)
                                }
                                Text(choice.title)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                if choice.value == selection {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.primaryText)
                            .padding(.horizontal, 9)
                            .frame(maxWidth: .infinity, minHeight: 30)
                            .background(index == (hoveredIndex ?? highlightedIndex) ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 7))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .onHover { hoveredIndex = $0 ? index : nil }
                        .accessibilityAddTraits(choice.value == selection ? .isSelected : [])
                        .id(index)
                    }
                }
                .padding(6)
            }
            .onChange(of: highlightedIndex) { _, index in
                if let index { proxy.scrollTo(index) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.separator, lineWidth: 1))
        .accessibilityLabel(title)
    }
}

@MainActor
private final class SelectionPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

private final class SelectionPanelAnchorView: NSView {
    var onMove: (() -> Void)?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        onMove?()
    }

    override func viewDidMoveToSuperview() {
        super.viewDidMoveToSuperview()
        onMove?()
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        onMove?()
    }
}

struct PopoverFieldButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovered = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                isHovered || configuration.isPressed ? Theme.rowHover : Theme.control,
                in: RoundedRectangle(cornerRadius: 7, style: .continuous)
            )
            .opacity(isEnabled ? 1 : 0.5)
            .onHover { isHovered = $0 }
    }
}

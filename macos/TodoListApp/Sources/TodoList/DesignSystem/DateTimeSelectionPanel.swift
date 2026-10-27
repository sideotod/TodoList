import AppKit
import SwiftUI

@MainActor
struct DateTimeSelectionPanelHost: NSViewRepresentable {
    @Binding var isPresented: Bool
    @Binding var date: Date
    let showsTime: Bool
    let calendar: Calendar
    let weekStartsOn: Int
    let timeFormat: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> DateTimePanelAnchorView {
        let view = DateTimePanelAnchorView()
        view.postsFrameChangedNotifications = true
        view.onMove = { [weak coordinator = context.coordinator] in
            coordinator?.anchorDidMove()
        }
        return view
    }

    func updateNSView(_ view: DateTimePanelAnchorView, context: Context) {
        context.coordinator.update(
            anchor: view,
            isPresented: $isPresented,
            date: $date,
            showsTime: showsTime,
            calendar: calendar,
            weekStartsOn: weekStartsOn,
            timeFormat: timeFormat
        )
    }

    static func dismantleNSView(_ view: DateTimePanelAnchorView, coordinator: Coordinator) {
        coordinator.teardown()
    }

    @MainActor
    final class Coordinator: NSObject {
        private weak var anchor: DateTimePanelAnchorView?
        private weak var observedAnchor: DateTimePanelAnchorView?
        private weak var observedWindow: NSWindow?
        private weak var panelParentWindow: NSWindow?
        private var isPresented: Binding<Bool>?
        private var panel: DateTimeSelectionPanel?
        private var hostingView: NSHostingView<DateTimeSelectionPopover>?
        private var eventMonitor: Any?
        private var notificationTokens: [NSObjectProtocol] = []
        private var anchorScreenFrame: CGRect = .zero
        private var showsTime = false

        func update(
            anchor: DateTimePanelAnchorView,
            isPresented: Binding<Bool>,
            date: Binding<Date>,
            showsTime: Bool,
            calendar: Calendar,
            weekStartsOn: Int,
            timeFormat: String
        ) {
            self.anchor = anchor
            self.isPresented = isPresented
            self.showsTime = showsTime

            guard isPresented.wrappedValue else {
                hidePanel()
                return
            }

            let content = DateTimeSelectionPopover(
                date: date,
                showsTime: showsTime,
                calendar: calendar,
                weekStartsOn: weekStartsOn,
                timeFormat: timeFormat
            )
            ensurePanel(content: content)
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

        private func ensurePanel(content: DateTimeSelectionPopover) {
            if let hostingView {
                hostingView.rootView = content
                hostingView.layoutSubtreeIfNeeded()
                return
            }

            let view = NSHostingView(rootView: content)
            view.sizingOptions = []
            let panel = DateTimeSelectionPanel(
                contentRect: CGRect(origin: .zero, size: view.fittingSize),
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
            else {
                return
            }

            hostingView.layoutSubtreeIfNeeded()
            let minimumHeight: CGFloat = showsTime ? 338 : 302
            let size = CGSize(width: 292, height: max(hostingView.fittingSize.height, minimumHeight))
            panel.setContentSize(size)
            hostingView.setFrameSize(size)

            let anchorInWindow = anchor.convert(anchor.bounds, to: nil)
            let anchorOnScreen = window.convertToScreen(anchorInWindow)
            anchorScreenFrame = anchorOnScreen

            let visibleFrame = screen.visibleFrame.insetBy(dx: 8, dy: 8)
            let spaceBelow = anchorOnScreen.minY - visibleFrame.minY
            let spaceAbove = visibleFrame.maxY - anchorOnScreen.maxY
            let opensBelow = spaceBelow >= size.height + 8 || spaceBelow >= spaceAbove
            let proposedY = opensBelow
                ? anchorOnScreen.minY - size.height - 8
                : anchorOnScreen.maxY + 8
            let y = min(max(proposedY, visibleFrame.minY), visibleFrame.maxY - size.height)
            let proposedX = anchorOnScreen.maxX - size.width
            let x = min(max(proposedX, visibleFrame.minX), visibleFrame.maxX - size.width)

            panel.setFrame(CGRect(origin: CGPoint(x: x, y: y), size: size), display: true)
            panel.orderFront(nil)
        }

        private func observe(anchor: DateTimePanelAnchorView, window: NSWindow) {
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
                    if event.keyCode == 53 {
                        if self.panel?.childWindows?.contains(where: { $0.isVisible }) == true { return event }
                        self.dismissFromInteraction()
                        return nil
                    }
                    return event
                }
                let point = event.window?.convertPoint(toScreen: event.locationInWindow) ?? NSEvent.mouseLocation
                let insideChild = self.panel?.childWindows?.contains(where: { $0.isVisible && $0.frame.contains(point) }) == true
                guard self.panel?.frame.contains(point) != true, !insideChild, !self.anchorScreenFrame.contains(point) else { return event }
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

@MainActor
final class DateTimePanelAnchorView: NSView {
    var onMove: (() -> Void)?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        onMove?()
    }

    override func setFrameOrigin(_ newOrigin: NSPoint) {
        super.setFrameOrigin(newOrigin)
        onMove?()
    }
}

@MainActor
private final class DateTimeSelectionPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

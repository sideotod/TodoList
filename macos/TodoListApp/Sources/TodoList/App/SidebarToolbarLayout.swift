import AppKit
import OSLog
import SwiftUI

/// Keep one native title/toolbar row above every split-view column.
struct SidebarToolbarLayout: NSViewRepresentable {
    func makeNSView(context: Context) -> LayoutView { LayoutView() }
    func updateNSView(_ view: LayoutView, context: Context) { view.scheduleLayout() }

    final class LayoutView: NSView {
        private var layoutPending = false
        private weak var observedToolbar: NSToolbar?
        private static let logger = Logger(subsystem: "com.sideotod.TodoList", category: "SidebarLayout")

        override func hitTest(_ point: NSPoint) -> NSView? { nil }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            scheduleLayout()
        }

        func scheduleLayout() {
            guard !layoutPending else { return }
            layoutPending = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                layoutPending = false
                guard let window else { return }
                if window.styleMask.contains(.fullSizeContentView) {
                    let frame = window.frame
                    window.styleMask.remove(.fullSizeContentView)
                    window.setFrame(frame, display: false)
                }
                window.titlebarAppearsTransparent = false
                window.titlebarSeparatorStyle = .line
                if let toolbar = window.toolbar {
                    if observedToolbar !== toolbar {
                        NotificationCenter.default.removeObserver(self, name: NSToolbar.willAddItemNotification, object: observedToolbar)
                        observedToolbar = toolbar
                        NotificationCenter.default.addObserver(self, selector: #selector(toolbarWillAddItem), name: NSToolbar.willAddItemNotification, object: toolbar)
                    }
                    for index in toolbar.items.indices.reversed()
                    where toolbar.items[index] is NSTrackingSeparatorToolbarItem {
                        toolbar.removeItem(at: index)
                    }
                }
                var ancestor: NSView? = self
                while let view = ancestor {
                    if let split = view as? NSSplitView, let controller = split.delegate as? NSSplitViewController {
                        placeSidebarBelowToolbar(in: controller)
                        return
                    }
                    ancestor = view.superview
                }
                var responder: NSResponder? = self
                while let current = responder {
                    if let controller = current as? NSSplitViewController {
                        placeSidebarBelowToolbar(in: controller)
                        return
                    }
                    responder = current.nextResponder
                }
                Self.logger.debug("Sidebar split controller not available")
            }
        }

        @objc private func toolbarWillAddItem(_ notification: Notification) {
            scheduleLayout()
        }

        private func placeSidebarBelowToolbar(in controller: NSSplitViewController) {
            for item in controller.splitViewItems where item.behavior == .sidebar {
                if item.allowsFullHeightLayout {
                    item.allowsFullHeightLayout = false
                    Self.logger.debug("Sidebar placed below toolbar")
                }
            }
        }
    }
}

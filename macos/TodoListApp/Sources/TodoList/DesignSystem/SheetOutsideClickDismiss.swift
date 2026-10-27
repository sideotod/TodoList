import AppKit
import SwiftUI

/// A sheet stays native; this only handles clicks outside the sheet and its child panels.
@MainActor
struct SheetOutsideClickDismiss: NSViewRepresentable {
    let onDismiss: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> SheetDismissAnchor {
        let view = SheetDismissAnchor()
        view.onMove = { [weak coordinator = context.coordinator, weak view] in
            guard let view else { return }
            coordinator?.attach(to: view)
        }
        return view
    }

    func updateNSView(_ view: SheetDismissAnchor, context: Context) {
        context.coordinator.onDismiss = onDismiss
        context.coordinator.attach(to: view)
        DispatchQueue.main.async { [weak coordinator = context.coordinator, weak view] in
            guard let view else { return }
            coordinator?.attach(to: view)
        }
    }

    static func dismantleNSView(_ view: SheetDismissAnchor, coordinator: Coordinator) {
        coordinator.teardown()
    }

    @MainActor
    final class Coordinator {
        var onDismiss: (() -> Void)?
        private weak var sheet: NSWindow?
        private var localMonitor: Any?
        private var globalMonitor: Any?
        private var monitorGeneration = UUID()

        func attach(to anchor: NSView) {
            guard let window = anchor.window,
                  let sheet = window.sheetParent == nil ? window.attachedSheet : window else { return }
            self.sheet = sheet
            guard localMonitor == nil else { return }
            localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
                let point = event.window?.convertPoint(toScreen: event.locationInWindow) ?? NSEvent.mouseLocation
                self?.dismissIfOutside(point)
                return event
            }
            let generation = monitorGeneration
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
                guard let self, self.monitorGeneration == generation, self.localMonitor != nil else { return }
                self.globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
                    MainActor.assumeIsolated { self?.dismissIfOutside(NSEvent.mouseLocation) }
                }
            }
        }

        func teardown() {
            if let localMonitor { NSEvent.removeMonitor(localMonitor) }
            if let globalMonitor { NSEvent.removeMonitor(globalMonitor) }
            localMonitor = nil
            globalMonitor = nil
            monitorGeneration = UUID()
            sheet = nil
        }

        private func dismissIfOutside(_ point: NSPoint) {
            guard let sheet, sheet.isVisible, !contains(point, in: sheet) else { return }
            onDismiss?()
        }

        private func contains(_ point: NSPoint, in window: NSWindow) -> Bool {
            if window.isVisible && window.frame.contains(point) { return true }
            return window.childWindows?.contains { contains(point, in: $0) } == true
        }
    }
}

@MainActor
final class SheetDismissAnchor: NSView {
    var onMove: (() -> Void)?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        onMove?()
    }
}

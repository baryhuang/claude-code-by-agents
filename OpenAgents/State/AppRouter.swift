import Foundation
import Observation
import UniformTypeIdentifiers

/// Top-level navigation state — controls whether we show the workspace selector or a connected workspace.
/// Mirrors the Electron app's behavior: same selector view handles both first-launch (no recent
/// workspace) and the switch flow (with a "back to current workspace" affordance).
@MainActor
@Observable
final class AppRouter {
    enum Route: Equatable {
        /// Selector view. `returnTo` is the workspace currently active that the user can return to,
        /// or nil when there's no current workspace (first launch / disconnected).
        case selector(returnTo: WorkspaceHistoryEntry?)
        case workspace(WorkspaceHistoryEntry)
    }

    var route: Route

    /// Files that arrived from outside the app (iOS "Open in…", macOS "Open
    /// With", drag-onto-dock-icon, etc.) — buffered here until the chat view
    /// is present and can drain them into its composer.
    var pendingExternalAttachments: [PendingAttachment] = []

    init() {
        if let current = WorkspaceHistory.shared.current() {
            self.route = .workspace(current)
        } else {
            self.route = .selector(returnTo: nil)
        }
    }

    /// Read a URL handed to us by the OS and stash it as a `PendingAttachment`
    /// for the chat view to pick up. Handles the security-scoped resource
    /// lifecycle so callers don't have to.
    func ingestExternalURL(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            logError("ui", "external URL ingest failed — could not read \(url.lastPathComponent)")
            return
        }
        let mime = (UTType(filenameExtension: url.pathExtension)?.preferredMIMEType)
            ?? "application/octet-stream"
        pendingExternalAttachments.append(PendingAttachment(
            filename: url.lastPathComponent,
            contentType: mime,
            data: data,
        ))
        logInfo("ui", "ingested external URL \(url.lastPathComponent) (\(data.count) bytes)")
    }

    func connect(
        workspaceId: String,
        token: String,
        name: String? = nil,
        appURL: URL? = nil,
        apiURL: URL? = nil,
    ) {
        let displayName = name ?? workspaceId
        WorkspaceHistory.shared.touch(
            workspaceId: workspaceId,
            token: token,
            name: displayName,
            appURL: appURL?.absoluteString,
            apiURL: apiURL?.absoluteString,
        )
        let entry = WorkspaceHistoryEntry(
            workspaceId: workspaceId,
            workspaceToken: token,
            name: displayName,
            lastUsed: Date(),
            appURL: appURL?.absoluteString,
            apiURL: apiURL?.absoluteString,
        )
        WorkspaceHistory.shared.setCurrent(entry)
        route = .workspace(entry)
    }

    /// Open the selector with a "back to current workspace" affordance — matches the
    /// Electron app's `/?switch=1` flow.
    func switchWorkspace() {
        if case .workspace(let current) = route {
            route = .selector(returnTo: current)
        } else {
            route = .selector(returnTo: nil)
        }
    }

    /// Disconnect entirely — used by the selector's destructive button when switching.
    func disconnect() {
        WorkspaceHistory.shared.setCurrent(nil)
        route = .selector(returnTo: nil)
    }

    /// Cancel switching — return to the workspace that was active before opening the selector.
    func returnToCurrent() {
        if case .selector(let returnTo) = route, let entry = returnTo {
            route = .workspace(entry)
        }
    }

    /// True iff we're currently in switch mode (selector with a workspace to return to).
    var isSwitching: Bool {
        if case .selector(let returnTo) = route { return returnTo != nil }
        return false
    }
}

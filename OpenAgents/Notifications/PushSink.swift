#if os(iOS)
import Foundation
import Observation
import UIKit

/// Bridges the iOS `AppDelegate` (UIKit) and SwiftUI state graph. Owned by
/// `OpenAgentsApp` and held by `AppDelegate` via a weak reference so push
/// callbacks can drive token registration, foreground-suppression decisions,
/// and channel deep-linking without `AppDelegate` reaching into the store.
@MainActor
@Observable
final class PushSink {
    /// Set by the chat view as it appears so the sink can decide whether
    /// to suppress a banner that's redundant with what the user is already
    /// looking at.
    var currentVisibleChannel: String?

    /// Routed from `OpenAgentsApp` so push handlers can switch workspace/channel
    /// when the user taps a banner.
    weak var router: AppRouter?

    /// Last FCM token we successfully handed to a backend — persisted so we can
    /// re-register on workspace history changes without waiting for FCM to
    /// resurface the token.
    private let tokenKey = "pushSink.lastFCMToken"

    var lastFCMToken: String? {
        get { UserDefaults.standard.string(forKey: tokenKey) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: tokenKey)
            } else {
                UserDefaults.standard.removeObject(forKey: tokenKey)
            }
        }
    }

    /// FCM SDK has handed us a token — fan it out to every workspace this
    /// device has connected to so notifications from any of them reach us.
    func handleFCMToken(_ token: String) {
        lastFCMToken = token
        let bundleId = Bundle.main.bundleIdentifier ?? "com.agentrooms.app"
        let entries = WorkspaceHistory.shared.entries()
        guard !entries.isEmpty else {
            logInfo("push", "FCM token ready but no workspaces in history yet — will register on next connect")
            return
        }
        Task.detached {
            for entry in entries {
                let api = WorkspaceAPI(baseURL: entry.resolvedAPIURL)
                await api.configure(
                    workspaceId: entry.workspaceId,
                    token: entry.workspaceToken,
                    baseURL: entry.resolvedAPIURL,
                )
                do {
                    try await api.registerDeviceToken(fcmToken: token, bundleId: bundleId)
                    logInfo("push", "registered device with workspace \(entry.workspaceId) at \(entry.resolvedAPIURL.host ?? "?")")
                } catch {
                    // Older backends won't have /v1/devices/register and will 404 —
                    // that's expected during rollout; log and move on.
                    logInfo("push", "device register failed for \(entry.workspaceId): \(error.localizedDescription)")
                }
            }
        }
    }

    /// Background-delivered push — kick a refresh so the chat list updates
    /// when the user next opens the app, without waiting for the foreground
    /// poll to catch up.
    func handleRemotePush(channelHint: String?) {
        NotificationCenter.default.post(name: AppCommand.refresh.notification, object: nil)
    }

    /// Foreground decision: suppress the banner only when the push is for the
    /// channel the user is already watching in the active app.
    func shouldSuppressForeground(channel: String?) -> Bool {
        guard let channel else { return false }
        guard UIApplication.shared.applicationState == .active else { return false }
        return currentVisibleChannel == channel
    }

    /// User tapped a banner — best-effort hand off to the router so the chat
    /// view opens to that channel. If the workspace isn't the active one, the
    /// router's existing connect flow handles switching first.
    func deepLinkToChannel(_ channel: String, workspaceHint: String?) {
        guard let router else { return }
        if let workspaceHint,
           let entry = WorkspaceHistory.shared.entries().first(where: { $0.workspaceId == workspaceHint }),
           case .workspace(let active) = router.route,
           active.workspaceId != entry.workspaceId {
            router.connect(
                workspaceId: entry.workspaceId,
                token: entry.workspaceToken,
                name: entry.name,
                appURL: URL(string: entry.appURL ?? ""),
                apiURL: URL(string: entry.apiURL ?? ""),
            )
        }
        // The chat view observes `pendingDeepLinkChannel`; setting it here lets
        // the view jump to the right channel as soon as it's on screen.
        pendingDeepLinkChannel = channel
    }

    /// Channel name the next chat view should select on appear. Cleared by the
    /// view once consumed.
    var pendingDeepLinkChannel: String?
}
#endif

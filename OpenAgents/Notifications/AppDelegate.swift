#if os(iOS)
import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

/// iOS-only push notification plumbing. Owns `FirebaseApp.configure()`,
/// permission prompts, APNs↔FCM token bridging, and the foreground /
/// tap delegate callbacks. All app-state interaction routes through
/// `pushSink` so this stays UIKit-flavored and the SwiftUI side stays
/// observable.
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {

    /// Owned by `OpenAgentsApp`; set once at adoption time. Weak so the
    /// AppDelegate doesn't keep the SwiftUI graph alive past its scope.
    weak var pushSink: PushSink?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil,
    ) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self

        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound],
        ) { granted, error in
            if let error {
                logError("push", "requestAuthorization failed: \(error.localizedDescription)")
                return
            }
            logInfo("push", "notification permission granted=\(granted)")
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data,
    ) {
        // FCM SDK absorbs the APNs token; the FCM token arrives via
        // MessagingDelegate.
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error,
    ) {
        logError("push", "APNs registration failed: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void,
    ) {
        let channel = userInfo["channel"] as? String
        Task { @MainActor in
            self.pushSink?.handleRemotePush(channelHint: channel)
            completionHandler(.newData)
        }
    }
}

extension AppDelegate: @preconcurrency MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        logInfo("push", "FCM token received (\(fcmToken.prefix(12))…)")
        pushSink?.handleFCMToken(fcmToken)
    }
}

extension AppDelegate: @preconcurrency UNUserNotificationCenterDelegate {
    /// Foreground delivery — suppress the banner when the user is already
    /// looking at the affected chat; otherwise let iOS show its standard
    /// banner so the user can pivot. Apple delivers UN callbacks on the
    /// main queue, so we keep the whole conformance `@MainActor` via
    /// `@preconcurrency`.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void,
    ) {
        let info = notification.request.content.userInfo
        let channel = info["channel"] as? String
        if pushSink?.shouldSuppressForeground(channel: channel) == true {
            completionHandler([])
        } else {
            completionHandler([.banner, .sound, .badge])
        }
    }

    /// User tapped a banner — deep-link to the channel via the router.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void,
    ) {
        let info = response.notification.request.content.userInfo
        let channel = info["channel"] as? String
        let workspaceHint = info["workspace_id"] as? String
        if let channel {
            pushSink?.deepLinkToChannel(channel, workspaceHint: workspaceHint)
        }
        completionHandler()
    }
}
#endif

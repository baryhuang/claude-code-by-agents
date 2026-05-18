import SwiftUI

/// Custom app-menu items. Implemented via NotificationCenter so they can reach
/// view-local state without threading bindings through the entire view tree.
enum AppCommand: String {
    case newThread
    case switchWorkspace
    case refresh
    case openDebugLog
    case openSettings

    var notification: Notification.Name {
        Notification.Name("OpenAgents.\(rawValue)")
    }
}

extension View {
    func onAppCommand(_ command: AppCommand, perform action: @escaping () -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: command.notification)) { _ in
            action()
        }
    }
}

struct OpenAgentsCommands: Commands {
    var body: some Commands {
        // Replaces the standard "Settings…" item in the app menu with one that opens our
        // sheet. Standard ⌘, shortcut is wired automatically.
        CommandGroup(replacing: .appSettings) {
            Button("Settings…") {
                NotificationCenter.default.post(name: AppCommand.openSettings.notification, object: nil)
            }
            .keyboardShortcut(",", modifiers: .command)
        }
        CommandGroup(replacing: .newItem) {
            Button("New Thread") {
                NotificationCenter.default.post(name: AppCommand.newThread.notification, object: nil)
            }
            .keyboardShortcut("n", modifiers: .command)
        }
        CommandMenu("Workspace") {
            Button("Switch Workspace…") {
                NotificationCenter.default.post(name: AppCommand.switchWorkspace.notification, object: nil)
            }
            .keyboardShortcut("k", modifiers: [.command, .shift])
            Divider()
            Button("Refresh") {
                NotificationCenter.default.post(name: AppCommand.refresh.notification, object: nil)
            }
            .keyboardShortcut("r", modifiers: .command)
        }
        CommandMenu("Debug") {
            Button("Show Debug Log…") {
                NotificationCenter.default.post(name: AppCommand.openDebugLog.notification, object: nil)
            }
            .keyboardShortcut("l", modifiers: [.command, .option])
        }
    }
}

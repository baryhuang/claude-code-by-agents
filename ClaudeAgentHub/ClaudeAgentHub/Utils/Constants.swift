import Foundation
import SwiftUI

struct Constants {
    // MARK: - Colors
    struct Colors {
        static let primary = Color.blue
        static let secondary = Color.gray
        static let accent = Color.purple
        static let success = Color.green
        static let warning = Color.orange
        static let error = Color.red
        
        static let userMessageBackground = Color.blue.opacity(0.1)
        static let assistantMessageBackground = Color.gray.opacity(0.1)
        static let systemMessageBackground = Color.green.opacity(0.1)
        static let errorMessageBackground = Color.red.opacity(0.1)
    }
    
    // MARK: - Dimensions
    struct Dimensions {
        static let cornerRadius: CGFloat = 12
        static let smallCornerRadius: CGFloat = 8
        static let padding: CGFloat = 16
        static let smallPadding: CGFloat = 8
        static let messagePadding: CGFloat = 12
        
        static let minChatInputHeight: CGFloat = 44
        static let maxChatInputHeight: CGFloat = 120
        
        static let tabBarHeight: CGFloat = 60
        static let navigationBarHeight: CGFloat = 44
    }
    
    // MARK: - Animation
    struct Animation {
        static let standard = SwiftUI.Animation.easeInOut(duration: 0.3)
        static let quick = SwiftUI.Animation.easeInOut(duration: 0.15)
        static let spring = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.8)
    }
    
    // MARK: - Icons
    struct Icons {
        static let agents = "person.3.fill"
        static let chat = "message.fill"
        static let projects = "folder.fill"
        static let settings = "gear"
        static let history = "clock.fill"
        static let send = "arrow.up.circle.fill"
        static let stop = "stop.circle.fill"
        static let add = "plus.circle.fill"
        static let edit = "pencil"
        static let delete = "trash"
        static let orchestrator = "crown.fill"
        static let agent = "person.fill"
        static let tool = "wrench.fill"
        static let error = "exclamationmark.triangle.fill"
        static let success = "checkmark.circle.fill"
    }
    
    // MARK: - Strings
    struct Strings {
        static let appName = "Claude Agent Hub"
        static let agentsTab = "Agents"
        static let chatTab = "Chat"
        static let projectsTab = "Projects"
        static let settingsTab = "Settings"
        
        static let groupMode = "Orchestrator"
        static let agentMode = "Agent View"
        
        static let sendMessage = "Send message..."
        static let noAgentsSelected = "No agent selected"
        static let noMessagesYet = "No messages yet. Start a conversation!"
        
        static let loadingProjects = "Loading projects..."
        static let loadingHistory = "Loading conversation history..."
        static let loadingMessages = "Loading messages..."
        
        static let errorTitle = "Error"
        static let retryButton = "Retry"
        static let cancelButton = "Cancel"
        static let saveButton = "Save"
        static let addButton = "Add"
        static let editButton = "Edit"
        static let deleteButton = "Delete"
    }
    
    // MARK: - Keyboard Shortcuts
    struct KeyboardShortcuts {
        static let sendMessage = "return"
        static let newLine = "shift+return"
        static let abortRequest = "escape"
    }
    
    // MARK: - Network
    struct Network {
        static let defaultTimeout: TimeInterval = 30
        static let streamingTimeout: TimeInterval = 300
        static let defaultAPIBaseURL = "http://localhost:8080"
    }
    
    // MARK: - Haptic Feedback
    enum HapticFeedback {
        case light
        case medium
        case heavy
        case success
        case warning
        case error
        
        func trigger() {
            switch self {
            case .light:
                let impact = UIImpactFeedbackGenerator(style: .light)
                impact.impactOccurred()
            case .medium:
                let impact = UIImpactFeedbackGenerator(style: .medium)
                impact.impactOccurred()
            case .heavy:
                let impact = UIImpactFeedbackGenerator(style: .heavy)
                impact.impactOccurred()
            case .success:
                let notification = UINotificationFeedbackGenerator()
                notification.notificationOccurred(.success)
            case .warning:
                let notification = UINotificationFeedbackGenerator()
                notification.notificationOccurred(.warning)
            case .error:
                let notification = UINotificationFeedbackGenerator()
                notification.notificationOccurred(.error)
            }
        }
    }
}
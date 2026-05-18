import Foundation

/// A chat message rendered in the conversation view.
struct Message: Identifiable, Sendable, Equatable {
    let messageId: String
    let sessionId: String
    /// "human" or "agent".
    let senderType: String
    let senderName: String
    let content: String
    let mentions: [String]
    /// "chat", "status", "thinking", etc.
    let messageType: String
    /// Unix milliseconds.
    let timestamp: Int64
    /// Optional agent-emitted UI spec rendered inline in the bubble. `content`
    /// (markdown narration) and the spec coexist — agents may narrate above
    /// and render below.
    let attachment: A2UIAttachment?

    var id: String { messageId }
    var isFromUser: Bool { senderType == "human" }
    var isStatus: Bool { messageType == "status" || messageType == "thinking" }
    var date: Date { Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000.0) }

    /// Synthesize a local status row used as an optimistic UI update when the
    /// user invokes a control action (Stop, /restart, etc.). The next real
    /// status from the backend overwrites it via the normal message-poll path.
    static func localStatus(channel: String, content: String, idPrefix: String = "local-status-") -> Message {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        return Message(
            messageId: "\(idPrefix)\(now)",
            sessionId: channel,
            senderType: "agent",
            senderName: "system",
            content: content,
            mentions: [],
            messageType: "status",
            timestamp: now,
            attachment: nil,
        )
    }

    static func localStoppingStatus(channel: String) -> Message {
        localStatus(channel: channel, content: "Stopping...", idPrefix: "local-stopping-")
    }
}

/// An agent-emitted UI spec attached to a Message. `json` is the raw spec
/// string passed verbatim to `A2UIRendererView`. `toolCallId` lets us route
/// user interactions back to the originating tool call when we send the
/// action result upstream (Phase 5).
struct A2UIAttachment: Sendable, Equatable {
    let json: String
    let toolCallId: String?
}

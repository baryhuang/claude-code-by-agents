import Foundation

/// A small JSON value type so payload/metadata can cross actor boundaries (Sendable) without
/// reaching for `Any`. Only the cases we actually need.
enum JSONValue: Codable, Sendable, Equatable {
    case null
    case bool(Bool)
    case int(Int64)
    case double(Double)
    case string(String)
    indirect case array([JSONValue])
    indirect case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let int = try? container.decode(Int64.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:                     try container.encodeNil()
        case .bool(let value):          try container.encode(value)
        case .int(let value):           try container.encode(value)
        case .double(let value):        try container.encode(value)
        case .string(let value):        try container.encode(value)
        case .array(let value):         try container.encode(value)
        case .object(let value):        try container.encode(value)
        }
    }

    var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    var stringArrayValue: [String]? {
        guard case .array(let items) = self else { return nil }
        return items.compactMap { $0.stringValue }
    }

    subscript(key: String) -> JSONValue? {
        guard case .object(let dict) = self else { return nil }
        return dict[key]
    }
}

/// Wire format for the event-native API. Used internally by WorkspaceAPI.
struct ONMEvent: Decodable, Sendable {
    let id: String
    let type: String
    let source: String
    let target: String
    let payload: JSONValue?
    let metadata: JSONValue?
    let timestamp: Int64
    let visibility: String?

    /// Convert this event into a Message for the chat UI.
    func toMessage() -> Message {
        let isHuman = source.hasPrefix("human:")
        let senderName = source
            .replacingOccurrences(of: "openagents:", with: "")
            .replacingOccurrences(of: "human:", with: "")
        let content = payload?["content"]?.stringValue ?? ""
        let messageType = payload?["message_type"]?.stringValue ?? "chat"
        let mentions = payload?["mentions"]?.stringArrayValue ?? []
        let attachment = ONMEvent.extractAttachment(from: payload)

        return Message(
            messageId: id,
            sessionId: target.replacingOccurrences(of: "channel/", with: ""),
            senderType: isHuman ? "human" : "agent",
            senderName: senderName,
            content: content,
            mentions: mentions,
            messageType: messageType,
            timestamp: timestamp,
            attachment: attachment,
        )
    }

    /// Pull an A2UI spec out of the message payload, if present. The agent
    /// can deliver it as either an inline JSON object (preferred) or a
    /// pre-serialized string — we accept both so we don't bind the backend
    /// to a single encoding choice. Returns nil when there's no spec.
    private static func extractAttachment(from payload: JSONValue?) -> A2UIAttachment? {
        guard let specValue = payload?["spec"] else { return nil }
        let toolCallId = payload?["spec_tool_call_id"]?.stringValue

        switch specValue {
        case .string(let s) where !s.isEmpty:
            return A2UIAttachment(json: s, toolCallId: toolCallId)
        case .object:
            guard let data = try? JSONEncoder().encode(specValue),
                  let json = String(data: data, encoding: .utf8) else {
                return nil
            }
            return A2UIAttachment(json: json, toolCallId: toolCallId)
        default:
            return nil
        }
    }
}

struct EventPollResponse: Decodable, Sendable {
    let events: [ONMEvent]
    let has_more: Bool
    let oldest_id: String?
    let newest_id: String?
}

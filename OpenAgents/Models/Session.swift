import Foundation

/// A thread/channel within a workspace.
struct Session: Identifiable, Sendable, Equatable {
    let sessionId: String
    let workspaceId: String
    let createdBy: String?
    var title: String
    var status: String
    var starred: Bool
    let participants: [String]
    let master: String?
    let createdAt: String?
    /// Unix milliseconds of the last event in this session, or nil if empty.
    let lastEventAt: Int64?

    var id: String { sessionId }
    var isActive: Bool { status == "active" }
    var isArchived: Bool { status == "archived" }
}

/// Wire format from /v1/discover.
struct NetworkChannel: Decodable, Sendable {
    let address: String
    let title: String?
    let master: String?
    let participants: [String]
    let created_at: Int64?
    let last_event_at: Int64?
    let status: String?
    let starred: Bool?

    func toSession(workspaceId: String) -> Session {
        let name = address.replacingOccurrences(of: "channel/", with: "")
        return Session(
            sessionId: name,
            workspaceId: workspaceId,
            createdBy: nil,
            title: title ?? name,
            status: status ?? "active",
            starred: starred ?? false,
            participants: participants,
            master: master,
            createdAt: created_at.map { Date(timeIntervalSince1970: TimeInterval($0) / 1000.0).iso8601String },
            lastEventAt: last_event_at,
        )
    }
}

extension Date {
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}

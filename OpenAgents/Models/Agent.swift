import Foundation

struct Agent: Identifiable, Decodable, Sendable, Hashable {
    let agentName: String
    let role: String
    let agentType: String?
    let serverHost: String?
    let workingDir: String?
    let description: String?
    let status: String
    let lastHeartbeatAt: String?
    let joinedAt: String?

    var id: String { agentName }

    var isOnline: Bool { status == "online" }
    var isMaster: Bool { role == "master" }

    /// Two-character initials used for the avatar tile (matches the web app's getAgentInitials).
    var initials: String {
        let parts = agentName.split(separator: "-").prefix(2)
        if parts.count >= 2 {
            return parts.compactMap { $0.first }.map { String($0).uppercased() }.joined()
        }
        return String(agentName.prefix(2)).uppercased()
    }
}

/// Wire format from the /v1/discover endpoint.
struct NetworkAgent: Decodable, Sendable {
    let address: String
    let role: String
    let status: String
    let agent_type: String?
    let server_host: String?
    let working_dir: String?
    let description: String?
    let last_heartbeat_at: String?
    let joined_at: String?

    func toAgent() -> Agent {
        Agent(
            agentName: address.replacingOccurrences(of: "openagents:", with: ""),
            role: role,
            agentType: agent_type,
            serverHost: server_host,
            workingDir: working_dir,
            description: description,
            status: status,
            lastHeartbeatAt: last_heartbeat_at,
            joinedAt: joined_at,
        )
    }
}

import Foundation

struct Workspace: Identifiable, Decodable, Sendable, Equatable {
    let workspaceId: String
    let slug: String
    let name: String
    let creatorEmail: String?
    let status: String
    let createdAt: String?
    let lastActivityAt: String?
    let agents: [Agent]

    var id: String { workspaceId }

    enum CodingKeys: String, CodingKey {
        case workspaceId
        case slug
        case name
        case creatorEmail
        case status
        case createdAt
        case lastActivityAt
        case agents
    }
}

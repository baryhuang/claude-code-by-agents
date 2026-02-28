import Foundation

struct Agent: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String
    let workingDirectory: String
    let apiEndpoint: String
    let isOrchestrator: Bool
    let isEnabled: Bool
    
    init(id: String, name: String, description: String, workingDirectory: String, apiEndpoint: String, isOrchestrator: Bool = false, isEnabled: Bool = true) {
        self.id = id
        self.name = name
        self.description = description
        self.workingDirectory = workingDirectory
        self.apiEndpoint = apiEndpoint
        self.isOrchestrator = isOrchestrator
        self.isEnabled = isEnabled
    }
    
    static let sampleAgents: [Agent] = [
        Agent(
            id: "orchestrator-agent",
            name: "Orchestrator Agent",
            description: "Orchestrates multi-agent conversations",
            workingDirectory: "/tmp/orchestrator",
            apiEndpoint: "http://localhost:8080",
            isOrchestrator: true
        )
    ]
}

struct AgentSession {
    let agentId: String
    var sessionId: String?
    var messages: [ChatMessage]
    var lastActiveTime: Date
    
    init(agentId: String) {
        self.agentId = agentId
        self.sessionId = nil
        self.messages = []
        self.lastActiveTime = Date()
    }
}

extension Agent {
    var displayName: String {
        return isOrchestrator ? "🎭 \(name)" : name
    }
    
    var statusColor: String {
        return isEnabled ? (isOrchestrator ? "purple" : "blue") : "gray"
    }
}
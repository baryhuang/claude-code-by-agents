import Foundation

class AppSettings: ObservableObject {
    @Published var agents: [Agent] = []
    @Published var apiBaseURL: String = "http://localhost:8080"
    @Published var selectedProjectPath: String?
    @Published var isDarkMode: Bool = false
    @Published var enableHapticFeedback: Bool = true
    @Published var autoScrollEnabled: Bool = true
    
    private let userDefaults = UserDefaults.standard
    
    private enum Keys {
        static let agents = "agents"
        static let apiBaseURL = "apiBaseURL"
        static let selectedProjectPath = "selectedProjectPath"
        static let isDarkMode = "isDarkMode"
        static let enableHapticFeedback = "enableHapticFeedback"
        static let autoScrollEnabled = "autoScrollEnabled"
    }
    
    init() {
        loadSettings()
        
        // Set default agents if none exist
        if agents.isEmpty {
            agents = Agent.sampleAgents
            saveAgents()
        }
    }
    
    private func loadSettings() {
        // Load agents
        if let agentsData = userDefaults.data(forKey: Keys.agents),
           let loadedAgents = try? JSONDecoder().decode([Agent].self, from: agentsData) {
            agents = loadedAgents
        }
        
        // Load other settings
        apiBaseURL = userDefaults.string(forKey: Keys.apiBaseURL) ?? "http://localhost:8080"
        selectedProjectPath = userDefaults.string(forKey: Keys.selectedProjectPath)
        isDarkMode = userDefaults.bool(forKey: Keys.isDarkMode)
        enableHapticFeedback = userDefaults.bool(forKey: Keys.enableHapticFeedback)
        autoScrollEnabled = userDefaults.bool(forKey: Keys.autoScrollEnabled)
    }
    
    func saveAgents() {
        if let agentsData = try? JSONEncoder().encode(agents) {
            userDefaults.set(agentsData, forKey: Keys.agents)
        }
    }
    
    func saveAPIBaseURL() {
        userDefaults.set(apiBaseURL, forKey: Keys.apiBaseURL)
    }
    
    func saveSelectedProjectPath() {
        userDefaults.set(selectedProjectPath, forKey: Keys.selectedProjectPath)
    }
    
    func saveAppearanceSettings() {
        userDefaults.set(isDarkMode, forKey: Keys.isDarkMode)
    }
    
    func saveUserPreferences() {
        userDefaults.set(enableHapticFeedback, forKey: Keys.enableHapticFeedback)
        userDefaults.set(autoScrollEnabled, forKey: Keys.autoScrollEnabled)
    }
    
    // Agent management
    func addAgent(_ agent: Agent) {
        agents.append(agent)
        saveAgents()
    }
    
    func updateAgent(_ agent: Agent) {
        if let index = agents.firstIndex(where: { $0.id == agent.id }) {
            agents[index] = agent
            saveAgents()
        }
    }
    
    func deleteAgent(withId agentId: String) {
        agents.removeAll { $0.id == agentId }
        saveAgents()
    }
    
    func getOrchestratorAgent() -> Agent? {
        return agents.first { $0.isOrchestrator && $0.isEnabled }
    }
    
    func getWorkerAgents() -> [Agent] {
        return agents.filter { !$0.isOrchestrator && $0.isEnabled }
    }
    
    func getAgent(withId agentId: String) -> Agent? {
        return agents.first { $0.id == agentId }
    }
    
    // API endpoints
    var chatURL: URL? {
        return URL(string: "\(apiBaseURL)/api/chat")
    }
    
    var projectsURL: URL? {
        return URL(string: "\(apiBaseURL)/api/projects")
    }
    
    func abortURL(requestId: String) -> URL? {
        return URL(string: "\(apiBaseURL)/api/abort/\(requestId)")
    }
    
    func historiesURL(encodedProjectName: String) -> URL? {
        return URL(string: "\(apiBaseURL)/api/projects/\(encodedProjectName)/histories")
    }
    
    func conversationURL(encodedProjectName: String, sessionId: String) -> URL? {
        return URL(string: "\(apiBaseURL)/api/projects/\(encodedProjectName)/histories/\(sessionId)")
    }
}
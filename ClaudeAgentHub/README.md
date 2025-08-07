# Claude Agent Hub - iOS

A native iOS app that replicates the functionality of the Claude Code Web Agent desktop application, providing multi-agent orchestration and chat capabilities on iPhone and iPad.

## Features

### 🤖 Multi-Agent Management
- Configure and manage multiple AI agents (local and remote)
- Support for orchestrator agents that coordinate workflows
- Individual agent conversations and orchestrator modes
- Agent-specific working directories and API endpoints

### 💬 Real-Time Chat Interface
- Streaming responses from Claude
- Support for @mentions to direct messages to specific agents
- Message bubbles with different types (user, assistant, system, tool, error)
- Execution plan visualization for multi-step workflows

### 📁 Project Management
- Select working directories for agent context
- Browse available projects from backend server
- Custom project path support

### ⚙️ Settings & Configuration
- API endpoint configuration with connection testing
- Dark/light mode toggle with system preference sync
- Haptic feedback settings
- Auto-scroll preferences
- Agent configuration import/export

### 🎨 iOS-Specific Features
- Native SwiftUI interface with iOS design patterns
- Haptic feedback for user interactions
- Safe area handling and keyboard management
- Responsive design for iPhone and iPad
- Background task handling for long-running requests

## Architecture

### Tech Stack
- **Language**: Swift 5.9+
- **Framework**: SwiftUI + Combine
- **Networking**: URLSession with async/await
- **Storage**: UserDefaults + JSON serialization
- **Deployment**: iOS 16.0+ target

### Project Structure
```
ClaudeAgentHub/
├── Models/                 # Data models
│   ├── Agent.swift
│   ├── ChatMessage.swift
│   ├── Project.swift
│   └── AppSettings.swift
├── ViewModels/            # MVVM view models
│   ├── AgentHubViewModel.swift
│   ├── ChatViewModel.swift
│   └── SettingsViewModel.swift
├── Views/                 # SwiftUI views
│   ├── ContentView.swift
│   ├── AgentHubView.swift
│   ├── ChatView.swift
│   ├── ProjectSelectorView.swift
│   ├── SettingsView.swift
│   └── Components/        # Reusable UI components
│       ├── MessageBubbleView.swift
│       ├── AgentCardView.swift
│       └── ExecutionPlanView.swift
├── Services/              # Network and business logic
│   ├── APIService.swift
│   ├── ClaudeStreamingService.swift
│   └── HistoryService.swift
└── Utils/                 # Utilities and extensions
    ├── Constants.swift
    └── Extensions.swift
```

### MVVM Architecture
The app follows the Model-View-ViewModel (MVVM) pattern:
- **Models**: Data structures and business entities
- **Views**: SwiftUI views for UI presentation
- **ViewModels**: Observable objects that handle business logic and state management
- **Services**: Network communication and data processing

## Backend Compatibility

This iOS app is designed to work with the existing Claude Code Web Agent backend:

### API Endpoints
- `GET /api/projects` - List available projects
- `POST /api/chat` - Send messages and receive streaming responses
- `POST /api/abort/:requestId` - Abort ongoing requests
- `GET /api/projects/:project/histories` - Get conversation history
- `GET /api/projects/:project/histories/:sessionId` - Get specific conversation

### Message Streaming
The app supports the same streaming JSON format as the web application:
- `claude_json` messages with system, assistant, and result types
- Tool execution messages with parameters
- Error handling and request abortion
- Session continuity across messages

## Development Setup

### Prerequisites
- Xcode 15.0+
- iOS 16.0+ deployment target
- Claude Code Web Agent backend running (for API communication)

### Building the App
1. Open `ClaudeAgentHub.xcodeproj` in Xcode
2. Select your development team and bundle identifier
3. Choose your target device (iPhone/iPad or Simulator)
4. Build and run (⌘+R)

### Configuration
1. Launch the app and go to Settings
2. Configure the API base URL (default: http://localhost:8080)
3. Test the connection to ensure backend accessibility
4. Add your agents with appropriate endpoints and working directories
5. Select a project directory to work with

## Usage

### Setting Up Agents
1. Go to Settings → Agents
2. Add an orchestrator agent (for multi-agent coordination)
3. Add worker agents for specific tasks (API, frontend, etc.)
4. Configure working directories and API endpoints for each agent

### Orchestrator Mode
- Orchestrator coordinates multiple agents
- Use @mentions to direct tasks to specific agents
- View execution plans for multi-step workflows
- Automatic task decomposition and coordination

### Individual Agent Mode
- Direct one-on-one conversations with specific agents
- Context maintained within agent's working directory
- Session continuity for follow-up questions

### Project Context
- Select project directory in Projects tab
- All agents operate within the selected project context
- Claude commands execute with proper file access

## Key Differences from Web App

### iOS Enhancements
- **Native Performance**: SwiftUI provides 60fps smooth animations and transitions
- **Haptic Feedback**: Tactile feedback for user actions and state changes
- **System Integration**: Respects system dark/light mode and accessibility settings
- **Touch Interface**: Optimized for touch interaction with proper sizing and spacing

### Platform Adaptations
- **Keyboard Handling**: Smart keyboard management with message input
- **Safe Areas**: Proper handling of notches and home indicators
- **Background Tasks**: Limited background processing for long requests
- **Network Management**: URLSession with proper error handling and retry logic

## Contributing

When contributing to the iOS app:

1. Follow Apple's Human Interface Guidelines
2. Use SwiftUI best practices and design patterns
3. Maintain compatibility with the existing backend API
4. Test on both iPhone and iPad devices
5. Ensure accessibility support for VoiceOver users

## License

MIT License - same as the original Claude Code Web Agent project.

## Roadmap

### Immediate Items
- [ ] Siri Shortcuts integration for quick agent interactions
- [ ] iPad multitasking and Split View support
- [ ] Document picker integration for file operations
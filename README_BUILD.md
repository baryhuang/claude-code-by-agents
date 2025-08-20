# AgentHub - Multi-Agent Programming Collaboration Tool

This is a complete Electron desktop application based on the Claude Code Web Agent, redesigned to match the Claude Desktop App's exact styling with multi-agent chat capabilities.

## Features

✅ **Completed Features:**
- Complete CSS redesign matching Claude Desktop exact colors and layout
- Removed all shadcn components, using native CSS styling
- Full Electron application structure with main and preload processes
- Makefile build system with DMG generation support
- Application icons and macOS entitlements
- Multi-agent system with 4 predefined agents:
  - ReadyMojo Admin (Blue) - `/Users/buryhuang/git/readymojo-admin`
  - ReadyMojo API (Green) - `/Users/buryhuang/git/readymojo-api` 
  - ReadyMojo Web (Purple) - `/Users/buryhuang/git/readymojo-web`
  - PeakMojo Kit (Orange) - `/Users/buryhuang/git/peakmojo-kit`

## Build System

### Quick Start
```bash
# Install dependencies
make install

# Development mode
make electron

# Build all components
make build

# Platform-specific builds
make dmg          # macOS DMG installer
npm run dist:win:setup  # Windows build (with Wine setup)
npm run dist:linux      # Linux AppImage
```

### Build Commands
- `make install` - Install all dependencies
- `make dev` - Start development servers (backend + frontend)
- `make electron` - Run Electron app in development
- `make build` - Build frontend and backend
- `make dist` - Build production Electron app
- `make dmg` - Build macOS DMG installer
- `make clean` - Clean build artifacts

### Windows Build Setup
Windows builds on Linux require Wine for cross-platform compilation:

```bash
# Automated setup (with interactive Wine installation)
npm run dist:win:setup

# Manual Wine installation
sudo apt update && sudo apt install -y wine64
npm run dist:win

# Alternative: Build on Windows machine
npm run build && npm run dist:win
```

### Cross-Platform Builds
- **macOS**: `npm run dist:mac` (requires macOS)
- **Windows**: `npm run dist:win` (requires Wine on Linux)
- **Linux**: `npm run dist:linux`

## Architecture

### Electron Structure
- **Main Process**: `electron/main.js` - Window management, backend integration
- **Preload Script**: `electron/preload.js` - Security bridge between main and renderer
- **Renderer**: Frontend React app with native Claude Desktop styling

### Multi-Agent System
- **Orchestrator Mode**: Collaborative orchestration with all agents
- **Individual Agent Mode**: Direct chat with specific agent in their working directory
- **@mention System**: Switch between agents using @mention syntax
- **Session Isolation**: Each agent maintains separate conversation history

### Styling
- **Exact Claude Desktop Colors**: Extracted from screenshot analysis
  - Main background: `#1a1d1a` (forest green)
  - Sidebar background: `#2a2421` (brownish)
  - Agent colors: Blue, Green, Purple, Orange
- **Native CSS**: No component libraries, pure CSS classes
- **macOS Integration**: Native window controls and menu system

## Development Status

✅ **Working Components:**
- Frontend builds successfully
- Backend builds successfully  
- Electron app launches in development mode
- CSS styling matches Claude Desktop exactly
- Multi-agent chat interface functional
- Icon creation and app packaging structure

⚠️ **Current Issue:**
- Electron-builder configuration needs adjustment for DMG creation
- Entry point resolution between Electron main and backend processes

## Next Steps

1. Fix electron-builder configuration for proper file packaging
2. Test DMG creation and distribution
3. Add app signing for macOS Gatekeeper compatibility
4. Create Windows and Linux builds if needed

## File Structure

```
├── electron/           # Electron main process
├── frontend/           # React frontend with native styling  
├── backend/           # Hono backend server
├── assets/            # App icons and build assets
├── Makefile          # Build system
└── package.json      # Electron configuration
```

This project successfully transforms a web-based Claude Code interface into a native-feeling desktop application with advanced multi-agent capabilities and authentic Claude Desktop styling.
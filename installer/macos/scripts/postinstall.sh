#!/bin/bash

# Agentrooms macOS Service Installer - Post-installation Script
# This script runs after the package installation to set up the service

set -e

INSTALL_TYPE="$1"  # "system" or "user"
CURRENT_USER="${SUDO_USER:-$(whoami)}"

echo "🚀 Agentrooms macOS Service Installer - Post-installation"
echo "=============================================="
echo "Install type: ${INSTALL_TYPE:-user}"
echo "Current user: $CURRENT_USER"

# Install agentrooms npm package globally
echo "📦 Installing agentrooms npm package..."
npm install -g agentrooms

# Verify installation
if ! command -v agentrooms &> /dev/null; then
    echo "❌ agentrooms installation failed"
    exit 1
fi

echo "✅ agentrooms $(agentrooms --version) installed successfully"

if [ "$INSTALL_TYPE" = "system" ]; then
    echo "🔧 Setting up system-wide service..."
    
    # Create system user and group
    echo "👤 Creating _agentrooms system user..."
    if ! dscl . -read /Users/_agentrooms &>/dev/null; then
        sudo dscl . -create /Users/_agentrooms
        sudo dscl . -create /Users/_agentrooms UserShell /usr/bin/false
        sudo dscl . -create /Users/_agentrooms RealName "Agentrooms Service"
        sudo dscl . -create /Users/_agentrooms UniqueID 300
        sudo dscl . -create /Users/_agentrooms PrimaryGroupID 300
        sudo dscl . -create /Groups/_agentrooms
        sudo dscl . -create /Groups/_agentrooms PrimaryGroupID 300
        echo "✅ Created _agentrooms system user"
    else
        echo "✅ _agentrooms user already exists"
    fi
    
    # Create directories and set permissions
    echo "📁 Creating system directories..."
    sudo mkdir -p /var/log/agentrooms /var/lib/agentrooms
    sudo chown _agentrooms:_agentrooms /var/log/agentrooms /var/lib/agentrooms
    sudo chmod 755 /var/log/agentrooms /var/lib/agentrooms
    
    # Install the system service plist
    echo "⚙️  Installing system service..."
    sudo cp "/tmp/agentrooms-installer/com.agentrooms.service.plist" /Library/LaunchDaemons/
    sudo chown root:wheel /Library/LaunchDaemons/com.agentrooms.service.plist
    sudo chmod 644 /Library/LaunchDaemons/com.agentrooms.service.plist
    
    # Load and start the service
    echo "🚀 Starting system service..."
    sudo launchctl load /Library/LaunchDaemons/com.agentrooms.service.plist
    sudo launchctl start com.agentrooms.service
    
    echo "✅ System service installed and started"
    echo "📍 Service running on http://0.0.0.0:8080"
    echo "📜 Logs: /var/log/agentrooms/"
    
else
    echo "🔧 Setting up user service..."
    
    # Create user directories
    echo "📁 Creating user directories..."
    mkdir -p "$HOME/Library/LaunchAgents"
    mkdir -p "$HOME/Library/Logs"
    
    # Customize user service plist
    echo "⚙️  Installing user service..."
    sed "s/__USER__/$CURRENT_USER/g" "/tmp/agentrooms-installer/com.agentrooms.agent.plist" > "$HOME/Library/LaunchAgents/com.agentrooms.agent.plist"
    chmod 644 "$HOME/Library/LaunchAgents/com.agentrooms.agent.plist"
    
    # Load and start the service
    echo "🚀 Starting user service..."
    launchctl load "$HOME/Library/LaunchAgents/com.agentrooms.agent.plist"
    launchctl start com.agentrooms.agent
    
    echo "✅ User service installed and started"
    echo "📍 Service running on http://127.0.0.1:8080"
    echo "📜 Logs: $HOME/Library/Logs/"
fi

# Cleanup temporary files
echo "🧹 Cleaning up..."
rm -rf /tmp/agentrooms-installer

echo ""
echo "🎉 Agentrooms service installed successfully!"
echo ""
echo "Service Management Commands:"
if [ "$INSTALL_TYPE" = "system" ]; then
    echo "  Start:   sudo launchctl start com.agentrooms.service"
    echo "  Stop:    sudo launchctl stop com.agentrooms.service"
    echo "  Status:  sudo launchctl list | grep agentrooms"
    echo "  Logs:    tail -f /var/log/agentrooms/output.log"
else
    echo "  Start:   launchctl start com.agentrooms.agent"
    echo "  Stop:    launchctl stop com.agentrooms.agent"
    echo "  Status:  launchctl list | grep agentrooms"
    echo "  Logs:    tail -f ~/Library/Logs/agentrooms-output.log"
fi
echo ""
echo "🌐 Access your Agentrooms service at: http://localhost:8080"
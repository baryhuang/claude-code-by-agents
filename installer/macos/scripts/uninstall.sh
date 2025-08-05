#!/bin/bash

# Agentrooms macOS Service Uninstaller
# This script removes the agentrooms service and cleans up the system

set -e

echo "🗑️  Agentrooms macOS Service Uninstaller"
echo "======================================="

# Function to remove system service
remove_system_service() {
    echo "🛑 Removing system service..."
    
    # Stop and unload system service
    if launchctl list | grep -q com.agentrooms.service; then
        sudo launchctl stop com.agentrooms.service 2>/dev/null || true
        sudo launchctl unload /Library/LaunchDaemons/com.agentrooms.service.plist 2>/dev/null || true
    fi
    
    # Remove plist file
    if [ -f /Library/LaunchDaemons/com.agentrooms.service.plist ]; then
        sudo rm /Library/LaunchDaemons/com.agentrooms.service.plist
        echo "✅ Removed system service plist"
    fi
    
    # Remove system user (optional - ask user)
    if dscl . -read /Users/_agentrooms &>/dev/null; then
        read -p "Remove _agentrooms system user? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo dscl . -delete /Users/_agentrooms
            sudo dscl . -delete /Groups/_agentrooms 2>/dev/null || true
            echo "✅ Removed _agentrooms system user"
        fi
    fi
    
    # Remove log directories (optional - ask user)
    if [ -d /var/log/agentrooms ]; then
        read -p "Remove log files in /var/log/agentrooms? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf /var/log/agentrooms
            echo "✅ Removed system log directory"
        fi
    fi
    
    # Remove working directory (optional - ask user)
    if [ -d /var/lib/agentrooms ]; then
        read -p "Remove working directory /var/lib/agentrooms? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf /var/lib/agentrooms
            echo "✅ Removed system working directory"
        fi
    fi
}

# Function to remove user service
remove_user_service() {
    echo "🛑 Removing user service..."
    
    # Stop and unload user service
    if launchctl list | grep -q com.agentrooms.agent; then
        launchctl stop com.agentrooms.agent 2>/dev/null || true
        launchctl unload ~/Library/LaunchAgents/com.agentrooms.agent.plist 2>/dev/null || true
    fi
    
    # Remove plist file
    if [ -f ~/Library/LaunchAgents/com.agentrooms.agent.plist ]; then
        rm ~/Library/LaunchAgents/com.agentrooms.agent.plist
        echo "✅ Removed user service plist"
    fi
    
    # Remove log files (optional - ask user)
    if [ -f ~/Library/Logs/agentrooms-output.log ] || [ -f ~/Library/Logs/agentrooms-error.log ]; then
        read -p "Remove log files in ~/Library/Logs? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -f ~/Library/Logs/agentrooms-*.log
            echo "✅ Removed user log files"
        fi
    fi
}

# Check for system service
if [ -f /Library/LaunchDaemons/com.agentrooms.service.plist ]; then
    remove_system_service
fi

# Check for user service
if [ -f ~/Library/LaunchAgents/com.agentrooms.agent.plist ]; then
    remove_user_service
fi

# Remove global npm package
if command -v agentrooms &> /dev/null; then
    read -p "Remove agentrooms npm package? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm uninstall -g agentrooms
        echo "✅ Removed agentrooms npm package"
    fi
fi

echo ""
echo "🎉 Agentrooms service uninstalled successfully!"
echo ""
echo "Note: Your Node.js installation and other global packages remain unchanged."
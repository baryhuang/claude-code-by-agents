#!/bin/bash

# Agentrooms macOS Service Installer - Pre-installation Script
# This script runs before the package installation to prepare the system

set -e

echo "🚀 Agentrooms macOS Service Installer - Pre-installation"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+ first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION+"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION found"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi

echo "✅ npm found"

# Stop existing service if running
if launchctl list | grep -q com.agentrooms.service; then
    echo "🛑 Stopping existing agentrooms system service..."
    sudo launchctl stop com.agentrooms.service 2>/dev/null || true
    sudo launchctl unload /Library/LaunchDaemons/com.agentrooms.service.plist 2>/dev/null || true
fi

if launchctl list | grep -q com.agentrooms.agent; then
    echo "🛑 Stopping existing agentrooms user service..."
    launchctl stop com.agentrooms.agent 2>/dev/null || true
    launchctl unload ~/Library/LaunchAgents/com.agentrooms.agent.plist 2>/dev/null || true
fi

echo "✅ Pre-installation checks completed"
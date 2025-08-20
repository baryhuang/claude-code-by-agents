#!/bin/bash

# Windows Build Script for Agentrooms
# This script handles the Wine dependency for cross-platform Windows builds on Linux

echo "=== Agentrooms Windows Build Script ==="
echo ""

# Check if Wine is installed
if command -v wine64 &> /dev/null || command -v wine &> /dev/null; then
    echo "✓ Wine is already installed"
    WINE_INSTALLED=true
else
    echo "✗ Wine not found"
    WINE_INSTALLED=false
fi

# Function to install Wine
install_wine() {
    echo ""
    echo "Installing Wine (requires sudo)..."
    
    # Update package list
    sudo apt update
    
    # Install Wine
    sudo apt install -y wine64
    
    if command -v wine64 &> /dev/null; then
        echo "✓ Wine installed successfully"
        return 0
    else
        echo "✗ Failed to install Wine"
        return 1
    fi
}

# Function to run the Windows build
run_build() {
    echo ""
    echo "Building Windows distribution..."
    npm run dist:win
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ Windows build completed successfully!"
        echo "  Output directory: ./dist/"
        echo "  Files created:"
        ls -la dist/ | grep -E '\.(exe|zip)$' || echo "    (check dist/ directory for build artifacts)"
    else
        echo ""
        echo "✗ Windows build failed"
        return 1
    fi
}

# Main execution
if [ "$WINE_INSTALLED" = false ]; then
    echo ""
    echo "Wine is required for cross-platform Windows builds on Linux."
    echo "Options:"
    echo "  1. Install Wine automatically (requires sudo)"
    echo "  2. Install Wine manually then re-run this script"
    echo "  3. Build on a Windows machine instead"
    echo ""
    read -p "Install Wine automatically? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if install_wine; then
            run_build
        fi
    else
        echo ""
        echo "To install Wine manually, run:"
        echo "  sudo apt update"
        echo "  sudo apt install -y wine64"
        echo ""
        echo "Then re-run this script or run: npm run dist:win"
        exit 1
    fi
else
    run_build
fi
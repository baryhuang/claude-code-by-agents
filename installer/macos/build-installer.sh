#!/bin/bash

# Agentrooms macOS Service Installer Builder
# This script creates .pkg installers for both system and user service installations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$PROJECT_ROOT/dist"

# Get version from backend package.json
VERSION=$(node -p "require('$PROJECT_ROOT/backend/package.json').version")

echo "🚀 Building Agentrooms macOS Service Installer v$VERSION"
echo "=================================================="

# Clean and create build directories
echo "🧹 Cleaning build directories..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Function to build installer package
build_package() {
    local install_type="$1"
    local package_name="$2"
    local pkg_title="$3"
    local pkg_file="$4"
    
    echo ""
    echo "📦 Building $install_type installer..."
    
    # Create package root structure
    local pkg_root="$BUILD_DIR/${package_name}-root"
    local pkg_scripts="$BUILD_DIR/${package_name}-scripts"
    local pkg_resources="$BUILD_DIR/${package_name}-resources"
    
    mkdir -p "$pkg_root/tmp/agentrooms-installer"
    mkdir -p "$pkg_scripts"
    mkdir -p "$pkg_resources"
    
    # Copy plist templates to package root
    cp "$SCRIPT_DIR/templates/"*.plist "$pkg_root/tmp/agentrooms-installer/"
    
    # Copy and customize installation scripts
    cp "$SCRIPT_DIR/scripts/preinstall.sh" "$pkg_scripts/preinstall"
    
    # Customize postinstall script for install type
    sed "s/INSTALL_TYPE=\"\$1\"/INSTALL_TYPE=\"$install_type\"/" "$SCRIPT_DIR/scripts/postinstall.sh" > "$pkg_scripts/postinstall"
    
    # Make scripts executable
    chmod +x "$pkg_scripts/"*
    
    # Create Distribution file for installer customization
    cat > "$BUILD_DIR/Distribution-$install_type.xml" << EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>$pkg_title</title>
    <organization>com.agentrooms</organization>
    <domains enable_anywhere="true"/>
    <options customize="never" require-scripts="true" rootVolumeOnly="true" />
    
    <welcome file="welcome.html" mime-type="text/html" />
    <license file="license.txt" mime-type="text/plain" />
    
    <pkg-ref id="com.agentrooms.service.pkg"/>
    <options customize="never" require-scripts="false"/>
    <choices-outline>
        <line choice="default">
            <line choice="com.agentrooms.service.pkg"/>
        </line>
    </choices-outline>
    <choice id="default"/>
    <choice id="com.agentrooms.service.pkg" visible="false">
        <pkg-ref id="com.agentrooms.service.pkg"/>
    </choice>
    <pkg-ref id="com.agentrooms.service.pkg" version="$VERSION" onConclusion="none">agentrooms-service-$install_type.pkg</pkg-ref>
</installer-gui-script>
EOF
    
    # Create welcome and license files
    cat > "$pkg_resources/welcome.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Agentrooms Service</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
        .logo { text-align: center; margin: 20px 0; }
        .version { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="logo">
        <h1>🤖 Agentrooms Service</h1>
        <p class="version">Version $VERSION</p>
    </div>
    
    <h2>Welcome to Agentrooms Service Installer</h2>
    
    <p>This installer will set up the Agentrooms backend service as a macOS $install_type service.</p>
    
    <h3>What will be installed:</h3>
    <ul>
        <li>📦 Agentrooms npm package (globally)</li>
        <li>⚙️ macOS $install_type service configuration</li>
        <li>🚀 Automatic service startup</li>
        <li>📜 Logging and monitoring setup</li>
    </ul>
    
    <h3>Requirements:</h3>
    <ul>
        <li>✅ Node.js 20+ (will be verified)</li>
        <li>✅ npm package manager</li>
        <li>✅ macOS 10.15+ recommended</li>
    </ul>
    
    <p><strong>After installation:</strong> The service will be available at <code>http://localhost:8080</code></p>
</body>
</html>
EOF
    
    cat > "$pkg_resources/license.txt" << EOF
MIT License

Copyright (c) 2024 Agentrooms

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
    
    # Build the component package
    echo "🔧 Building component package..."
    pkgbuild \
        --root "$pkg_root" \
        --scripts "$pkg_scripts" \
        --identifier "com.agentrooms.service" \
        --version "$VERSION" \
        --install-location "/" \
        "$BUILD_DIR/agentrooms-service-$install_type.pkg"
    
    # Build the final product package
    echo "📦 Building final installer package..."
    productbuild \
        --distribution "$BUILD_DIR/Distribution-$install_type.xml" \
        --resources "$pkg_resources" \
        --package-path "$BUILD_DIR" \
        "$DIST_DIR/$pkg_file"
    
    echo "✅ Created $pkg_file"
}

# Build system service installer (requires admin privileges)
build_package "system" "agentrooms-system" "Agentrooms System Service" "Agentrooms-System-Service-v$VERSION.pkg"

# Build user service installer (no admin privileges required)
build_package "user" "agentrooms-user" "Agentrooms User Service" "Agentrooms-User-Service-v$VERSION.pkg"

# Create uninstaller script
echo ""
echo "🗑️ Creating uninstaller..."
cp "$SCRIPT_DIR/scripts/uninstall.sh" "$DIST_DIR/Agentrooms-Uninstaller.sh"
chmod +x "$DIST_DIR/Agentrooms-Uninstaller.sh"

# Cleanup build directory
echo "🧹 Cleaning up build files..."
rm -rf "$BUILD_DIR"

echo ""
echo "🎉 Agentrooms macOS installers created successfully!"
echo ""
echo "Created files in $DIST_DIR:"
echo "  📦 Agentrooms-System-Service-v$VERSION.pkg (requires admin privileges)"
echo "  📦 Agentrooms-User-Service-v$VERSION.pkg (user installation)"
echo "  🗑️ Agentrooms-Uninstaller.sh (removal script)"
echo ""
echo "Installation options:"
echo "  🔐 System Service: Runs as system daemon, available to all users"
echo "  👤 User Service: Runs as user agent, only for current user"
echo ""
echo "Both installers will:"
echo "  1. Check Node.js requirements"
echo "  2. Install agentrooms npm package globally"
echo "  3. Set up macOS service configuration"
echo "  4. Start the service automatically"
echo ""
echo "Service will be available at: http://localhost:8080"
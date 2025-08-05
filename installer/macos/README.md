# Agentrooms macOS Service Installer

Automated installer packages for running Agentrooms backend as a macOS system or user service using launchd.

## Quick Start

1. **Build the installers:**
   ```bash
   npm run dist:service:mac
   ```

2. **Choose your installation type:**
   - **System Service** (`Agentrooms-System-Service-v*.pkg`): Runs as system daemon, requires admin privileges
   - **User Service** (`Agentrooms-User-Service-v*.pkg`): Runs as user agent, no admin privileges needed

3. **Install by double-clicking the .pkg file**

4. **Access your service at:** http://localhost:8080

## Installation Types Comparison

| Feature | System Service | User Service |
|---------|----------------|--------------|
| **Admin privileges** | Required | Not required |
| **Runs at boot** | Yes | Only when user logs in |
| **Available to all users** | Yes | Current user only |
| **Network binding** | 0.0.0.0:8080 | 127.0.0.1:8080 |
| **Working directory** | `/var/lib/agentrooms` | `~/` |
| **Log location** | `/var/log/agentrooms/` | `~/Library/Logs/` |
| **System user** | `_agentrooms` | Current user |

## Service Management

### System Service Commands
```bash
# Start service
sudo launchctl start com.agentrooms.service

# Stop service
sudo launchctl stop com.agentrooms.service

# Check status
sudo launchctl list | grep agentrooms

# View logs
tail -f /var/log/agentrooms/output.log
```

### User Service Commands
```bash
# Start service
launchctl start com.agentrooms.agent

# Stop service
launchctl stop com.agentrooms.agent

# Check status
launchctl list | grep agentrooms

# View logs
tail -f ~/Library/Logs/agentrooms-output.log
```

## Uninstallation

Run the provided uninstaller script:
```bash
./Agentrooms-Uninstaller.sh
```

The uninstaller will:
- Stop and remove the service
- Optionally remove logs and working directories
- Optionally remove the global npm package
- Optionally remove system users (for system service)

## Requirements

- **Node.js 20+** (automatically verified during installation)
- **npm** (bundled with Node.js)
- **macOS 10.15+** (recommended)

## File Structure

```
installer/macos/
├── README.md                    # This documentation
├── build-installer.sh          # Main installer builder script
├── templates/
│   ├── com.agentrooms.service.plist  # System service configuration
│   └── com.agentrooms.agent.plist    # User service configuration
└── scripts/
    ├── preinstall.sh           # Pre-installation checks
    ├── postinstall.sh          # Service setup and activation
    └── uninstall.sh            # Service removal script
```

## Technical Details

### Installation Process

1. **Pre-installation checks:**
   - Verify Node.js 20+ is installed
   - Stop any existing agentrooms services
   - Validate system requirements

2. **Package installation:**
   - Install agentrooms npm package globally
   - Copy launchd plist templates to system locations
   - Set up service directories and permissions

3. **Service activation:**
   - Load service configuration into launchd
   - Start the service automatically
   - Verify service is running

### Security Considerations

- **System service** runs with minimal privileges using dedicated `_agentrooms` user
- **User service** runs with current user privileges
- Services are automatically restarted if they crash (`KeepAlive: true`)
- Log files are properly secured with appropriate permissions

### Customization

The installer supports customization through environment variables:

```bash
# Custom port (default: 8080)
AGENTROOMS_PORT=3000 installer/macos/build-installer.sh

# Custom host binding (default: 0.0.0.0 for system, 127.0.0.1 for user)
AGENTROOMS_HOST=localhost installer/macos/build-installer.sh
```

## Troubleshooting

### Common Issues

1. **"Node.js not found" error:**
   - Install Node.js 20+ from https://nodejs.org/
   - Ensure `/usr/local/bin` is in your PATH

2. **Permission denied errors:**
   - For system service: Run installer as administrator
   - For user service: Check file permissions in `~/Library/`

3. **Service won't start:**
   - Check logs for detailed error messages
   - Verify agentrooms npm package installed correctly: `agentrooms --version`
   - Ensure no other service is using port 8080

4. **Port already in use:**
   - Stop other services using port 8080
   - Or customize the port in the plist files before installation

### Debug Commands

```bash
# Check if service is loaded
sudo launchctl list | grep agentrooms  # System service
launchctl list | grep agentrooms       # User service

# Test manual service start
agentrooms --port 8080 --host localhost

# Check npm installation
npm list -g agentrooms
```

## Development

To modify the installer:

1. Edit templates and scripts in `installer/macos/`
2. Test changes: `npm run dist:service:mac`
3. Test installation on clean macOS system
4. Verify service functionality and management commands

## License

MIT License - same as the main Agentrooms project.
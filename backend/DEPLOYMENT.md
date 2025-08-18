# Remote Service Deployment with OAuth Support

This guide explains how to deploy the backend service with automatic Claude OAuth credential patching.

## Quick Start

1. **Deploy the backend code** to your remote service
2. **Install dependencies**: `npm install`  
3. **Run the service**: `npm run dev` or `npm start`

That's it! The preload script patching is now automatic.

## What Happens Automatically

When you run `npm run dev` or `npm start`, the service automatically:

- ✅ **Loads the preload script** (`.cjs` format) that intercepts Claude SDK calls
- ✅ **Sets up credential file path** at `$HOME/.claude-credentials.json`
- ✅ **Enables debug logging** (in dev mode) to show interception working
- ✅ **Uses OAuth credentials** from incoming requests instead of API keys

## Debug Output

When running with `npm run dev`, you'll see:

```bash
🔧 Starting backend with Claude OAuth preload script patching...
📁 Preload script: ./auth/preload-script.cjs  
🗄️ Credentials path: /Users/user/.claude-credentials.json
🐛 Debug logging: enabled

✅ Preload script loaded with platform support: darwin
🔀 Intercepted spawnSync call: security find-generic-password -a $USER -w -s "Claude Code"
📁 Reading credentials from: /Users/user/.claude-credentials.json
```

## How OAuth Credential Flow Works

1. **Frontend sends request** with `claudeAuth` containing OAuth session
2. **Backend extracts credentials** and writes them to credentials file  
3. **Preload script intercepts** Claude SDK credential lookups
4. **Claude SDK gets OAuth credentials** instead of system API keys
5. **Claude API calls succeed** using your authenticated subscription

## Environment Variables

The service automatically sets these environment variables:

- `NODE_OPTIONS`: `--require ./auth/preload-script.cjs` (dev) or `--require ./dist/auth/preload-script.cjs` (prod)
- `CLAUDE_CREDENTIALS_PATH`: `$HOME/.claude-credentials.json`
- `DEBUG_PRELOAD_SCRIPT`: `1` (dev mode only)

## Production Deployment

For production environments:

```bash
# Build the service
npm run build

# Start with preload script patching
npm start
```

The production build automatically copies the preload script to `dist/auth/preload-script.js`.

## Troubleshooting

### "Unknown command cross-env"
This is fixed! The new scripts use native Node.js without external dependencies.

### "Invalid API key" errors
If you still see API key errors, check that:
- The preload script debug output shows credential interception
- OAuth credentials are being sent in the request `claudeAuth` field
- The credentials file is being written to the correct path

### Debug logging
To enable debug logging in production:
```bash
DEBUG_PRELOAD_SCRIPT=1 npm start
```

## Manual Environment Setup (Advanced)

If you need to customize the environment setup, you can manually set:

```bash
export NODE_OPTIONS="--require ./auth/preload-script.cjs"
export CLAUDE_CREDENTIALS_PATH="$HOME/.claude-credentials.json"  
export DEBUG_PRELOAD_SCRIPT=1
node dist/cli/node.js
```

But the automated scripts handle this for you.
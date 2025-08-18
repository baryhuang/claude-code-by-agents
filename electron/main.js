const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const ElectronStorage = require('./storage');

// Claude OAuth Configuration
const AUTHORIZATION_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const SCOPES = ["org:create_api_key", "user:profile", "user:inference"];

const crypto = require('crypto');

// Simple OAuth helper functions
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Store pending auth requests
let pendingAuth = null;

// Keep a global reference of the window object
let mainWindow;
let backendProcess;
let storage;

// Set a consistent user data path for localStorage persistence
app.setPath('userData', path.join(app.getPath('appData'), 'Agentrooms'));

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      // Ensure partition for persistent storage
      partition: 'persist:agentrooms',
      // Additional security settings
      sandbox: false, // We need this false for preload script
      safeDialogs: true,
      safeDialogsMessage: 'Multiple dialog attempts detected'
    },
    titleBarStyle: 'hiddenInset', // macOS style
    trafficLightPosition: { x: 20, y: 20 },
    titleBarOverlay: {
      color: '#1a1d1a',
      symbolColor: '#ffffff'
    },
    backgroundColor: '#1a1d1a', // Match Claude Desktop dark theme
    show: false // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Try to load from dev server, fallback to built files
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      console.log('Frontend dev server not running, loading built files...');
      mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production/build mode, load the built frontend files
    const fs = require('fs');
    let indexPath;
    
    if (app.isPackaged) {
      // In packaged app, files are typically in Resources/app.asar/
      // But we need to handle different packaging scenarios
      const possiblePaths = [
        path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'index.html'),
        path.join(process.resourcesPath, 'frontend', 'dist', 'index.html'),
        path.join(__dirname, '../frontend/dist/index.html'),
        path.join(__dirname, 'frontend/dist/index.html')
      ];
      
      // Find the first path that exists
      indexPath = possiblePaths.find(p => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });
      
      if (!indexPath) {
        indexPath = possiblePaths[0]; // fallback to first path
      }
    } else {
      // During development/testing with built files
      // Try multiple possible locations
      const possiblePaths = [
        path.join(__dirname, '../frontend/dist/index.html'),
        path.join(__dirname, '../../frontend/dist/index.html'),
        path.resolve(__dirname, '../frontend/dist/index.html'),
        path.resolve(process.cwd(), 'frontend/dist/index.html')
      ];
      
      // Find the first path that exists
      indexPath = possiblePaths.find(p => {
        try {
          const exists = fs.existsSync(p);
          console.log(`Checking path: ${p} - exists: ${exists}`);
          return exists;
        } catch {
          return false;
        }
      });
      
      if (!indexPath) {
        console.log('No valid paths found, using first as fallback');
        indexPath = possiblePaths[0];
      }
    }
    
    console.log('Loading frontend from:', indexPath);
    console.log('App is packaged:', app.isPackaged);
    console.log('__dirname:', __dirname);
    console.log('process.resourcesPath:', process.resourcesPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load frontend:', err);
      console.error('All paths failed, unable to load frontend');
      
      // As a last resort, try to load a simple error page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Agentrooms - Loading Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                   padding: 20px; background: #1a1d1a; color: white; }
            h1 { color: #ff6b6b; }
          </style>
        </head>
        <body>
          <h1>Loading Error</h1>
          <p>Failed to load the frontend application.</p>
          <p>Path attempted: ${indexPath}</p>
          <p>Please restart the application or contact support.</p>
        </body>
        </html>
      `;
      
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  // Security: Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow localhost and local files only
    if (parsedUrl.origin !== 'http://localhost:3000' && 
        parsedUrl.origin !== 'http://localhost:8080' &&
        !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
  
  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

function startBackend() {
  if (isDev) {
    // In development, assume backend is running separately
    return;
  }
  
  // In production, start the bundled backend server
  const backendPath = path.join(__dirname, '../backend/dist/cli/node.js');
  console.log('Starting backend from:', backendPath);
  
  backendProcess = spawn('node', [backendPath, '--port', '8080'], {
    stdio: 'pipe', // Capture output
    cwd: path.join(__dirname, '../backend')
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log('Backend:', data.toString());
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error('Backend Error:', data.toString());
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
  
  // Give backend time to start
  return new Promise(resolve => setTimeout(resolve, 2000));
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// App event handlers
app.whenReady().then(async () => {
  // Initialize storage
  storage = new ElectronStorage();
  
  // Setup IPC handlers for persistent storage, security, and auth
  setupStorageHandlers();
  setupSecurityHandlers();
  setupAuthHandlers();
  
  // Skip backend startup since we're running without it
  if (!isDev) {
    console.log('Running in production mode without backend');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isDev) {
    stopBackend();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (!isDev) {
    stopBackend();
  }
});

// macOS Menu
if (process.platform === 'darwin') {
  const template = [
    {
      label: 'Agentrooms',
      submenu: [
        {
          label: 'About Agentrooms',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Hide Agentrooms',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Security IPC Handlers
function setupSecurityHandlers() {
  // Handle external URL opening with validation
  ipcMain.handle('open-external', async (event, url) => {
    try {
      const parsedUrl = new URL(url);
      // Only allow http, https, and mailto protocols
      if (['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
        await shell.openExternal(url);
        return true;
      } else {
        console.error('Blocked attempt to open unsafe URL:', url);
        return false;
      }
    } catch (error) {
      console.error('Invalid URL provided:', url, error);
      return false;
    }
  });
}

// Parse authorization code and state from user input
function parseAuthorizationCode(codeInput) {
  const trimmedInput = codeInput.trim();
  
  if (!trimmedInput) {
    throw new Error('Authorization code cannot be empty');
  }
  
  // Check if the input contains the code#state format from Claude
  if (trimmedInput.includes('#')) {
    const [code, state] = trimmedInput.split('#');
    
    if (!code || !state) {
      throw new Error('Invalid code#state format. Expected format: authorizationCode#stateValue');
    }
    
    // Validate the code part
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      throw new Error('Invalid authorization code format in code#state');
    }
    
    // Validate the state part
    if (!/^[a-zA-Z0-9_-]+$/.test(state)) {
      throw new Error('Invalid state format in code#state');
    }
    
    return { code, state };
  }
  
  // If no # found, treat as just the authorization code
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedInput)) {
    throw new Error('Invalid authorization code format. Please copy the authorization code from the callback page.');
  }
  
  return { code: trimmedInput, state: null };
}

// OAuth Helper Functions
async function startOAuthFlow() {
  try {
    console.log('[OAUTH] Starting Claude OAuth flow...');
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();
    
    // Build authorization URL
    const authParams = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `${AUTHORIZATION_URL}?${authParams.toString()}`;
    
    // Store pending auth for completion
    pendingAuth = {
      codeVerifier,
      state,
      codeChallenge,
      authUrl
    };
    
    console.log('[OAUTH] Opening browser for authentication...');
    console.log('[OAUTH] Auth URL:', authUrl);
    
    // Open the authorization URL in the default browser
    await shell.openExternal(authUrl);
    
    return {
      success: true,
      message: 'Please complete authentication in your browser and copy the authorization code back to the app.',
      pendingAuth: true // Manual input needed
    };
    
  } catch (error) {
    console.error('[OAUTH] Failed to start OAuth flow:', error);
    throw error;
  }
}

async function completeOAuthFlow(authCodeInput) {
  try {
    if (!pendingAuth) {
      throw new Error('No pending authentication flow');
    }
    
    console.log('[OAUTH] Completing OAuth flow with authorization code...');
    
    // Parse and validate the authorization code
    const { code: authCode, state: receivedState } = parseAuthorizationCode(authCodeInput);
    console.log('[OAUTH] Code length:', authCode.length);
    console.log('[OAUTH] Code preview:', authCode.substring(0, 10) + '...');
    
    // Verify state parameter if provided to prevent CSRF attacks
    if (receivedState && receivedState !== pendingAuth.state) {
      throw new Error('State parameter mismatch - possible CSRF attack');
    }
    
    // Exchange authorization code for tokens
    const payload = {
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: pendingAuth.codeVerifier,
      state: receivedState || pendingAuth.state
    };
    
    console.log('[OAUTH] Token exchange payload:', {
      grant_type: payload.grant_type,
      redirect_uri: payload.redirect_uri,
      client_id: payload.client_id,
      code: payload.code.substring(0, 10) + '...',
      code_verifier: payload.code_verifier.substring(0, 10) + '...',
      state: payload.state
    });
    
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OAUTH] Token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('[OAUTH] Token exchange successful');
    
    // Calculate expiration time
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    // Create session object
    const session = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: expiresAt,
      scopes: SCOPES,
      userId: tokenData.account?.uuid || 'unknown',
      subscriptionType: 'unknown', // We'd need to fetch this from profile
      account: {
        email_address: tokenData.account?.email_address || 'unknown',
        uuid: tokenData.account?.uuid || 'unknown'
      }
    };
    
    // Save to storage
    await storage.saveSetting('claudeAuth', { session });
    
    // Write credentials file for backend
    const credentialsPath = path.join(require('os').homedir(), '.claude-credentials.json');
    const credentials = {
      claudeAiOauth: session
    };
    
    require('fs').writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    
    console.log('[OAUTH] Authentication completed successfully');
    
    // Clear pending auth
    pendingAuth = null;
    
    return {
      success: true,
      session: session
    };
    
  } catch (error) {
    console.error('[OAUTH] Failed to complete OAuth flow:', error);
    pendingAuth = null; // Clear on error
    throw error;
  }
}

// Authentication IPC Handlers
function setupAuthHandlers() {
  // Start Claude OAuth flow
  ipcMain.handle('auth:start-oauth', async (event) => {
    try {
      const result = await startOAuthFlow();
      return result;
    } catch (error) {
      console.error('OAuth start failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Complete OAuth flow with manual authorization code input
  ipcMain.handle('auth:complete-oauth', async (event, authCode) => {
    try {
      const result = await completeOAuthFlow(authCode);
      return result;
    } catch (error) {
      console.error('OAuth completion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Check authentication status
  ipcMain.handle('auth:check-status', async (event) => {
    try {
      console.log('[AUTH] Checking authentication status...');
      // Check if we have stored auth data
      const authResult = await storage.loadSetting('claudeAuth');
      console.log('[AUTH] Storage result:', authResult.success ? 'success' : 'failed');
      if (!authResult.success) {
        console.log('[AUTH] Storage error:', authResult.error);
      }
      
      if (authResult.success && authResult.data && authResult.data.session) {
        const authData = authResult.data;
        const now = Date.now();
        const expiresAt = authData.session.expiresAt;
        console.log('[AUTH] Session expires at:', new Date(expiresAt).toISOString());
        console.log('[AUTH] Current time:', new Date(now).toISOString());
        console.log('[AUTH] Session valid:', expiresAt > now + 5 * 60 * 1000);
        
        if (expiresAt > now + 5 * 60 * 1000) {
          console.log('[AUTH] Returning authenticated session');
          return {
            success: true,
            isAuthenticated: true,
            session: authData.session
          };
        } else {
          console.log('[AUTH] Session expired');
        }
      } else {
        console.log('[AUTH] No stored authentication data found');
      }
      
      return {
        success: true,
        isAuthenticated: false,
        session: null
      };
    } catch (error) {
      console.error('Auth check failed:', error);
      return {
        success: false,
        error: error.message,
        isAuthenticated: false
      };
    }
  });

  // Sign out
  ipcMain.handle('auth:sign-out', async (event) => {
    try {
      await storage.saveSetting('claudeAuth', null);
      console.log('User signed out');
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

// Storage IPC Handlers
function setupStorageHandlers() {
  // Agent Configuration
  ipcMain.handle('storage:save-agent-config', async (event, config) => {
    return storage.saveAgentConfig(config);
  });

  ipcMain.handle('storage:load-agent-config', async (event) => {
    return storage.loadAgentConfig();
  });

  // Chat Messages
  ipcMain.handle('storage:save-conversation', async (event, sessionId, messages) => {
    return storage.saveConversation(sessionId, messages);
  });

  ipcMain.handle('storage:load-conversation', async (event, sessionId) => {
    return storage.loadConversation(sessionId);
  });

  ipcMain.handle('storage:list-conversations', async (event) => {
    return storage.listConversations();
  });

  // App Settings
  ipcMain.handle('storage:save-setting', async (event, key, value) => {
    return storage.saveSetting(key, value);
  });

  ipcMain.handle('storage:load-setting', async (event, key) => {
    return storage.loadSetting(key);
  });

  ipcMain.handle('storage:load-all-settings', async (event) => {
    return storage.loadAllSettings();
  });
}
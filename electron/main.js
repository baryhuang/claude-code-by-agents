const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const ElectronStorage = require('./storage');

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
      preload: path.join(__dirname, 'preload.js'),
      // Ensure partition for persistent storage
      partition: 'persist:agentrooms'
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
    // In production, load the built frontend files from the packaged app
    let indexPath;
    if (app.isPackaged) {
      // In packaged app, files are in the app.asar bundle
      indexPath = path.join(__dirname, '../frontend/dist/index.html');
    } else {
      // During development
      indexPath = path.join(__dirname, '../frontend/dist/index.html');
    }
    
    console.log('Loading frontend from:', indexPath);
    console.log('App is packaged:', app.isPackaged);
    console.log('__dirname:', __dirname);
    console.log('process.resourcesPath:', process.resourcesPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load frontend:', err);
      
      // Fallback: try different paths
      const fallbackPaths = [
        path.join(process.resourcesPath, 'app.asar', 'frontend/dist/index.html'),
        path.join(process.resourcesPath, 'frontend/dist/index.html'),
        path.join(__dirname, 'frontend/dist/index.html')
      ];
      
      let loaded = false;
      for (const fallbackPath of fallbackPaths) {
        console.log('Trying fallback path:', fallbackPath);
        try {
          mainWindow.loadFile(fallbackPath);
          loaded = true;
          break;
        } catch (fallbackErr) {
          console.error('Fallback failed:', fallbackPath, fallbackErr);
        }
      }
      
      if (!loaded) {
        console.error('All paths failed, unable to load frontend');
      }
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
  
  // Setup IPC handlers for persistent storage
  setupStorageHandlers();
  
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
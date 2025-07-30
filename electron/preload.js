const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods here if needed in the future
  platform: process.platform,
  
  // Example: openExternal
  openExternal: (url) => {
    ipcRenderer.invoke('open-external', url);
  },

  // Persistent Storage API
  storage: {
    // Agent Configuration
    saveAgentConfig: (config) => ipcRenderer.invoke('storage:save-agent-config', config),
    loadAgentConfig: () => ipcRenderer.invoke('storage:load-agent-config'),
    
    // Chat Messages
    saveConversation: (sessionId, messages) => ipcRenderer.invoke('storage:save-conversation', sessionId, messages),
    loadConversation: (sessionId) => ipcRenderer.invoke('storage:load-conversation', sessionId),
    listConversations: () => ipcRenderer.invoke('storage:list-conversations'),
    
    // App Settings
    saveSetting: (key, value) => ipcRenderer.invoke('storage:save-setting', key, value),
    loadSetting: (key) => ipcRenderer.invoke('storage:load-setting', key),
    loadAllSettings: () => ipcRenderer.invoke('storage:load-all-settings')
  }
});

// Log when preload script loads
console.log('AgentHub preload script loaded');
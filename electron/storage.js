const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ElectronStorage {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.storagePath = path.join(this.userDataPath, 'agentrooms-data');
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  // Agent Settings Storage
  saveAgentConfig(config) {
    const filePath = path.join(this.storagePath, 'agent-config.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to save agent config:', error);
      return { success: false, error: error.message };
    }
  }

  loadAgentConfig() {
    const filePath = path.join(this.storagePath, 'agent-config.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data: JSON.parse(data) };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Failed to load agent config:', error);
      return { success: false, error: error.message };
    }
  }

  // Chat Messages Storage
  saveConversation(sessionId, messages) {
    const conversationsDir = path.join(this.storagePath, 'conversations');
    if (!fs.existsSync(conversationsDir)) {
      fs.mkdirSync(conversationsDir, { recursive: true });
    }
    
    const filePath = path.join(conversationsDir, `${sessionId}.json`);
    try {
      const conversationData = {
        sessionId,
        messages,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(filePath, JSON.stringify(conversationData, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to save conversation:', error);
      return { success: false, error: error.message };
    }
  }

  loadConversation(sessionId) {
    const filePath = path.join(this.storagePath, 'conversations', `${sessionId}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data: JSON.parse(data) };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Failed to load conversation:', error);
      return { success: false, error: error.message };
    }
  }

  listConversations() {
    const conversationsDir = path.join(this.storagePath, 'conversations');
    try {
      if (!fs.existsSync(conversationsDir)) {
        return { success: true, data: [] };
      }
      
      const files = fs.readdirSync(conversationsDir);
      const conversations = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const sessionId = file.replace('.json', '');
          const filePath = path.join(conversationsDir, file);
          const stats = fs.statSync(filePath);
          
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              sessionId,
              lastUpdated: data.lastUpdated || stats.mtime.toISOString(),
              messageCount: data.messages?.length || 0
            };
          } catch (error) {
            return {
              sessionId,
              lastUpdated: stats.mtime.toISOString(),
              messageCount: 0,
              error: 'Failed to parse conversation'
            };
          }
        })
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
      
      return { success: true, data: conversations };
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return { success: false, error: error.message };
    }
  }

  // App Settings Storage
  saveSetting(key, value) {
    const filePath = path.join(this.storagePath, 'app-settings.json');
    let settings = {};
    
    try {
      if (fs.existsSync(filePath)) {
        settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      settings[key] = value;
      settings.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to save setting:', error);
      return { success: false, error: error.message };
    }
  }

  loadSetting(key) {
    const filePath = path.join(this.storagePath, 'app-settings.json');
    try {
      if (fs.existsSync(filePath)) {
        const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { success: true, data: settings[key] };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Failed to load setting:', error);
      return { success: false, error: error.message };
    }
  }

  loadAllSettings() {
    const filePath = path.join(this.storagePath, 'app-settings.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data: JSON.parse(data) };
      }
      return { success: true, data: {} };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ElectronStorage;
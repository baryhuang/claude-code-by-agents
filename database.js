// Stub database module for OAuth service in Electron context
// This provides minimal implementation for the OAuth service dependencies

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SimpleDatabase {
  constructor() {
    // Use Electron userData path for database
    this.dbPath = path.join(app.getPath('userData'), 'auth-data.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load auth database:', error);
    }
    return {};
  }

  saveData() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save auth database:', error);
    }
  }

  // Minimal implementation for OAuth service
  prepare(query) {
    return {
      run: (...params) => {
        // Stub implementation - just log the query
        console.log('DB Query (stub):', query, params);
        return { changes: 1 };
      },
      get: (...params) => {
        // Stub implementation 
        console.log('DB Get (stub):', query, params);
        return null;
      }
    };
  }

  exec(query) {
    console.log('DB Exec (stub):', query);
  }
}

let database = null;

function getMainDatabase() {
  if (!database) {
    database = new SimpleDatabase();
  }
  return database;
}

module.exports = { getMainDatabase };
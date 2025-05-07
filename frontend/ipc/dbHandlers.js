const { ipcMain } = require('electron');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const axios = require('axios');

// Gateway API base URL
const GATEWAY_API_URL = 'http://localhost:7890';

/**
 * Register database-related IPC handlers for the Electron app
 * @param {Electron.BrowserWindow} mainWindow - Main application window
 */
function registerDbHandlers(mainWindow) {
  // Check if PostgreSQL database connection is available
  ipcMain.handle('db:checkConnection', async () => {
    try {
      // Try to get DB configuration from localStorage
      let dbConfig;
      try {
        const configPath = path.join(process.env.APPDATA || (process.platform === 'darwin' ?
          `${process.env.HOME}/Library/Application Support` :
          `${process.env.HOME}/.local/share`),
          'ca-offline-suite', 'db-config.json');

        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          dbConfig = JSON.parse(configData);
        } else {
          // Fall back to default values
          dbConfig = {
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'postgres',
            database: 'ca_offline'
          };
        }
      } catch (err) {
        log.error('Error reading DB config:', err);
        // Fall back to default values
        dbConfig = {
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'ca_offline'
        };
      }

      // Create a new PostgreSQL client
      const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        // Short connection timeout to avoid hanging
        connectionTimeoutMillis: 3000
      });

      // Attempt to connect
      await client.connect();

      // Simple query to verify connection
      const result = await client.query('SELECT NOW()');

      // Close the connection
      await client.end();

      // Return success if we got here
      return {
        connected: true,
        message: 'Database connection successful',
        timestamp: result.rows[0].now
      };
    } catch (error) {
      log.error('Database connection check failed:', error);
      return {
        connected: false,
        message: `Database connection failed: ${error.message}`,
        error: error.message
      };
    }
  });

  // Save database configuration
  ipcMain.handle('db:saveConfig', async (event, config) => {
    try {
      const configDir = path.join(process.env.APPDATA || (process.platform === 'darwin' ?
        `${process.env.HOME}/Library/Application Support` :
        `${process.env.HOME}/.local/share`),
        'ca-offline-suite');

      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configPath = path.join(configDir, 'db-config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      return { success: true, message: 'Database configuration saved successfully' };
    } catch (error) {
      log.error('Error saving DB config:', error);
      return {
        success: false,
        message: `Failed to save database configuration: ${error.message}`,
        error: error.message
      };
    }
  });

  // Check prerequisites for database setup
  ipcMain.handle('db:checkPrerequisites', async () => {
    try {
      const response = await Promise.all([
        axios.post(`${GATEWAY_API_URL}/db/test/network`, { port: 5432 }),
        axios.get(`${GATEWAY_API_URL}/db/test/mdns`),
        axios.post(`${GATEWAY_API_URL}/db/test/firewall`, { port: 5432 })
      ]);

      return {
        networkConnectivity: response[0].data.success,
        mDnsAvailability: response[1].data.success,
        firewallAllowance: response[2].data.success,
        allChecked: true
      };
    } catch (error) {
      log.error('Error checking prerequisites:', error);
      return {
        networkConnectivity: false,
        mDnsAvailability: false,
        firewallAllowance: false,
        allChecked: true,
        error: error.message
      };
    }
  });

  // Discover available PostgreSQL servers
  ipcMain.handle('db:discover', async () => {
    try {
      const response = await axios.get(`${GATEWAY_API_URL}/db/discover`);
      return response.data;
    } catch (error) {
      log.error('Error discovering databases:', error);
      return { success: false, error: error.message };
    }
  });

  // Start download of PostgreSQL binaries
  ipcMain.handle('db:downloadBinaries', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/provision/download`, data);
      return response.data;
    } catch (error) {
      log.error('Error starting download:', error);
      return { success: false, error: error.message };
    }
  });

  // Check provision status
  ipcMain.handle('db:getProvisionStatus', async () => {
    try {
      const response = await axios.get(`${GATEWAY_API_URL}/db/provision/status`);
      return response.data;
    } catch (error) {
      log.error('Error getting provision status:', error);
      return { status: 'error', error: error.message, logs: [] };
    }
  });

  // Extract binaries
  ipcMain.handle('db:extractBinaries', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/provision/extract`, data);
      return response.data;
    } catch (error) {
      log.error('Error extracting binaries:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize database cluster
  ipcMain.handle('db:initCluster', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/provision/initdb`, data);
      return response.data;
    } catch (error) {
      log.error('Error initializing cluster:', error);
      return { success: false, error: error.message };
    }
  });

  // Start PostgreSQL server
  ipcMain.handle('db:startPostgres', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/provision/start`, data);
      return response.data;
    } catch (error) {
      log.error('Error starting PostgreSQL server:', error);
      return { success: false, error: error.message };
    }
  });

  // Advertise via mDNS
  ipcMain.handle('db:advertiseMdns', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/provision/advertise`, data);
      return response.data;
    } catch (error) {
      log.error('Error advertising via mDNS:', error);
      return { success: false, error: error.message };
    }
  });

  // Validate database connection
  ipcMain.handle('db:validateConnection', async (event, data) => {
    try {
      const response = await axios.post(`${GATEWAY_API_URL}/db/validate`, data);
      return response.data;
    } catch (error) {
      log.error('Error validating connection:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerDbHandlers
};

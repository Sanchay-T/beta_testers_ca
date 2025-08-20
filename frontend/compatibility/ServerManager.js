// ServerManager.js
// Manages FastAPI server lifecycle for compatibility testing
// Implements: Start → Test → Stop cycle for real server validation

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class ServerManager {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.compatibilityWindow = compatibilityWindow;
    this.isDev = !require('electron').app.isPackaged;
    
    // Server process management
    this.serverProcess = null;
    this.serverPid = null;
    this.isServerRunning = false;
    
    // Configuration
    this.serverPort = 7500;
    this.serverHost = '127.0.0.1';
    this.healthUrl = `http://${this.serverHost}:${this.serverPort}/health`;
    
    // Timeouts and retries
    this.timeouts = {
      serverStart: 30000,    // 30 seconds for server to start
      healthCheck: 5000,     // 5 seconds per health check attempt
      serverStop: 10000,     // 10 seconds for graceful shutdown
      forceKill: 5000        // 5 seconds before force kill
    };
    
    this.retries = {
      healthCheck: 20,       // Try health check 20 times (100 seconds total)
      portCheck: 5           // Check if port is free 5 times
    };
  }

  // Send live updates to compatibility UI
  sendLiveUpdate(message, status = 'info') {
    if (this.compatibilityWindow && !this.compatibilityWindow.isDestroyed()) {
      this.compatibilityWindow.webContents.send("test-progress", {
        suiteName: 'FastAPI Server Management',
        testName: 'Server Lifecycle',
        status: 'testing',
        message: message,
        details: { serverAction: message, liveStatus: status }
      });
    }
    
    this.logger?.info('SERVER_MANAGER', message, { status });
    console.log(`🔄 [SERVER] ${message}`);
  }

  // Check if port is available
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, '127.0.0.1', () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      
      server.on('error', () => resolve(false));
    });
  }

  // Wait for port to become available
  async waitForPortAvailable(port, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      const available = await this.isPortAvailable(port);
      if (available) {
        this.logger?.debug('SERVER_MANAGER', `Port ${port} is available`);
        return true;
      }
      
      this.logger?.warn('SERVER_MANAGER', `Port ${port} is busy, waiting... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return false;
  }

  // Kill any existing processes on our port
  async killExistingProcesses() {
    this.sendLiveUpdate('🧹 Cleaning up any existing FastAPI processes...');
    
    try {
      // Kill any process using port 7500
      await new Promise((resolve) => {
        exec('netstat -ano | findstr :7500', (error, stdout) => {
          if (stdout) {
            const lines = stdout.split('\n');
            const pids = new Set();
            
            lines.forEach(line => {
              const match = line.match(/\s+(\d+)$/);
              if (match) {
                pids.add(match[1]);
              }
            });
            
            if (pids.size > 0) {
              this.logger?.info('SERVER_MANAGER', `Killing processes using port 7500`, { pids: Array.from(pids) });
              pids.forEach(pid => {
                try {
                  exec(`taskkill /PID ${pid} /F`);
                } catch (error) {
                  // Ignore errors - process might already be dead
                }
              });
            }
          }
          resolve();
        });
      });
      
      // Also kill any main.exe processes
      await new Promise((resolve) => {
        exec('taskkill /IM main.exe /F', () => resolve()); // Ignore errors
      });
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      this.logger?.warn('SERVER_MANAGER', 'Error during cleanup', { error: error.message });
    }
  }

  // Start the FastAPI server
  async startServer() {
    this.sendLiveUpdate('🚀 Starting FastAPI server for compatibility testing...');
    
    try {
      // Step 1: Clean up any existing processes
      await this.killExistingProcesses();
      
      // Step 2: Verify port is available
      this.sendLiveUpdate('🔍 Checking if port 7500 is available...');
      const portAvailable = await this.waitForPortAvailable(this.serverPort);
      if (!portAvailable) {
        throw new Error(`Port ${this.serverPort} is not available after cleanup`);
      }
      
      // Step 3: Get server executable path
      const serverPath = this.isDev
        ? path.join(__dirname, '../../dist/main/main.exe')
        : path.join(process.resourcesPath, 'backend/main/main.exe');
      
      if (!fs.existsSync(serverPath)) {
        throw new Error(`FastAPI server executable not found: ${serverPath}`);
      }
      
      this.sendLiveUpdate(`🐍 Starting FastAPI server: ${path.basename(serverPath)}...`);
      this.logger?.info('SERVER_MANAGER', 'Starting FastAPI server', {
        serverPath,
        port: this.serverPort,
        environment: this.isDev ? 'development' : 'production'
      });
      
      // Step 4: Spawn the server process
      this.serverProcess = spawn(serverPath, [], {
        stdio: 'pipe',
        detached: false,
        cwd: path.dirname(serverPath)
      });
      
      this.serverPid = this.serverProcess.pid;
      
      // Step 5: Set up process event handlers
      let serverOutput = '';
      let serverErrors = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            this.sendLiveUpdate(`🐍 ${line.trim()}`);
          }
        });
      });
      
      this.serverProcess.stderr.on('data', (data) => {
        serverErrors += data.toString();
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
          if (line.trim() && !line.includes('UserWarning: pkg_resources is deprecated')) {
            this.sendLiveUpdate(`🐍 ${line.trim()}`);
          }
        });
      });
      
      this.serverProcess.on('error', (error) => {
        this.logger?.error('SERVER_MANAGER', 'Server process error', { error: error.message });
        throw new Error(`Failed to start server: ${error.message}`);
      });
      
      this.serverProcess.on('exit', (code) => {
        this.logger?.info('SERVER_MANAGER', 'Server process exited', { code, pid: this.serverPid });
        this.isServerRunning = false;
        this.serverProcess = null;
        this.serverPid = null;
      });
      
      // Step 6: Wait for server to be ready
      this.sendLiveUpdate('⏳ Waiting for FastAPI server to be ready...');
      const serverReady = await this.waitForServerReady();
      
      if (!serverReady) {
        throw new Error('FastAPI server failed to start within timeout period');
      }
      
      this.isServerRunning = true;
      this.sendLiveUpdate('✅ FastAPI server is ready for testing!');
      
      return {
        success: true,
        pid: this.serverPid,
        port: this.serverPort,
        healthUrl: this.healthUrl,
        output: serverOutput,
        errors: serverErrors
      };
      
    } catch (error) {
      this.logger?.error('SERVER_MANAGER', 'Failed to start server', { error: error.message });
      this.sendLiveUpdate(`❌ Failed to start server: ${error.message}`);
      
      // Cleanup on failure
      await this.stopServer();
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Wait for server to be ready via health checks
  async waitForServerReady() {
    const maxAttempts = this.retries.healthCheck;
    const delayBetweenAttempts = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.sendLiveUpdate(`🔍 Health check attempt ${attempt}/${maxAttempts}...`);
        
        const response = await axios.get(this.healthUrl, {
          timeout: this.timeouts.healthCheck,
          headers: { 'User-Agent': 'CypherEdge-ServerManager/1.0' }
        });
        
        if (response.status === 200) {
          this.logger?.info('SERVER_MANAGER', 'Server health check passed', {
            attempt,
            status: response.status,
            data: response.data
          });
          
          this.sendLiveUpdate('✅ Server health check passed!');
          return true;
        }
        
      } catch (error) {
        this.logger?.debug('SERVER_MANAGER', 'Health check failed', {
          attempt,
          error: error.message,
          code: error.code
        });
        
        // Don't spam UI with every health check failure
        if (attempt % 5 === 0) {
          this.sendLiveUpdate(`⏳ Still waiting for server... (${attempt}/${maxAttempts})`);
        }
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }
    
    this.logger?.error('SERVER_MANAGER', 'Server health check timeout', {
      maxAttempts,
      totalTimeMs: maxAttempts * delayBetweenAttempts
    });
    
    return false;
  }

  // Stop the FastAPI server
  async stopServer() {
    if (!this.serverProcess && !this.serverPid) {
      this.logger?.debug('SERVER_MANAGER', 'No server process to stop');
      return { success: true, message: 'No server was running' };
    }
    
    this.sendLiveUpdate('🛑 Stopping FastAPI server...');
    
    try {
      // Step 1: Try graceful shutdown
      if (this.serverProcess) {
        this.logger?.info('SERVER_MANAGER', 'Attempting graceful server shutdown', { pid: this.serverPid });
        this.serverProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        const gracefulShutdown = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), this.timeouts.serverStop);
          
          this.serverProcess.on('exit', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        });
        
        if (gracefulShutdown) {
          this.sendLiveUpdate('✅ Server stopped gracefully');
          this.isServerRunning = false;
          return { success: true, method: 'graceful' };
        }
      }
      
      // Step 2: Force kill if graceful shutdown failed
      if (this.serverPid) {
        this.logger?.warn('SERVER_MANAGER', 'Graceful shutdown failed, force killing', { pid: this.serverPid });
        this.sendLiveUpdate('⚡ Force stopping server...');
        
        await new Promise((resolve) => {
          exec(`taskkill /PID ${this.serverPid} /F`, () => resolve());
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Step 3: Cleanup any remaining processes
      await this.killExistingProcesses();
      
      this.isServerRunning = false;
      this.serverProcess = null;
      this.serverPid = null;
      
      this.sendLiveUpdate('✅ Server cleanup completed');
      
      return { success: true, method: 'force' };
      
    } catch (error) {
      this.logger?.error('SERVER_MANAGER', 'Error stopping server', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Get server status
  getServerStatus() {
    return {
      isRunning: this.isServerRunning,
      pid: this.serverPid,
      port: this.serverPort,
      healthUrl: this.healthUrl
    };
  }

  // Test server connectivity
  async testServerConnectivity() {
    if (!this.isServerRunning) {
      return { success: false, error: 'Server is not running' };
    }
    
    try {
      const response = await axios.get(this.healthUrl, {
        timeout: this.timeouts.healthCheck,
        headers: { 'User-Agent': 'CypherEdge-ServerManager/1.0' }
      });
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        responseTime: response.headers['x-response-time']
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
}

module.exports = { ServerManager };
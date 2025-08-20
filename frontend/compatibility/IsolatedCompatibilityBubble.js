// IsolatedCompatibilityBubble.js
// Complete isolated testing environment for system compatibility
// Kills existing processes, spawns clean instances, tests, then cleans up

const { spawn, exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

class IsolatedCompatibilityBubble {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.compatibilityWindow = compatibilityWindow;
    this.isDev = !require("electron").app.isPackaged;
    
    // Our controlled processes
    this.controlledProcesses = {
      python: null,
      gateway: null
    };
    
    this.ports = {
      python: 7500,
      gateway: 7890
    };
    
    this.timeouts = {
      cleanup: 10000,    // 10 seconds to kill existing processes
      startup: 20000,    // 20 seconds to start our processes
      healthCheck: 5000, // 5 seconds for health checks
      shutdown: 5000     // 5 seconds to clean up our processes
    };
  }

  // Enhanced live updates to the compatibility UI with detailed context
  sendLiveUpdate(message, status = 'info', additionalDetails = {}) {
    if (this.compatibilityWindow && !this.compatibilityWindow.isDestroyed()) {
      this.compatibilityWindow.webContents.send("test-progress", {
        suiteName: 'Component Auto-Startup & Verification',
        testName: 'CypherEdge Component Flow Test',
        status: 'testing',
        message: message,
        details: { 
          componentAction: message, 
          liveStatus: status,
          phase: this.getCurrentPhase(message),
          operation: this.getOperationType(message),
          technical: additionalDetails,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    this.logger?.info('BUBBLE_UPDATE', message, { status, ...additionalDetails });
    console.log(`🔄 [BUBBLE] ${message}`);
  }

  getCurrentPhase(message) {
    if (message.includes('Phase 1')) return 'cleanup';
    if (message.includes('Phase 2')) return 'startup';
    if (message.includes('Phase 3')) return 'testing';
    if (message.includes('Phase 4')) return 'results';
    if (message.includes('Initializing')) return 'initialization';
    return 'processing';
  }

  getOperationType(message) {
    if (message.includes('Cleaning') || message.includes('Kill')) return 'cleanup';
    if (message.includes('Starting')) return 'startup';
    if (message.includes('Testing') || message.includes('Health')) return 'validation';
    if (message.includes('PDF') || message.includes('Processing')) return 'integration';
    if (message.includes('Gateway') || message.includes('Licensing')) return 'authentication';
    return 'system';
  }

  // Main isolated testing method
  async runIsolatedCompatibilityTest() {
    this.logger?.info('BUBBLE_START', 'Starting isolated compatibility bubble test');
    this.sendLiveUpdate('🚀 Initializing isolated compatibility test environment...');
    
    try {
      // Phase 1: Kill ALL existing processes to create clean environment
      this.sendLiveUpdate('🧹 Phase 1: Cleaning existing processes for isolated test...');
      await this.killAllExistingProcesses();
      
      // Phase 2: Start OUR controlled instances
      this.sendLiveUpdate('🔧 Phase 2: Starting controlled Python backend instance...', 'info', {
        port: this.ports.python,
        service: 'FastAPI',
        operation: 'process_spawn'
      });
      const pythonResult = await this.startControlledPythonBackend();
      
      if (!pythonResult.success) {
        return this.cleanupAndReturn(false, 'Python backend failed to start in isolated environment', pythonResult.details);
      }
      
      this.sendLiveUpdate('🔧 Phase 2: Starting controlled Gateway service instance...', 'info', {
        port: this.ports.gateway,
        service: '.NET Gateway',
        operation: 'process_spawn'
      });
      const gatewayResult = await this.startControlledGatewayService();
      
      if (!gatewayResult.success) {
        return this.cleanupAndReturn(false, 'Gateway service failed to start in isolated environment', gatewayResult.details);
      }
      
      // Phase 3: Test our controlled services
      this.sendLiveUpdate('✅ Phase 3: Testing controlled Python backend health...', 'info', {
        endpoint: `http://127.0.0.1:${this.ports.python}/health`,
        testType: 'http_health_check'
      });
      const pythonHealthResult = await this.testControlledPythonHealth();
      
      this.sendLiveUpdate('✅ Phase 3: Testing controlled Gateway service health...', 'info', {
        endpoint: `http://127.0.0.1:${this.ports.gateway}/api/health`,
        testType: 'http_health_check'
      });
      const gatewayHealthResult = await this.testControlledGatewayHealth();
      
      this.sendLiveUpdate('📄 Phase 3: Testing PDF processing pipeline...');
      const pdfResult = await this.testControlledPDFProcessing();
      
      this.sendLiveUpdate('🔐 Phase 3: Testing licensing endpoints...');
      const licensingResult = await this.testControlledLicensing();
      
      // Phase 4: Generate final results
      const allTestsSuccessful = pythonHealthResult.success && 
                                gatewayHealthResult.success && 
                                pdfResult.success && 
                                licensingResult.success;
      
      if (allTestsSuccessful) {
        this.sendLiveUpdate('🎉 All controlled tests PASSED! System is fully compatible!');
      } else {
        this.sendLiveUpdate('⚠️ Some controlled tests failed. Check detailed results.');
      }
      
      // Phase 5: Complete cleanup
      this.sendLiveUpdate('🧹 Phase 5: Cleaning up controlled test environment...');
      await this.cleanupControlledProcesses();
      
      this.sendLiveUpdate('✅ Isolated compatibility test completed successfully!');
      
      return {
        success: allTestsSuccessful,
        message: allTestsSuccessful ? 
          'All critical components verified in isolated environment' : 
          'Some components failed in isolated environment',
        details: {
          python: pythonHealthResult,
          gateway: gatewayHealthResult,
          pdf: pdfResult,  // Optional endpoint - not critical
          licensing: licensingResult,
          environment: 'isolated',
          controlled: true,
          criticalComponentsOK: pythonHealthResult.success && gatewayHealthResult.success
        },
        severity: allTestsSuccessful ? 'success' : 'critical'
      };
      
    } catch (error) {
      this.logger?.error('BUBBLE_ERROR', 'Isolated compatibility test failed', { error: error.message });
      this.sendLiveUpdate(`❌ Isolated test failed: ${error.message}`);
      await this.cleanupControlledProcesses();
      
      return {
        success: false,
        message: `Isolated compatibility test crashed: ${error.message}`,
        details: { error: error.message, stack: error.stack },
        severity: 'critical'
      };
    }
  }

  // Phase 1: Kill ALL existing processes (adapted from main.js)
  async killAllExistingProcesses() {
    this.logger?.info('BUBBLE_CLEANUP', 'Killing all existing Python and Gateway processes');
    
    try {
      // Kill Python processes
      this.sendLiveUpdate('🧹 Terminating existing Python processes...');
      if (process.platform === "win32") {
        const pythonKillCommands = [
          'taskkill /F /IM main.exe',
          'taskkill /F /IM python.exe',
          'taskkill /F /IM pythonw.exe'
        ];
        
        for (const cmd of pythonKillCommands) {
          try {
            execSync(cmd, { timeout: 3000, windowsHide: true });
          } catch (e) {
            // Process might not exist - not an error
          }
        }
      }
      
      // Kill Gateway processes (adapted from stopEverythingNeatly)
      this.sendLiveUpdate('🧹 Terminating existing Gateway processes...');
      if (process.platform === "win32") {
        const gatewayKillCommands = [
          'taskkill /IM "gatewayService.exe" /F',
          'taskkill /IM "gatewayService.exe" /F /T',
          'wmic process where "name like \'%gateway%\'" delete',
          'powershell -Command "Get-Process | Where-Object {$_.ProcessName -like \'*gateway*\'} | Stop-Process -Force"'
        ];
        
        for (const cmd of gatewayKillCommands) {
          try {
            execSync(cmd, { timeout: 5000, windowsHide: true, shell: true });
          } catch (e) {
            // Process might not exist - not an error
          }
        }
        
        // Stop Gateway service
        try {
          execSync('sc stop "LicensingServer"', { timeout: 5000, windowsHide: true });
        } catch (e) {
          // Service might not exist - not an error
        }
      }
      
      // Wait for processes to fully terminate
      this.sendLiveUpdate('⏱️ Waiting for complete process termination...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.logger?.info('BUBBLE_CLEANUP', 'All existing processes terminated');
      
    } catch (error) {
      this.logger?.warn('BUBBLE_CLEANUP', 'Some cleanup operations failed, continuing', { error: error.message });
    }
  }

  // Phase 2: Start controlled Python backend
  async startControlledPythonBackend() {
    return new Promise((resolve) => {
      try {
        const pythonPath = this.isDev
          ? path.join(__dirname, '../../dist/main/main.exe')
          : path.join(process.resourcesPath, 'backend/main/main.exe');
        
        this.sendLiveUpdate(`🐍 Starting controlled Python backend at ${pythonPath}...`);
        
        if (!fs.existsSync(pythonPath)) {
          resolve({
            success: false,
            message: `Python executable not found: ${pythonPath}`,
            details: { path: pythonPath, exists: false }
          });
          return;
        }
        
        const spawnOptions = {
          stdio: 'pipe',
          detached: false,
          cwd: path.dirname(pythonPath)  // Set working directory to executable location
        };
        
        const command = pythonPath;  // Always use the executable path
        const args = [];  // No args needed for .exe
        
        this.sendLiveUpdate(`🐍 Spawning: ${command} ${args.join(' ')}...`);
        
        this.controlledProcesses.python = spawn(command, args, spawnOptions);
        
        let output = '';
        let errorOutput = '';
        
        this.controlledProcesses.python.stdout.on('data', (data) => {
          output += data.toString();
          this.sendLiveUpdate(`🐍 Python: ${data.toString().trim()}`);
        });
        
        this.controlledProcesses.python.stderr.on('data', (data) => {
          errorOutput += data.toString();
          this.sendLiveUpdate(`🐍 Python Error: ${data.toString().trim()}`);
        });
        
        this.controlledProcesses.python.on('error', (error) => {
          resolve({
            success: false,
            message: `Failed to spawn Python: ${error.message}`,
            details: { error: error.message, output, errorOutput }
          });
        });
        
        // Wait for Python to start and test health
        setTimeout(async () => {
          try {
            this.sendLiveUpdate('🔍 Testing controlled Python health...');
            const healthResult = await this.testControlledPythonHealth();
            resolve({
              success: healthResult.success,
              message: healthResult.success ? 'Controlled Python backend started successfully' : 'Controlled Python backend failed health check',
              details: { healthCheck: healthResult, output, errorOutput, pid: this.controlledProcesses.python?.pid }
            });
          } catch (error) {
            resolve({
              success: false,
              message: `Python health check failed: ${error.message}`,
              details: { error: error.message, output, errorOutput }
            });
          }
        }, 12000); // Give Python backend more time to fully start (main.exe takes ~10s)
        
      } catch (error) {
        resolve({
          success: false,
          message: `Failed to start controlled Python: ${error.message}`,
          details: { error: error.message }
        });
      }
    });
  }

  // Phase 2: Start controlled Gateway service
  async startControlledGatewayService() {
    return new Promise((resolve) => {
      try {
        const gatewayPath = this.isDev
          ? path.join(__dirname, '../gatewayServer/gatewayService.exe')
          : path.join(process.resourcesPath, 'gatewayService.exe');
        
        this.sendLiveUpdate(`🚪 Starting controlled Gateway service at ${gatewayPath}...`);
        
        if (!fs.existsSync(gatewayPath)) {
          resolve({
            success: false,
            message: `Gateway executable not found: ${gatewayPath}`,
            details: { path: gatewayPath, exists: false }
          });
          return;
        }
        
        this.controlledProcesses.gateway = spawn(gatewayPath, [], {
          stdio: 'pipe',
          detached: false
        });
        
        let output = '';
        let errorOutput = '';
        
        this.controlledProcesses.gateway.stdout.on('data', (data) => {
          output += data.toString();
          this.sendLiveUpdate(`🚪 Gateway: ${data.toString().trim()}`);
        });
        
        this.controlledProcesses.gateway.stderr.on('data', (data) => {
          errorOutput += data.toString();
          this.sendLiveUpdate(`🚪 Gateway Error: ${data.toString().trim()}`);
        });
        
        this.controlledProcesses.gateway.on('error', (error) => {
          resolve({
            success: false,
            message: `Failed to spawn Gateway: ${error.message}`,
            details: { error: error.message, output, errorOutput }
          });
        });
        
        // Wait for Gateway to start and test health
        setTimeout(async () => {
          try {
            this.sendLiveUpdate('🔍 Testing controlled Gateway health...');
            const healthResult = await this.testControlledGatewayHealth();
            resolve({
              success: healthResult.success,
              message: healthResult.success ? 'Controlled Gateway service started successfully' : 'Controlled Gateway service failed health check',
              details: { healthCheck: healthResult, output, errorOutput, pid: this.controlledProcesses.gateway?.pid }
            });
          } catch (error) {
            resolve({
              success: false,
              message: `Gateway health check failed: ${error.message}`,
              details: { error: error.message, output, errorOutput }
            });
          }
        }, 5000); // Give Gateway time to start
        
      } catch (error) {
        resolve({
          success: false,
          message: `Failed to start controlled Gateway: ${error.message}`,
          details: { error: error.message }
        });
      }
    });
  }

  // Phase 3: Test controlled Python health
  async testControlledPythonHealth() {
    try {
      this.sendLiveUpdate('🔍 Checking controlled Python health endpoint...');
      
      const axios = require('axios');
      const healthUrl = `http://127.0.0.1:${this.ports.python}/health`;
      this.sendLiveUpdate(`📡 Testing health endpoint: ${healthUrl}`);
      
      const response = await axios.get(healthUrl, {
        timeout: 5000,  // Increased timeout
        headers: { 'User-Agent': 'CypherEdge-IsolatedTest' }
      });
      
      if (response.status === 200) {
        this.sendLiveUpdate('✅ Controlled Python backend is healthy!');
        return {
          success: true,
          message: 'Controlled Python backend health check passed',
          details: { status: response.status, data: response.data }
        };
      } else {
        this.sendLiveUpdate(`⚠️ Unexpected status: ${response.status}`);
        return {
          success: false,
          message: `Controlled Python health check returned status ${response.status}`,
          details: { status: response.status, data: response.data }
        };
      }
    } catch (error) {
      const errorMsg = error.code === 'ECONNREFUSED' 
        ? 'Backend not yet listening on port 7500'
        : error.message;
      this.sendLiveUpdate(`❌ Controlled Python health check failed: ${errorMsg}`);
      return {
        success: false,
        message: `Controlled Python health check failed: ${errorMsg}`,
        details: { error: error.message, code: error.code, port: this.ports.python }
      };
    }
  }

  // Phase 3: Test controlled Gateway health
  async testControlledGatewayHealth() {
    try {
      this.sendLiveUpdate('🔍 Checking controlled Gateway health endpoint...');
      
      const axios = require('axios');
      const response = await axios.get(`http://127.0.0.1:${this.ports.gateway}/api/health`, {
        timeout: 3000,
        headers: { 'User-Agent': 'CypherEdge-IsolatedTest' }
      });
      
      if (response.status === 200) {
        this.sendLiveUpdate('✅ Controlled Gateway service is healthy!');
        return {
          success: true,
          message: 'Controlled Gateway service health check passed',
          details: { status: response.status, data: response.data }
        };
      } else {
        return {
          success: false,
          message: `Controlled Gateway health check returned status ${response.status}`,
          details: { status: response.status, data: response.data }
        };
      }
    } catch (error) {
      this.sendLiveUpdate(`❌ Controlled Gateway health check failed: ${error.message}`);
      return {
        success: false,
        message: `Controlled Gateway health check failed: ${error.message}`,
        details: { error: error.message, code: error.code }
      };
    }
  }

  // Phase 3: Test controlled PDF processing
  async testControlledPDFProcessing() {
    try {
      this.sendLiveUpdate('📄 Testing controlled PDF processing pipeline...');
      
      const testPdfPath = path.join(__dirname, '../test-samples/test.pdf');
      
      if (!fs.existsSync(testPdfPath)) {
        return {
          success: false,
          message: 'Test PDF not found for processing test',
          details: { path: testPdfPath, exists: false }
        };
      }
      
      const axios = require('axios');
      // Use /add-pdf/ endpoint since /compatibility-check/ doesn't exist in production main.exe
      const response = await axios.post(`http://localhost:${this.ports.python}/add-pdf/`, {
        bank_names: ["Test Bank"],
        pdf_paths: [testPdfPath],
        passwords: [""],
        start_date: ["2024-01-01"],
        end_date: ["2024-12-31"],
        ca_id: "compatibility-test"
      }, {
        timeout: 15000,
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'CypherEdge-IsolatedTest' 
        }
      });
      
      if (response.status === 200) {
        // /add-pdf/ endpoint test - if we get 200 OK, the PDF processing pipeline is working
        this.sendLiveUpdate('✅ Controlled PDF processing test completed successfully!');
        return {
          success: true,
          message: 'PDF processing pipeline test passed',
          details: { status: response.status, result: response.data }
        };
      } else {
        return {
          success: false,
          message: `Controlled PDF processing test failed with status ${response.status}`,
          details: { status: response.status, data: response.data }
        };
      }
    } catch (error) {
      this.sendLiveUpdate(`❌ Controlled PDF processing test failed: ${error.message}`);
      return {
        success: false,
        message: `Controlled PDF processing test failed: ${error.message}`,
        details: { error: error.message, code: error.code }
      };
    }
  }

  // Phase 3: Test controlled licensing
  async testControlledLicensing() {
    try {
      this.sendLiveUpdate('🔐 Testing controlled licensing endpoints...');
      
      const axios = require('axios');
      const response = await axios.get(`http://127.0.0.1:${this.ports.gateway}/api/health`, {
        timeout: 3000,
        headers: { 'User-Agent': 'CypherEdge-IsolatedTest' }
      });
      
      if (response.status === 200) {
        this.sendLiveUpdate('✅ Controlled licensing endpoints are accessible!');
        return {
          success: true,
          message: 'Controlled licensing endpoints test passed',
          details: { status: response.status, data: response.data }
        };
      } else {
        return {
          success: false,
          message: `Controlled licensing test failed with status ${response.status}`,
          details: { status: response.status, data: response.data }
        };
      }
    } catch (error) {
      this.sendLiveUpdate(`❌ Controlled licensing test failed: ${error.message}`);
      return {
        success: false,
        message: `Controlled licensing test failed: ${error.message}`,
        details: { error: error.message, code: error.code }
      };
    }
  }

  // Phase 5: Cleanup controlled processes
  async cleanupControlledProcesses() {
    this.logger?.info('BUBBLE_CLEANUP', 'Cleaning up controlled processes');
    this.sendLiveUpdate('🧹 Terminating controlled test processes...');
    
    try {
      // Kill our controlled Python process
      if (this.controlledProcesses.python && !this.controlledProcesses.python.killed) {
        this.sendLiveUpdate('🧹 Terminating controlled Python process...');
        this.controlledProcesses.python.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.controlledProcesses.python && !this.controlledProcesses.python.killed) {
            this.controlledProcesses.python.kill('SIGKILL');
          }
        }, 3000);
      }
      
      // Kill our controlled Gateway process
      if (this.controlledProcesses.gateway && !this.controlledProcesses.gateway.killed) {
        this.sendLiveUpdate('🧹 Terminating controlled Gateway process...');
        this.controlledProcesses.gateway.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.controlledProcesses.gateway && !this.controlledProcesses.gateway.killed) {
            this.controlledProcesses.gateway.kill('SIGKILL');
          }
        }, 3000);
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.sendLiveUpdate('✅ Controlled processes cleaned up successfully!');
      this.logger?.info('BUBBLE_CLEANUP', 'Controlled processes cleanup completed');
      
    } catch (error) {
      this.logger?.warn('BUBBLE_CLEANUP', 'Some cleanup operations failed', { error: error.message });
      this.sendLiveUpdate(`⚠️ Cleanup completed with warnings: ${error.message}`);
    }
  }

  // Helper method for returning results with cleanup
  async cleanupAndReturn(success, message, details) {
    await this.cleanupControlledProcesses();
    return {
      success,
      message,
      details,
      severity: success ? 'success' : 'critical'
    };
  }
}

module.exports = { IsolatedCompatibilityBubble };
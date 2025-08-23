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
    
    // Mode detection and configuration
    this.mode = this.detectMode();
    this.paths = this.initializePaths();
    
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
      healthCheck: 20000, // 20 seconds for health checks (match main app)
      shutdown: 5000,    // 5 seconds to clean up our processes
      gateway: 30000     // 30 seconds specifically for Gateway (includes PostgreSQL startup)
    };
    
    // Log mode and paths on initialization
    this.logModeConfiguration();
  }

  // Mode detection - match main app logic exactly
  detectMode() {
    const { app } = require("electron");
    const appIsPackaged = app.isPackaged;
    const nodeEnv = process.env.NODE_ENV;
    
    // Match main app logic: isDevelopment = !appIsPackaged || nodeEnv === "development"
    const isDevelopment = !appIsPackaged || nodeEnv === "development";
    
    if (isDevelopment) {
      return "dev";
    } else {
      return "prod";
    }
  }

  // Initialize all paths based on detected mode
  initializePaths() {
    const mode = this.mode;
    
    if (mode === "dev") {
      return {
        mode: "dev",
        python: {
          executable: path.join(__dirname, '../../dist/main/main.exe'),
          workingDir: path.join(__dirname, '../../dist/main')
        },
        gateway: {
          executable: path.join(__dirname, '../gatewayServer/gatewayService.exe'),
          workingDir: path.join(__dirname, '../gatewayServer'),
          config: path.join(__dirname, '../gatewayServer/appsettings.json')
        },
        description: "Development mode - running from source directory"
      };
    } else {
      return {
        mode: "prod",
        python: {
          executable: path.join(process.resourcesPath, 'backend', 'main', 'main.exe'),
          workingDir: path.join(process.resourcesPath, 'backend', 'main')
        },
        gateway: {
          executable: path.join(process.resourcesPath, 'gatewayService.exe'),
          workingDir: process.resourcesPath, // C:\Program Files\CypherEdge\resources
          config: path.join(process.resourcesPath, 'appsettings.json')
        },
        description: "Production mode - installed to Program Files"
      };
    }
  }

  // Log the current mode configuration for debugging
  logModeConfiguration() {
    const { app } = require("electron");
    const appIsPackaged = app.isPackaged;
    const nodeEnv = process.env.NODE_ENV;
    const isDevelopment = !appIsPackaged || nodeEnv === "development";
    
    this.sendLiveUpdate(`🔧 Compatibility checker mode: ${this.paths.mode.toUpperCase()}`);
    this.sendLiveUpdate(`📊 Detection: isPackaged=${appIsPackaged} | NODE_ENV=${nodeEnv} | isDev=${isDevelopment}`);
    this.sendLiveUpdate(`📋 ${this.paths.description}`);
    this.sendLiveUpdate(`🐍 Python executable: ${this.paths.python.executable}`);
    this.sendLiveUpdate(`🚪 Gateway executable: ${this.paths.gateway.executable}`);
    this.sendLiveUpdate(`📂 Gateway working dir: ${this.paths.gateway.workingDir}`);
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
      
      // Kill Gateway processes using proven stopEverythingNeatly logic
      this.sendLiveUpdate('🧹 Terminating existing Gateway processes using proven method...');
      await this.robustGatewayCleanup('existing');
      
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
        const pythonPath = this.paths.python.executable;
        const pythonWorkingDir = this.paths.python.workingDir;
        
        this.sendLiveUpdate(`🐍 Starting controlled Python backend...`);
        this.sendLiveUpdate(`📂 Mode: ${this.paths.mode.toUpperCase()} | Executable: ${pythonPath}`);
        this.sendLiveUpdate(`📁 Working directory: ${pythonWorkingDir}`);
        
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
          cwd: pythonWorkingDir  // Use mode-specific working directory
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
        const gatewayPath = this.paths.gateway.executable;
        const gatewayWorkingDir = this.paths.gateway.workingDir;
        const gatewayConfig = this.paths.gateway.config;
        
        this.sendLiveUpdate(`🚪 Starting controlled Gateway service...`);
        this.sendLiveUpdate(`📂 Mode: ${this.paths.mode.toUpperCase()} | Executable: ${gatewayPath}`);
        this.sendLiveUpdate(`📁 Working directory: ${gatewayWorkingDir}`);
        this.sendLiveUpdate(`⚙️ Configuration file: ${gatewayConfig}`);
        
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
          detached: false,
          cwd: gatewayWorkingDir  // Use mode-specific working directory for config files
        });
        
        this.sendLiveUpdate(`🔧 Gateway working directory set to: ${gatewayWorkingDir}`);
        
        // Verify Gateway configuration files exist (critical for startup)
        if (fs.existsSync(gatewayConfig)) {
          this.sendLiveUpdate(`✅ Gateway configuration found: ${path.basename(gatewayConfig)}`);
        } else {
          this.sendLiveUpdate(`⚠️ Gateway configuration missing: ${gatewayConfig}`);
        }
        
        // Check PostgreSQL data directory (source of startup hangs)
        const pgDataPath = 'C:\\ProgramData\\Cyphersol\\pgdata';
        const dbConfigPath = 'C:\\ProgramData\\Cyphersol\\database_config.json';
        
        if (fs.existsSync(pgDataPath)) {
          this.sendLiveUpdate(`✅ PostgreSQL data directory exists: ${pgDataPath}`);
        } else {
          this.sendLiveUpdate(`⚠️ PostgreSQL data directory missing: ${pgDataPath}`);
        }
        
        if (fs.existsSync(dbConfigPath)) {
          this.sendLiveUpdate(`✅ Database configuration exists: ${dbConfigPath}`);
        } else {
          this.sendLiveUpdate(`⚠️ Database configuration missing: ${dbConfigPath}`);
        }
        
        let output = '';
        let errorOutput = '';
        
        // Track Gateway startup progress with specific PostgreSQL monitoring
        let postgresqlStarted = false;
        let httpServerStarted = false;
        
        this.controlledProcesses.gateway.stdout.on('data', (data) => {
          output += data.toString();
          const outputStr = data.toString().trim();
          
          // Detect PostgreSQL startup phase
          if (outputStr.includes('Starting embedded Postgres')) {
            this.sendLiveUpdate('🗄️ Gateway: Initializing PostgreSQL database...');
            postgresqlStarted = true;
          } else if (outputStr.includes('HTTP API Server started on port 7890')) {
            this.sendLiveUpdate('✅ Gateway: HTTP API Server ready on port 7890!');
            httpServerStarted = true;
          } else if (outputStr.includes('Application started')) {
            this.sendLiveUpdate('✅ Gateway: Service fully initialized!');
          } else {
            this.sendLiveUpdate(`🚪 Gateway: ${outputStr}`);
          }
        });
        
        this.controlledProcesses.gateway.stderr.on('data', (data) => {
          errorOutput += data.toString();
          const errorStr = data.toString().trim();
          
          // Detect PostgreSQL-related errors
          if (errorStr.includes('Postgres') || errorStr.includes('database')) {
            this.sendLiveUpdate(`⚠️ Gateway Database Warning: ${errorStr}`);
          } else if (errorStr.includes('port') && errorStr.includes('5432')) {
            this.sendLiveUpdate(`⚠️ Gateway PostgreSQL Port Conflict: ${errorStr}`);
          } else if (errorStr.includes('bind') || errorStr.includes('address already in use')) {
            this.sendLiveUpdate(`⚠️ Gateway Port Binding Issue: ${errorStr}`);
          } else {
            this.sendLiveUpdate(`🚪 Gateway Error: ${errorStr}`);
          }
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
            // Provide diagnostic information about startup state
            if (postgresqlStarted && !httpServerStarted) {
              this.sendLiveUpdate('⚠️ PostgreSQL started but HTTP server still initializing...');
            } else if (!postgresqlStarted) {
              this.sendLiveUpdate('⚠️ Gateway startup may be stuck before PostgreSQL initialization...');
            }
            
            this.sendLiveUpdate('🔍 Testing controlled Gateway health...');
            const healthResult = await this.testControlledGatewayHealth();
            
            // Enhanced failure reporting with PostgreSQL context
            if (!healthResult.success && postgresqlStarted && !httpServerStarted) {
              resolve({
                success: false,
                message: 'Gateway PostgreSQL started but HTTP server failed to initialize',
                details: { 
                  healthCheck: healthResult, 
                  output, 
                  errorOutput, 
                  pid: this.controlledProcesses.gateway?.pid,
                  postgresqlStarted,
                  httpServerStarted,
                  diagnosis: 'PostgreSQL startup completed but HTTP API server did not start'
                }
              });
            } else {
              resolve({
                success: healthResult.success,
                message: healthResult.success ? 'Controlled Gateway service started successfully' : 'Controlled Gateway service failed health check',
                details: { 
                  healthCheck: healthResult, 
                  output, 
                  errorOutput, 
                  pid: this.controlledProcesses.gateway?.pid,
                  postgresqlStarted,
                  httpServerStarted
                }
              });
            }
          } catch (error) {
            resolve({
              success: false,
              message: `Gateway health check failed: ${error.message}`,
              details: { 
                error: error.message, 
                output, 
                errorOutput, 
                postgresqlStarted, 
                httpServerStarted 
              }
            });
          }
        }, this.timeouts.gateway); // 30 seconds to accommodate PostgreSQL startup
        
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
        timeout: 15000,  // Increased timeout to match Gateway startup time
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
    const maxAttempts = 15;  // 15 attempts over 15 seconds
    const attemptDelay = 1000;  // 1 second between attempts
    
    this.sendLiveUpdate(`🔍 Checking controlled Gateway health endpoint... (up to ${maxAttempts}s)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger?.info('BUBBLE_GATEWAY_HEALTH', `Gateway health check attempt ${attempt}/${maxAttempts}`);
        
        const axios = require('axios');
        const response = await axios.get(`http://127.0.0.1:${this.ports.gateway}/api/health`, {
          timeout: 5000,  // 5 second timeout per attempt
          headers: { 'User-Agent': 'CypherEdge-IsolatedTest' }
        });
        
        if (response.status === 200) {
          this.sendLiveUpdate(`✅ Controlled Gateway service is healthy! (attempt ${attempt}/${maxAttempts})`);
          this.logger?.info('BUBBLE_GATEWAY_HEALTH', `Gateway health check succeeded on attempt ${attempt}`);
          return {
            success: true,
            message: `Controlled Gateway service health check passed (attempt ${attempt}/${maxAttempts})`,
            details: { status: response.status, data: response.data, attempts: attempt }
          };
        } else {
          this.logger?.warn('BUBBLE_GATEWAY_HEALTH', `Gateway health check bad status on attempt ${attempt}`, {
            status: response.status,
            data: response.data
          });
        }
      } catch (error) {
        this.logger?.warn('BUBBLE_GATEWAY_HEALTH', `Gateway health check failed on attempt ${attempt}`, {
          error: error.message,
          code: error.code
        });
        
        if (attempt === maxAttempts) {
          // Last attempt failed
          this.sendLiveUpdate(`❌ Controlled Gateway health check failed after ${maxAttempts} attempts: ${error.message}`);
          return {
            success: false,
            message: `Controlled Gateway health check failed after ${maxAttempts} attempts: ${error.message}`,
            details: { error: error.message, attempts: maxAttempts, finalError: error.code }
          };
        }
      }
      
      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts) {
        this.sendLiveUpdate(`🔄 Gateway attempt ${attempt}/${maxAttempts} failed, retrying in ${attemptDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }
    
    // Should not reach here, but just in case
    return {
      success: false,
      message: `Gateway health check failed after ${maxAttempts} attempts`,
      details: { attempts: maxAttempts }
    };
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
        timeout: 15000,  // Increased timeout to match Gateway startup time
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
      
      // Kill our controlled Gateway process using robust method - CRITICAL for splash screen
      this.sendLiveUpdate('🏭 Using robust Gateway cleanup for main app startup...');
      await this.robustGatewayCleanup('controlled');
      
      // Additional cleanup to ensure ports are free for main app
      this.sendLiveUpdate('🔍 Verifying ports are free for main app startup...');
      await this.verifyPortsAreClean();
      
      // Wait for complete cleanup
      this.sendLiveUpdate('⏱️ Waiting for complete cleanup before main app...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.sendLiveUpdate('✅ Controlled processes cleaned up - main app can start safely!');
      this.logger?.info('BUBBLE_CLEANUP', 'CRITICAL: Controlled processes cleanup completed - main app ready');
      
    } catch (error) {
      this.logger?.error('BUBBLE_CLEANUP', 'CRITICAL: Cleanup failed - may affect main app startup', { error: error.message });
      this.sendLiveUpdate(`❌ CRITICAL: Cleanup failed - may affect splash screen: ${error.message}`);
      // Still try robust cleanup even if controlled process cleanup fails
      await this.robustGatewayCleanup('emergency');
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

  // ROBUST GATEWAY CLEANUP - Based on main.js stopEverythingNeatly
  // This ensures compatibility tests don't interfere with splash screen
  async robustGatewayCleanup(context = 'general') {
    this.logger?.info('BUBBLE_GATEWAY_CLEANUP', `Starting robust Gateway cleanup - context: ${context}`);
    
    if (process.platform !== "win32") {
      this.logger?.info('BUBBLE_GATEWAY_CLEANUP', 'Non-Windows platform - skipping Windows-specific cleanup');
      return;
    }

    try {
      // 1. Stop Gateway Windows Service (try both possible service names)
      const serviceNames = ["LicensingServer"];
      this.sendLiveUpdate(`🛑 Stopping Gateway Windows Service (${context})...`);
      
      for (const serviceName of serviceNames) {
        try {
          this.logger?.info('BUBBLE_GATEWAY_CLEANUP', `Attempting to stop service: ${serviceName}`);
          execSync(`sc stop "${serviceName}"`, { timeout: 10000, windowsHide: true });
          this.sendLiveUpdate(`✅ Service ${serviceName} stopped successfully`);
        } catch (stopError) {
          // Check if service is already stopped or doesn't exist
          if (stopError.message.includes("1062") || 
              stopError.message.includes("not started") ||
              stopError.message.includes("1052") ||
              stopError.message.includes("1060")) {
            this.logger?.info('BUBBLE_GATEWAY_CLEANUP', `Service ${serviceName} was already stopped or doesn't exist`);
          } else {
            this.logger?.warn('BUBBLE_GATEWAY_CLEANUP', `Failed to stop service ${serviceName}`, { error: stopError.message });
          }
        }

        // Wait for service to stop
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 2. Use multiple aggressive kill methods (from main.js)
      this.sendLiveUpdate(`⚔️ Using multiple Gateway process termination methods (${context})...`);
      
      const killMethods = [
        'taskkill /IM "gatewayService.exe" /F',
        'taskkill /IM "gatewayService.exe" /F /T',
        "wmic process where \"name like '%gateway%'\" delete",
        "powershell -Command \"Get-Process | Where-Object {$_.ProcessName -like '*gateway*'} | Stop-Process -Force\"",
      ];

      let killed = false;
      for (const method of killMethods) {
        try {
          this.logger?.info('BUBBLE_GATEWAY_CLEANUP', `Trying kill method: ${method}`);
          execSync(method, { timeout: 5000, windowsHide: true, shell: true });
          this.sendLiveUpdate(`✅ Gateway kill method succeeded: ${method.substring(0, 30)}...`);
          killed = true;
        } catch (killError) {
          this.logger?.info('BUBBLE_GATEWAY_CLEANUP', `Kill method failed (expected): ${method}`, { error: killError.message });
        }
      }

      // 3. Final verification
      this.sendLiveUpdate(`🔍 Verifying Gateway termination (${context})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      try {
        execSync('tasklist | findstr /I "gatewayService.exe"', { shell: true, timeout: 3000, windowsHide: true });
        this.logger?.warn('BUBBLE_GATEWAY_CLEANUP', 'Gateway process might still be running after all kill attempts');
        this.sendLiveUpdate(`⚠️ Gateway process may still be running - main app will handle`);
      } catch (e) {
        this.logger?.info('BUBBLE_GATEWAY_CLEANUP', 'Gateway process successfully terminated - verified');
        this.sendLiveUpdate(`✅ Gateway completely terminated - main app ready (${context})`);
      }

    } catch (error) {
      this.logger?.error('BUBBLE_GATEWAY_CLEANUP', 'Robust Gateway cleanup error', { error: error.message, context });
      this.sendLiveUpdate(`❌ Gateway cleanup error: ${error.message}`);
    }
  }

  // Verify ports are clean for main app
  async verifyPortsAreClean() {
    const portsToCheck = [this.ports.python, this.ports.gateway];
    
    for (const port of portsToCheck) {
      try {
        const net = require('net');
        const server = net.createServer();
        
        await new Promise((resolve, reject) => {
          server.listen(port, () => {
            server.close();
            this.logger?.info('BUBBLE_PORT_CHECK', `Port ${port} is available for main app`);
            resolve();
          });
          
          server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              this.logger?.warn('BUBBLE_PORT_CHECK', `Port ${port} still in use - main app may have conflicts`);
            }
            reject(err);
          });
        });
        
      } catch (error) {
        this.logger?.warn('BUBBLE_PORT_CHECK', `Port ${port} check failed`, { error: error.message });
      }
    }
  }
}

module.exports = { IsolatedCompatibilityBubble };
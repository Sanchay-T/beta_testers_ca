// ComponentStartupManager.js
// Auto-startup and verification system for CypherEdge components
// Simulates the exact production startup flow with real component testing

const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class ComponentStartupManager {
  constructor(logger = null, compatibilityWindow = null) {
    this.logger = logger;
    this.compatibilityWindow = compatibilityWindow;  // Reference to SystemCompatibilityChecker window
    this.isDev = !require("electron").app.isPackaged;
    this.processes = {
      python: null,
      gateway: null
    };
    this.ports = {
      python: 7500,
      gateway: 7890
    };
    this.timeouts = {
      startup: 15000,  // 15 seconds for component startup
      healthCheck: 5000,  // 5 seconds for health checks
      cleanup: 3000    // 3 seconds for cleanup
    };
  }

  // Send progress updates to the compatibility checker UI
  sendProgressUpdate(suiteName, testName, status, message = '') {
    if (this.compatibilityWindow && !this.compatibilityWindow.isDestroyed()) {
      this.compatibilityWindow.webContents.send("test-progress", {
        suiteName,
        testName,
        status,
        message,
        details: { componentAction: message }
      });
    }
  }

  // Main method to verify all components (detect existing or start if needed)
  async startAndVerifyAllComponents() {
    this.logger?.info('STARTUP_MANAGER', 'Starting comprehensive component startup and verification');
    
    const results = {
      python: { status: 'not_checked', details: {} },
      gateway: { status: 'not_checked', details: {} },
      endpoints: { status: 'not_tested', details: {} },
      pdfProcessing: { status: 'not_tested', details: {} },
      licensing: { status: 'not_tested', details: {} }
    };

    try {
      // Step 1: Check if Python Backend is already running, start if needed
      this.logger?.info('STARTUP_MANAGER', 'Step 1: Verifying Python backend');
      results.python = await this.verifyOrStartPythonBackend();
      
      if (!results.python.success) {
        return { success: false, results, error: 'Python backend verification failed' };
      }

      // Step 2: Check if Gateway Service is already running  
      this.logger?.info('STARTUP_MANAGER', 'Step 2: Verifying Gateway service');
      results.gateway = await this.verifyOrStartGatewayService();
      
      if (!results.gateway.success) {
        return { success: false, results, error: 'Gateway service startup failed' };
      }

      // Step 3: Verify All Endpoints
      this.logger?.info('STARTUP_MANAGER', 'Step 3: Verifying all endpoints');
      results.endpoints = await this.verifyAllEndpoints();

      // Step 4: Test PDF Processing with actual test.pdf
      this.logger?.info('STARTUP_MANAGER', 'Step 4: Testing PDF processing with Access Bank test.pdf');
      results.pdfProcessing = await this.testPDFProcessing();

      // Step 5: Test Licensing Flow
      this.logger?.info('STARTUP_MANAGER', 'Step 5: Testing licensing and authentication flow');
      results.licensing = await this.testLicensingFlow();

      const allSuccess = results.python.success && 
                        results.gateway.success && 
                        results.endpoints.success &&
                        results.pdfProcessing.success &&
                        results.licensing.success;

      return {
        success: allSuccess,
        results,
        message: allSuccess ? 'All components started and verified successfully' : 'Some components failed verification'
      };

    } catch (error) {
      this.logger?.error('STARTUP_MANAGER', 'Component startup failed', { error: error.message });
      return { 
        success: false, 
        results, 
        error: `Component startup crashed: ${error.message}` 
      };
    } finally {
      // Always cleanup processes after testing
      await this.cleanupProcesses();
    }
  }

  // Verify if Python Backend is running, start if needed
  async verifyOrStartPythonBackend() {
    const timer = this.logger?.startTimer('Python Backend Verification');
    
    try {
      // First, check if Python backend is already running
      this.logger?.debug('PYTHON_VERIFY', 'Checking if Python backend is already running');
      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '🔍 Detecting existing Python backend...');
      
      const healthResult = await this.waitForPythonHealth();
      
      if (healthResult.success) {
        this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '✅ Python backend already running and healthy!');
        timer?.stop();
        return {
          success: true,
          message: 'Python backend is already running and healthy',
          details: {
            port: this.ports.python,
            status: 'already_running',
            healthCheck: healthResult
          },
          severity: 'success'
        };
      }
      
      // If not running, try to start it
      this.logger?.info('PYTHON_VERIFY', 'Python backend not running, attempting to start');
      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '🚀 Starting Python backend service...');
      const startResult = await this.startPythonBackend();
      timer?.stop();
      return startResult;
      
    } catch (error) {
      timer?.stop();
      return {
        success: false,
        message: `Python backend verification failed: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  // Start Python Backend (main.exe in production, main.py in development)
  async startPythonBackend() {
    const timer = this.logger?.startTimer('Python Backend Startup');
    
    try {
      // Determine Python executable path
      const pythonPath = this.isDev
        ? path.join(__dirname, '../../backend/main.py')
        : path.join(process.resourcesPath, 'backend/main/main.exe');

      this.logger?.debug('PYTHON_STARTUP', 'Starting Python backend', {
        pythonPath,
        environment: this.isDev ? 'development' : 'production',
        port: this.ports.python
      });

      // Check if file exists
      if (!fs.existsSync(pythonPath)) {
        timer?.stop();
        return {
          success: false,
          message: `Python executable not found: ${pythonPath}`,
          details: { path: pythonPath, exists: false },
          severity: 'critical'
        };
      }

      // Start the Python process
      const startResult = await this.startPythonProcess(pythonPath);
      if (!startResult.success) {
        timer?.stop();
        return startResult;
      }

      // Wait for Python to be ready and test health endpoint
      const healthResult = await this.waitForPythonHealth();
      timer?.stop();

      return {
        success: healthResult.success,
        message: healthResult.success ? 'Python backend started successfully' : 'Python backend health check failed',
        details: {
          path: pythonPath,
          processId: this.processes.python?.pid,
          port: this.ports.python,
          environment: this.isDev ? 'development' : 'production',
          health: healthResult
        },
        severity: healthResult.success ? 'success' : 'critical'
      };

    } catch (error) {
      timer?.stop();
      this.logger?.error('PYTHON_STARTUP', 'Python startup failed', { error: error.message });
      return {
        success: false,
        message: `Python startup error: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  async startPythonProcess(pythonPath) {
    return new Promise((resolve) => {
      try {
        let command, args;
        
        if (this.isDev) {
          // Development: run python script
          command = 'python';
          args = [pythonPath, '--host', '127.0.0.1', '--port', this.ports.python.toString()];
        } else {
          // Production: run executable
          command = pythonPath;
          args = ['--host', '127.0.0.1', '--port', this.ports.python.toString()];
        }

        this.logger?.debug('PYTHON_PROCESS', 'Starting Python process', { command, args });

        this.processes.python = spawn(command, args, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        this.processes.python.stdout?.on('data', (data) => {
          output += data.toString();
          // Look for FastAPI startup indicators
          if (output.includes('Uvicorn running on') || output.includes('Started server process')) {
            resolve({ success: true, output, pid: this.processes.python.pid });
          }
        });

        this.processes.python.stderr?.on('data', (data) => {
          errorOutput += data.toString();
          this.logger?.debug('PYTHON_STDERR', data.toString());
        });

        this.processes.python.on('error', (error) => {
          resolve({
            success: false,
            message: `Python process failed to start: ${error.message}`,
            details: { error: error.message, output, errorOutput }
          });
        });

        this.processes.python.on('exit', (code, signal) => {
          if (code !== 0 && code !== null) {
            resolve({
              success: false,
              message: `Python process exited with code ${code}`,
              details: { exitCode: code, signal, output, errorOutput }
            });
          }
        });

        // Timeout for process startup
        setTimeout(() => {
          if (this.processes.python && !this.processes.python.killed) {
            resolve({
              success: true, // Assume success if process is still running
              output,
              pid: this.processes.python.pid,
              note: 'Process started but startup confirmation not detected'
            });
          }
        }, this.timeouts.startup);

      } catch (error) {
        resolve({
          success: false,
          message: `Failed to spawn Python process: ${error.message}`,
          details: { error: error.message }
        });
      }
    });
  }

  async waitForPythonHealth() {
    const maxAttempts = 5;  // Reduced attempts for quicker detection
    const attemptDelay = 500;  // Faster checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger?.debug('PYTHON_HEALTH', `Health check attempt ${attempt}/${maxAttempts}`);
        
        // Use the same fetch setup as CompatibilityTests
        let fetch;
        try {
          fetch = globalThis.fetch;
          if (!fetch) {
            const axios = require("axios");
            fetch = async (url, options) => {
              const response = await axios({
                method: options?.method || 'GET',
                url,
                timeout: this.timeouts.healthCheck
              });
              return {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
                json: async () => response.data
              };
            };
          }
        } catch (error) {
          return { success: false, error: 'No fetch implementation available' };
        }

        const response = await fetch(`http://localhost:${this.ports.python}/health`, {
          method: 'GET',
          timeout: this.timeouts.healthCheck
        });

        if (response.ok) {
          const data = await response.json();
          this.logger?.info('PYTHON_HEALTH', 'Python backend health check passed', { 
            attempt, 
            status: response.status,
            data 
          });
          
          return {
            success: true,
            attempts: attempt,
            data,
            url: `http://localhost:${this.ports.python}/health`
          };
        } else {
          this.logger?.warn('PYTHON_HEALTH', `Health check failed with status ${response.status}`, { attempt });
        }

      } catch (error) {
        this.logger?.debug('PYTHON_HEALTH', `Health check attempt ${attempt} failed`, { 
          error: error.message,
          code: error.code 
        });
      }

      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }

    return {
      success: false,
      attempts: maxAttempts,
      error: 'Python backend health checks failed after all attempts',
      url: `http://localhost:${this.ports.python}/health`
    };
  }

  // Verify if Gateway Service is running, start if needed
  async verifyOrStartGatewayService() {
    const timer = this.logger?.startTimer('Gateway Service Verification');
    
    try {
      // First, check if Gateway service is already running
      this.logger?.debug('GATEWAY_VERIFY', 'Checking if Gateway service is already running');
      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '🔍 Detecting existing Gateway service...');
      
      const healthResult = await this.waitForGatewayHealth();
      
      if (healthResult.success) {
        this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '✅ Gateway service already running and healthy!');
        timer?.stop();
        return {
          success: true,
          message: 'Gateway service is already running and healthy',
          details: {
            port: this.ports.gateway,
            status: 'already_running',
            healthCheck: healthResult
          },
          severity: 'success'
        };
      }
      
      // If not running, try to start it
      this.logger?.info('GATEWAY_VERIFY', 'Gateway service not running, attempting to start');
      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '🚀 Starting Gateway service...');
      const startResult = await this.startGatewayService();
      timer?.stop();
      return startResult;
      
    } catch (error) {
      timer?.stop();
      return {
        success: false,
        message: `Gateway service verification failed: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  // Start Gateway Service (.exe)
  async startGatewayService() {
    const timer = this.logger?.startTimer('Gateway Service Startup');
    
    try {
      const gatewayPath = this.isDev
        ? path.join(__dirname, '../gatewayServer/gatewayService.exe')
        : path.join(process.resourcesPath, 'gatewayService.exe');

      this.logger?.debug('GATEWAY_STARTUP', 'Starting Gateway service', {
        gatewayPath,
        environment: this.isDev ? 'development' : 'production',
        port: this.ports.gateway
      });

      if (!fs.existsSync(gatewayPath)) {
        timer?.stop();
        return {
          success: false,
          message: `Gateway service not found: ${gatewayPath}`,
          details: { path: gatewayPath, exists: false },
          severity: 'critical'
        };
      }

      // Start the Gateway process
      const startResult = await this.startGatewayProcess(gatewayPath);
      if (!startResult.success) {
        timer?.stop();
        return startResult;
      }

      // Test Gateway endpoints
      const healthResult = await this.waitForGatewayHealth();
      timer?.stop();

      return {
        success: healthResult.success,
        message: healthResult.success ? 'Gateway service started successfully' : 'Gateway service health check failed',
        details: {
          path: gatewayPath,
          processId: this.processes.gateway?.pid,
          port: this.ports.gateway,
          environment: this.isDev ? 'development' : 'production',
          health: healthResult
        },
        severity: healthResult.success ? 'success' : 'critical'
      };

    } catch (error) {
      timer?.stop();
      this.logger?.error('GATEWAY_STARTUP', 'Gateway startup failed', { error: error.message });
      return {
        success: false,
        message: `Gateway startup error: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  async startGatewayProcess(gatewayPath) {
    return new Promise((resolve) => {
      try {
        this.logger?.debug('GATEWAY_PROCESS', 'Starting Gateway process', { gatewayPath });

        this.processes.gateway = spawn(gatewayPath, [], {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        this.processes.gateway.stdout?.on('data', (data) => {
          output += data.toString();
          this.logger?.debug('GATEWAY_STDOUT', data.toString());
        });

        this.processes.gateway.stderr?.on('data', (data) => {
          errorOutput += data.toString();
          this.logger?.debug('GATEWAY_STDERR', data.toString());
        });

        this.processes.gateway.on('error', (error) => {
          resolve({
            success: false,
            message: `Gateway process failed to start: ${error.message}`,
            details: { error: error.message, output, errorOutput }
          });
        });

        this.processes.gateway.on('exit', (code, signal) => {
          if (code !== 0 && code !== null) {
            resolve({
              success: false,
              message: `Gateway process exited with code ${code}`,
              details: { exitCode: code, signal, output, errorOutput }
            });
          }
        });

        // Give gateway time to start
        setTimeout(() => {
          if (this.processes.gateway && !this.processes.gateway.killed) {
            resolve({
              success: true,
              output,
              pid: this.processes.gateway.pid
            });
          } else {
            resolve({
              success: false,
              message: 'Gateway process failed to start within timeout',
              details: { output, errorOutput }
            });
          }
        }, this.timeouts.startup);

      } catch (error) {
        resolve({
          success: false,
          message: `Failed to spawn Gateway process: ${error.message}`,
          details: { error: error.message }
        });
      }
    });
  }

  async waitForGatewayHealth() {
    const maxAttempts = 5;  // Reduced attempts for quicker detection
    const attemptDelay = 500;  // Faster checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger?.debug('GATEWAY_HEALTH', `Gateway health check attempt ${attempt}/${maxAttempts}`);
        
        // Test Gateway endpoint (adjust URL based on your actual Gateway endpoints)
        let fetch;
        try {
          fetch = globalThis.fetch;
          if (!fetch) {
            const axios = require("axios");
            fetch = async (url, options) => {
              const response = await axios({
                method: options?.method || 'GET',
                url,
                timeout: this.timeouts.healthCheck
              });
              return {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
                json: async () => response.data
              };
            };
          }
        } catch (error) {
          return { success: false, error: 'No fetch implementation available' };
        }

        // Test basic Gateway endpoint (you may need to adjust this URL)
        const response = await fetch(`http://localhost:${this.ports.gateway}/api/health`, {
          method: 'GET',
          timeout: this.timeouts.healthCheck
        });

        if (response.ok) {
          const data = await response.json();
          this.logger?.info('GATEWAY_HEALTH', 'Gateway service health check passed', { 
            attempt, 
            status: response.status,
            data 
          });
          
          return {
            success: true,
            attempts: attempt,
            data,
            url: `http://localhost:${this.ports.gateway}/api/health`
          };
        }

      } catch (error) {
        this.logger?.debug('GATEWAY_HEALTH', `Gateway health check attempt ${attempt} failed`, { 
          error: error.message,
          code: error.code 
        });
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }

    return {
      success: false,
      attempts: maxAttempts,
      error: 'Gateway service health checks failed after all attempts',
      url: `http://localhost:${this.ports.gateway}/api/health`
    };
  }

  // Clean up all started processes
  async cleanupProcesses() {
    this.logger?.info('CLEANUP', 'Cleaning up started processes');

    const cleanupPromises = [];

    // Cleanup Python process
    if (this.processes.python && !this.processes.python.killed) {
      cleanupPromises.push(this.cleanupProcess('python', this.processes.python));
    }

    // Cleanup Gateway process  
    if (this.processes.gateway && !this.processes.gateway.killed) {
      cleanupPromises.push(this.cleanupProcess('gateway', this.processes.gateway));
    }

    await Promise.all(cleanupPromises);
    this.logger?.info('CLEANUP', 'Process cleanup completed');
  }

  async cleanupProcess(name, process) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!process.killed) {
          this.logger?.warn('CLEANUP', `Force killing ${name} process`, { pid: process.pid });
          process.kill('SIGKILL');
        }
        resolve();
      }, this.timeouts.cleanup);

      process.on('exit', () => {
        clearTimeout(timeout);
        this.logger?.debug('CLEANUP', `${name} process exited gracefully`, { pid: process.pid });
        resolve();
      });

      // Try graceful shutdown first
      this.logger?.debug('CLEANUP', `Terminating ${name} process`, { pid: process.pid });
      process.kill('SIGTERM');
    });
  }

  // Verify all critical endpoints are working
  async verifyAllEndpoints() {
    const timer = this.logger?.startTimer('Endpoint Verification');
    
    try {
      const endpointTests = [
        // Python FastAPI endpoints
        { name: 'FastAPI Health', url: `http://localhost:${this.ports.python}/health`, method: 'GET' },
        { name: 'FastAPI Root', url: `http://localhost:${this.ports.python}/`, method: 'GET' },
        { name: 'FastAPI Compatibility', url: `http://localhost:${this.ports.python}/compatibility-check/`, method: 'POST', 
          body: { pdf_paths: [], passwords: [], quick_check: true } },
        
        // Gateway endpoints (adjust URLs based on your actual endpoints)
        { name: 'Gateway Health', url: `http://localhost:${this.ports.gateway}/api/health`, method: 'GET' },
        { name: 'Gateway License Check', url: `http://localhost:${this.ports.gateway}/api/license/status`, method: 'GET' },
      ];

      const results = [];
      let successCount = 0;

      for (const endpoint of endpointTests) {
        const testResult = await this.testEndpoint(endpoint);
        results.push(testResult);
        if (testResult.success) successCount++;
      }

      timer?.stop();
      const success = successCount === endpointTests.length;

      return {
        success,
        message: success ? `All ${endpointTests.length} endpoints verified` : `${successCount}/${endpointTests.length} endpoints working`,
        details: {
          total: endpointTests.length,
          successful: successCount,
          failed: endpointTests.length - successCount,
          results
        },
        severity: success ? 'success' : 'warning'
      };

    } catch (error) {
      timer?.stop();
      return {
        success: false,
        message: `Endpoint verification error: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  async testEndpoint(endpoint) {
    try {
      this.logger?.debug('ENDPOINT_TEST', `Testing ${endpoint.name}`, { url: endpoint.url, method: endpoint.method });
      
      let fetch;
      try {
        fetch = globalThis.fetch;
        if (!fetch) {
          const axios = require("axios");
          fetch = async (url, options) => {
            const response = await axios({
              method: options?.method || 'GET',
              url,
              data: options?.body,
              headers: options?.headers,
              timeout: this.timeouts.healthCheck
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              statusText: response.statusText,
              json: async () => response.data,
              text: async () => JSON.stringify(response.data)
            };
          };
        }
      } catch (error) {
        return { name: endpoint.name, success: false, error: 'No fetch implementation available' };
      }

      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }

      const startTime = Date.now();
      const response = await fetch(endpoint.url, options);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          data = await response.text();
        }

        this.logger?.debug('ENDPOINT_SUCCESS', `${endpoint.name} test passed`, {
          status: response.status,
          responseTime,
          dataPreview: typeof data === 'string' ? data.substring(0, 100) : data
        });

        return {
          name: endpoint.name,
          success: true,
          url: endpoint.url,
          status: response.status,
          responseTime,
          data: typeof data === 'object' ? data : { response: data }
        };
      } else {
        this.logger?.warn('ENDPOINT_FAILED', `${endpoint.name} test failed`, {
          status: response.status,
          statusText: response.statusText,
          responseTime
        });

        return {
          name: endpoint.name,
          success: false,
          url: endpoint.url,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          error: `HTTP ${response.status} ${response.statusText}`
        };
      }

    } catch (error) {
      this.logger?.error('ENDPOINT_ERROR', `${endpoint.name} test error`, { 
        error: error.message,
        code: error.code 
      });

      return {
        name: endpoint.name,
        success: false,
        url: endpoint.url,
        error: error.message,
        code: error.code
      };
    }
  }

  // Test PDF processing with actual test.pdf
  async testPDFProcessing() {
    const timer = this.logger?.startTimer('PDF Processing Test');
    
    try {
      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '📄 Testing PDF processing with Axis Bank test.pdf...');
      
      // Look for test.pdf in the correct location
      const testPdfPath = path.join(__dirname, '../test-samples/test.pdf');
      
      this.logger?.debug('PDF_PROCESSING', 'Looking for test PDF', { testPdfPath });
      
      if (!fs.existsSync(testPdfPath)) {
        const errorMessage = `Test PDF not found at: ${testPdfPath}`;
        this.logger?.error('PDF_PROCESSING', errorMessage);
        timer?.stop();
        return {
          success: false,
          message: 'Test PDF file not found',
          details: { 
            expectedPath: testPdfPath,
            exists: false,
            error: errorMessage 
          },
          severity: 'warning'  // Not critical, just can't test PDF processing
        };
      }

      this.sendProgressUpdate('Component Auto-Startup & Verification', 'CypherEdge Component Flow Test', 'testing', '✅ Test PDF found, processing...');

      // Test PDF processing through FastAPI compatibility endpoint
      const processingResult = await this.testPDFThroughAPI(testPdfPath);
      timer?.stop();

      return {
        success: processingResult.success,
        message: processingResult.success 
          ? 'PDF processing test completed successfully'
          : 'PDF processing test failed',
        details: {
          testPdfPath,
          pdfExists: true,
          bankType: 'Axis Bank (2022-23)',
          password: 'none',
          ...processingResult
        },
        severity: processingResult.success ? 'success' : 'critical'
      };

    } catch (error) {
      timer?.stop();
      this.logger?.error('PDF_PROCESSING', 'PDF processing test error', { error: error.message });
      return {
        success: false,
        message: `PDF processing test error: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  async testPDFThroughAPI(pdfPath) {
    try {
      this.logger?.debug('PDF_API_TEST', 'Testing PDF processing through FastAPI', { pdfPath });

      let fetch;
      try {
        fetch = globalThis.fetch;
        if (!fetch) {
          const axios = require("axios");
          fetch = async (url, options) => {
            const response = await axios({
              method: options?.method || 'POST',
              url,
              data: options?.body,
              headers: options?.headers,
              timeout: 30000 // 30 seconds for PDF processing
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              json: async () => response.data
            };
          };
        }
      } catch (error) {
        return { success: false, error: 'No fetch implementation available' };
      }

      // Test with the comprehensive compatibility check endpoint
      const testPayload = {
        pdf_paths: [pdfPath],
        passwords: [""], // No password for Access Bank test PDF
        quick_check: false // Enable full PDF processing test
      };

      const response = await fetch(`http://localhost:${this.ports.python}/compatibility-check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        const data = await response.json();
        
        this.logger?.info('PDF_API_TEST', 'PDF processing API test completed', {
          status: data.status,
          pdfProcessingCheck: data.checks?.pdf_processing?.status
        });

        const pdfProcessingSuccess = data.checks?.pdf_processing?.status === 'success';
        
        return {
          success: pdfProcessingSuccess,
          apiResponse: data,
          pdfProcessingDetails: data.checks?.pdf_processing,
          overallStatus: data.status,
          note: pdfProcessingSuccess 
            ? 'PDF processing verified with Access Bank test document'
            : 'PDF processing test failed - check backend logs for details'
        };
      } else {
        return {
          success: false,
          error: `API call failed with status ${response.status}`,
          httpStatus: response.status
        };
      }

    } catch (error) {
      this.logger?.error('PDF_API_TEST', 'PDF API test failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Test licensing flow
  async testLicensingFlow() {
    const timer = this.logger?.startTimer('Licensing Flow Test');
    
    try {
      this.logger?.debug('LICENSE_TEST', 'Testing licensing and authentication flow');

      const licenseTests = [];
      let successCount = 0;

      // Test 1: Gateway license status endpoint
      try {
        const statusResult = await this.testLicenseStatus();
        licenseTests.push({ name: 'License Status Check', ...statusResult });
        if (statusResult.success) successCount++;
      } catch (error) {
        licenseTests.push({ 
          name: 'License Status Check', 
          success: false, 
          error: error.message 
        });
      }

      // Test 2: License validation endpoint
      try {
        const validationResult = await this.testLicenseValidation();
        licenseTests.push({ name: 'License Validation', ...validationResult });
        if (validationResult.success) successCount++;
      } catch (error) {
        licenseTests.push({ 
          name: 'License Validation', 
          success: false, 
          error: error.message 
        });
      }

      // Test 3: Authentication endpoints
      try {
        const authResult = await this.testAuthenticationEndpoints();
        licenseTests.push({ name: 'Authentication Endpoints', ...authResult });
        if (authResult.success) successCount++;
      } catch (error) {
        licenseTests.push({ 
          name: 'Authentication Endpoints', 
          success: false, 
          error: error.message 
        });
      }

      timer?.stop();
      const success = successCount > 0; // At least some licensing functionality working

      return {
        success,
        message: success 
          ? `${successCount}/${licenseTests.length} licensing tests passed`
          : 'All licensing tests failed',
        details: {
          total: licenseTests.length,
          successful: successCount,
          failed: licenseTests.length - successCount,
          tests: licenseTests
        },
        severity: success ? (successCount === licenseTests.length ? 'success' : 'warning') : 'critical'
      };

    } catch (error) {
      timer?.stop();
      this.logger?.error('LICENSE_TEST', 'Licensing flow test error', { error: error.message });
      return {
        success: false,
        message: `Licensing flow test error: ${error.message}`,
        details: { error: error.message },
        severity: 'critical'
      };
    }
  }

  async testLicenseStatus() {
    try {
      let fetch;
      try {
        fetch = globalThis.fetch;
        if (!fetch) {
          const axios = require("axios");
          fetch = async (url, options) => {
            const response = await axios({
              method: options?.method || 'GET',
              url,
              timeout: this.timeouts.healthCheck
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              json: async () => response.data
            };
          };
        }
      } catch (error) {
        return { success: false, error: 'No fetch implementation available' };
      }

      const response = await fetch(`http://localhost:${this.ports.gateway}/api/license/status`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
          note: 'License status endpoint responding'
        };
      } else {
        return {
          success: false,
          error: `License status check failed: HTTP ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      // Licensing might not be critical for compatibility testing
      return {
        success: false,
        error: error.message,
        note: 'License status check failed - may not be critical for basic functionality'
      };
    }
  }

  async testLicenseValidation() {
    try {
      let fetch;
      try {
        fetch = globalThis.fetch;
        if (!fetch) {
          const axios = require("axios");
          fetch = async (url, options) => {
            const response = await axios({
              method: options?.method || 'POST',
              url,
              data: options?.body,
              headers: options?.headers,
              timeout: this.timeouts.healthCheck
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              json: async () => response.data
            };
          };
        }
      } catch (error) {
        return { success: false, error: 'No fetch implementation available' };
      }

      // Test with a basic validation request
      const response = await fetch(`http://localhost:${this.ports.gateway}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
          note: 'License validation endpoint responding'
        };
      } else {
        return {
          success: false,
          error: `License validation failed: HTTP ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        note: 'License validation test failed - may not be critical for basic functionality'
      };
    }
  }

  async testAuthenticationEndpoints() {
    try {
      // Test basic auth endpoint availability
      let fetch;
      try {
        fetch = globalThis.fetch;
        if (!fetch) {
          const axios = require("axios");
          fetch = async (url, options) => {
            const response = await axios({
              method: options?.method || 'GET',
              url,
              timeout: this.timeouts.healthCheck
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              json: async () => response.data
            };
          };
        }
      } catch (error) {
        return { success: false, error: 'No fetch implementation available' };
      }

      const response = await fetch(`http://localhost:${this.ports.gateway}/api/auth/status`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
          note: 'Authentication endpoints responding'
        };
      } else {
        return {
          success: false,
          error: `Authentication endpoint failed: HTTP ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        note: 'Authentication test failed - endpoints may not be available'
      };
    }
  }
}

module.exports = { ComponentStartupManager };
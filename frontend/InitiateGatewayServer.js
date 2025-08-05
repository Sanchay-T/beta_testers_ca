// initializeGatewayServer.js

const { exec, execSync, spawn } = require("child_process");
const path = require("path");
const log = require("electron-log");

class GatewayServerService {
  static instance;

  constructor() {
    if (GatewayServerService.instance) {
      return GatewayServerService.instance;
    }
    this.serviceName = "LicensingServer";
    this.executableName = "gatewayService.exe";
    this.gatewayExecutableDir = null;
    this.gatewayServerExecutablePath = null;
    this.gatewayProcess = null;
    GatewayServerService.instance = this;
  }

  async initialize() {
    const startTime = Date.now();
    const debugLog = (phase, status, data = {}) => {
      const elapsed = Date.now() - startTime;
      log.info(`[GATEWAY DEBUG] ${phase} - ${status} | Elapsed: ${elapsed}ms |`, data);
    };

    debugLog("INIT", "START", { 
      platform: process.platform,
      executableDir: this.gatewayExecutableDir,
      serviceName: this.serviceName 
    });
    log.info("🚀 GATEWAY INITIALIZATION STARTING...");

    try {
      // Step 1: Check if gateway is already responding
      debugLog("HEALTH_CHECK", "ATTEMPTING");
      log.info("📡 Checking if gateway is already responding on port 7890...");
      const isResponding = await this.checkGatewayHealth();
      debugLog("HEALTH_CHECK", isResponding ? "SUCCESS" : "FAILED", { isResponding });
      
      if (isResponding) {
        debugLog("INIT", "COMPLETE", { method: "already_running", totalTime: Date.now() - startTime });
        log.info("✅ Gateway already running and responding - initialization complete");
        return true;
      }

      // Step 2: Try Windows Service approach first
      debugLog("SERVICE_APPROACH", "ATTEMPTING");
      log.info("🔧 Attempting Windows Service approach...");
      const serviceSuccess = await this.tryServiceApproach();
      debugLog("SERVICE_APPROACH", serviceSuccess ? "SUCCESS" : "FAILED", { serviceSuccess });

      if (serviceSuccess) {
        // Wait for service to actually respond
        debugLog("SERVICE_WAIT", "STARTING", { timeout: 15000 });
        log.info("⏳ Waiting for service to respond on port 7890...");
        const serviceReady = await this.waitForGatewayReady(15000);
        debugLog("SERVICE_WAIT", serviceReady ? "SUCCESS" : "TIMEOUT", { serviceReady });
        
        if (serviceReady) {
          debugLog("INIT", "COMPLETE", { method: "windows_service", totalTime: Date.now() - startTime });
          log.info("✅ Windows Service started successfully and responding");
          return true;
        } else {
          log.warn("⚠️ Service started but not responding - trying fallback");
        }
      }

      // Step 3: Fallback - run as regular process
      debugLog("PROCESS_FALLBACK", "ATTEMPTING");
      log.info("🔄 Windows Service failed - attempting process fallback...");
      const processSuccess = await this.runAsProcess();
      debugLog("PROCESS_FALLBACK", processSuccess ? "SUCCESS" : "FAILED", { processSuccess });

      if (processSuccess) {
        debugLog("INIT", "COMPLETE", { method: "process", totalTime: Date.now() - startTime });
        log.info("✅ Gateway started as process and responding");
        return true;
      }

      // Step 4: All methods failed
      debugLog("INIT", "FAILED", { reason: "all_methods_failed", totalTime: Date.now() - startTime });
      throw new Error("All gateway startup methods failed");

    } catch (error) {
      debugLog("INIT", "ERROR", { 
        error: error.message, 
        stack: error.stack,
        totalTime: Date.now() - startTime 
      });
      log.error("❌ GATEWAY INITIALIZATION FAILED:", error.message);
      throw error;
    }
  }

  async tryServiceApproach() {
    const startTime = Date.now();
    const debugLog = (action, status, data = {}) => {
      const elapsed = Date.now() - startTime;
      log.info(`[SERVICE DEBUG] ${action} - ${status} | Elapsed: ${elapsed}ms |`, data);
    };

    debugLog("tryServiceApproach", "START");
    
    try {
      debugLog("checkServiceExists", "CALLING");
      const exists = await this.checkServiceExists();
      debugLog("checkServiceExists", "RESULT", { exists });

      if (!exists) {
        debugLog("createAndStartService", "CALLING");
        log.info("📦 Service doesn't exist - creating...");
        const createResult = await this.createAndStartService();
        debugLog("createAndStartService", createResult ? "SUCCESS" : "FAILED", { createResult });
        return createResult;
      } else {
        debugLog("isServiceRunning", "CALLING");
        const isRunning = await this.isServiceRunning();
        debugLog("isServiceRunning", "RESULT", { isRunning });
        
        if (!isRunning) {
          debugLog("startServiceWithRetry", "CALLING");
          log.info("🔄 Service exists but not running - starting...");
          const startResult = await this.startServiceWithRetry();
          debugLog("startServiceWithRetry", startResult ? "SUCCESS" : "FAILED", { startResult });
          return startResult;
        } else {
          debugLog("tryServiceApproach", "COMPLETE", { reason: "already_running" });
          log.info("✅ Service already running");
          return true;
        }
      }
    } catch (error) {
      debugLog("tryServiceApproach", "ERROR", { error: error.message, stack: error.stack });
      log.error("❌ Service approach failed:", error.message);
      return false;
    }
  }

  async startServiceWithRetry() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      log.info(`🔄 Service start attempt ${attempt}/3...`);

      const success = await this.startService();
      if (success) {
        // Even if sc start succeeds, verify it's actually running
        await new Promise(resolve => setTimeout(resolve, 2000));
        const actuallyRunning = await this.isServiceRunning();
        if (actuallyRunning) {
          log.info("✅ Service started and verified running");
          return true;
        } else {
          log.warn("⚠️ Service start reported success but service not running");
        }
      }

      if (attempt < 3) {
        log.info("⏳ Waiting before retry...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    log.error("❌ Service start failed after 3 attempts");
    return false;
  }

  async runAsProcess() {
    try {
      // Kill any existing gateway processes
      await this.killExistingProcesses();

      log.info(`🚀 Starting gateway as process: ${this.gatewayServerExecutablePath}`);

      // Start the gateway as a detached process
      this.gatewayProcess = spawn(this.gatewayServerExecutablePath, [], {
        detached: true,
        stdio: 'ignore',
        cwd: this.gatewayExecutableDir
      });

      this.gatewayProcess.unref();
      log.info(`📋 Gateway process started with PID: ${this.gatewayProcess.pid}`);

      // Wait for it to be ready
      const ready = await this.waitForGatewayReady(20000);
      if (ready) {
        log.info("✅ Gateway process responding successfully");
        return true;
      } else {
        log.error("❌ Gateway process started but not responding");
        this.killProcess();
        return false;
      }
    } catch (error) {
      log.error("❌ Failed to run gateway as process:", error.message);
      return false;
    }
  }

  async killExistingProcesses() {
    if (process.platform === 'win32') {
      try {
        log.info("🔄 Killing existing gateway processes...");
        execSync('taskkill /F /IM gatewayService.exe', { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        log.info("✅ Existing processes terminated");
      } catch (e) {
        // Process might not exist, ignore
        log.info("📝 No existing processes to kill");
      }
    }
  }

  async checkGatewayHealth() {
    const startTime = Date.now();
    try {
      log.info(`[HEALTH DEBUG] Checking gateway health at http://localhost:7890/api/health`);
      const axios = require('axios');
      const response = await axios.get('http://localhost:7890/api/health', {
        timeout: 3000,
        headers: { 'User-Agent': 'Cyphersol-HealthCheck' }
      });
      const elapsed = Date.now() - startTime;
      log.info(`[HEALTH DEBUG] Health check SUCCESS in ${elapsed}ms | Status: ${response.status}`);
      return response.status === 200;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      log.info(`[HEALTH DEBUG] Health check FAILED in ${elapsed}ms | Error: ${error.code || error.message}`);
      return false;
    }
  }

  async waitForGatewayReady(timeout = 20000) {
    const startTime = Date.now();
    const checkInterval = 1000;
    let attempts = 0;

    log.info(`⏳ Waiting up to ${timeout / 1000}s for gateway to respond...`);

    while (Date.now() - startTime < timeout) {
      attempts++;
      const isReady = await this.checkGatewayHealth();
      if (isReady) {
        log.info(`✅ Gateway responding after ${attempts} attempts`);
        return true;
      }

      if (attempts % 5 === 0) {
        log.info(`⏳ Still waiting... attempt ${attempts}`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    log.error(`❌ Gateway not responding after ${timeout / 1000}s timeout`);
    return false;
  }

  init(gatewayExecutableDir) {
    this.gatewayExecutableDir = gatewayExecutableDir;
    this.gatewayServerExecutablePath = path.join(gatewayExecutableDir, this.executableName);
    log.info("🔧 Gateway Executable Path:", this.gatewayServerExecutablePath);
  }

  isServiceRunning() {
    return new Promise((resolve) => {
      exec(`sc query ${this.serviceName}`, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(stdout.includes("RUNNING"));
        }
      });
    });
  }

  checkServiceExists() {
    return new Promise((resolve) => {
      exec(`sc query ${this.serviceName}`, (error, stdout, stderr) => {
        if (error || stderr || stdout.includes("FAILED") || stdout.includes("does not exist")) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  createAndStartService() {
    return new Promise((resolve) => {
      const createCmd = `sc create ${this.serviceName} binPath= "${this.gatewayServerExecutablePath}" start= auto`;
      
      log.info(`[SERVICE CREATE DEBUG] Executing: ${createCmd}`);
      const cmdStartTime = Date.now();

      exec(createCmd, async (error, stdout, stderr) => {
        const cmdElapsed = Date.now() - cmdStartTime;
        log.info(`[SERVICE CREATE DEBUG] Command completed in ${cmdElapsed}ms`);
        
        if (error || stderr) {
          log.error(`[SERVICE CREATE DEBUG] FAILED | error: ${error?.code} | stderr: ${stderr}`);
          log.error("❌ Failed to create service.");
          if (error) this.logErrorDetails(error);
          if (stderr) log.error("STDERR:", stderr);
          resolve(false);
          return;
        }

        log.info(`[SERVICE CREATE DEBUG] SUCCESS | stdout: ${stdout}`);
        log.info("✅ Service created. Starting service...");
        const startSuccess = await this.startServiceWithRetry();
        resolve(startSuccess);
      });
    });
  }

  startService() {
    return new Promise((resolve) => {
      const startCmd = `sc start ${this.serviceName}`;
      log.info(`[SERVICE START DEBUG] Executing: ${startCmd}`);
      const cmdStartTime = Date.now();
      
      exec(startCmd, (err, stdout, stderr) => {
        const cmdElapsed = Date.now() - cmdStartTime;
        log.info(`[SERVICE START DEBUG] Command completed in ${cmdElapsed}ms`);
        
        if (err) {
          log.info(`[SERVICE START DEBUG] Error code: ${err.code} | Message: ${err.message}`);
          // Handle error 1053 specifically - service might still be starting
          if (err.code === 1053) {
            log.warn("⚠️ Service returned 1053 (timeout) - service may still be starting");
            resolve(true); // Don't treat 1053 as a hard failure
          } else {
            log.error("❌ Service start failed with error:", err.code);
            this.logErrorDetails(err);
            resolve(false);
          }
        } else if (stderr) {
          log.info(`[SERVICE START DEBUG] STDERR: ${stderr}`);
          log.error("❌ Service start stderr:", stderr);
          resolve(false);
        } else {
          log.info(`[SERVICE START DEBUG] SUCCESS | stdout: ${stdout}`);
          log.info("✅ Service start command completed successfully");
          resolve(true);
        }
      });
    });
  }

  logErrorDetails(error) {
    let extendedErrorMessage = "Unknown";
    try {
      extendedErrorMessage = execSync(`net helpmsg ${error.code}`, { encoding: "utf8" }).trim();
    } catch (syncError) {
      extendedErrorMessage = "Could not retrieve extended error message";
    }

    log.error("Error Message:", error.message);
    log.error("Error Code:", error.code);
    log.error("Extended Error Message:", extendedErrorMessage);
    log.error("Error Signal:", error.signal);
    log.error("Executed Command:", error.cmd);
  }

  // Cleanup method for app shutdown
  cleanup() {
    this.killProcess();
  }

  killProcess() {
    if (this.gatewayProcess && !this.gatewayProcess.killed) {
      try {
        process.kill(this.gatewayProcess.pid);
        log.info("🔄 Gateway process terminated");
      } catch (e) {
        log.info("📝 Gateway process already terminated");
      }
    }
  }
}

// Export a single instance of the class
const gatewayServiceInstance = new GatewayServerService();
module.exports = gatewayServiceInstance; 

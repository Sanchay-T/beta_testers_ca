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
    log.info("🚀 GATEWAY INITIALIZATION STARTING...");
    
    try {
      // Step 1: Check if gateway is already responding
      log.info("📡 Checking if gateway is already responding on port 7890...");
      const isResponding = await this.checkGatewayHealth();
      if (isResponding) {
        log.info("✅ Gateway already running and responding - initialization complete");
        return true;
      }

      // Step 2: Try Windows Service approach first
      log.info("🔧 Attempting Windows Service approach...");
      const serviceSuccess = await this.tryServiceApproach();
      
      if (serviceSuccess) {
        // Wait for service to actually respond
        log.info("⏳ Waiting for service to respond on port 7890...");
        const serviceReady = await this.waitForGatewayReady(15000);
        if (serviceReady) {
          log.info("✅ Windows Service started successfully and responding");
          return true;
        } else {
          log.warn("⚠️ Service started but not responding - trying fallback");
        }
      }

      // Step 3: Fallback - run as regular process
      log.info("🔄 Windows Service failed - attempting process fallback...");
      const processSuccess = await this.runAsProcess();
      
      if (processSuccess) {
        log.info("✅ Gateway started as process and responding");
        return true;
      }

      // Step 4: All methods failed
      throw new Error("All gateway startup methods failed");

    } catch (error) {
      log.error("❌ GATEWAY INITIALIZATION FAILED:", error.message);
      throw error;
    }
  }

  async tryServiceApproach() {
    try {
      const exists = await this.checkServiceExists();
      
      if (!exists) {
        log.info("📦 Service doesn't exist - creating...");
        return await this.createAndStartService();
      } else {
        const isRunning = await this.isServiceRunning();
        if (!isRunning) {
          log.info("🔄 Service exists but not running - starting...");
          return await this.startServiceWithRetry();
        } else {
          log.info("✅ Service already running");
          return true;
        }
      }
    } catch (error) {
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
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:7890/api/health', { 
        timeout: 3000,
        headers: { 'User-Agent': 'Cyphersol-HealthCheck' }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async waitForGatewayReady(timeout = 20000) {
    const startTime = Date.now();
    const checkInterval = 1000;
    let attempts = 0;

    log.info(`⏳ Waiting up to ${timeout/1000}s for gateway to respond...`);

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

    log.error(`❌ Gateway not responding after ${timeout/1000}s timeout`);
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

      exec(createCmd, async (error, stdout, stderr) => {
        if (error || stderr) {
          log.error("❌ Failed to create service.");
          if (error) this.logErrorDetails(error);
          if (stderr) log.error("STDERR:", stderr);
          resolve(false);
          return;
        }

        log.info("✅ Service created. Starting service...");
        const startSuccess = await this.startServiceWithRetry();
        resolve(startSuccess);
      });
    });
  }

  startService() {
    return new Promise((resolve) => {
      exec(`sc start ${this.serviceName}`, (err, stdout, stderr) => {
        if (err) {
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
          log.error("❌ Service start stderr:", stderr);
          resolve(false);
        } else {
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
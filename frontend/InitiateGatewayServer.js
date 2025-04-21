// initializeGatewayServer.js

const { exec, execSync } = require("child_process");
const path = require("path");
const log = require("electron-log");

// const GATEWAY_EXECUTABLE = path.join(__dirname, "MyLanService.exe");
// log.info("Gateway Executable Path:", GATEWAY_EXECUTABLE);

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
    GatewayServerService.instance = this;
  }
  async initialize() {
    const exists = await this.checkServiceExists();

    if (!exists) {
      await this.createAndStartService();
    } else {
      const isRunning = await this.isServiceRunning();
      if (!isRunning) {
        await this.startService();
      } else {
        log.info("Service already running.");
      }
    }
  }


  init(gatewayExecutableDir) {
    this.gatewayExecutableDir = gatewayExecutableDir;
    this.gatewayServerExecutablePath = path.join(gatewayExecutableDir, this.executableName);
    log.info("Gateway Executable Path: ", this.gatewayServerExecutablePath);
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
          log.error("Service check error:");
          if (error) {
            this.logErrorDetails(error);
          }
          if (stderr) log.error("STDERR:", stderr);
          resolve(false);
        } else {
          log.info("Service exists.");
          resolve(true);
        }
      });
    });
  }

  createAndStartService() {
    return new Promise((resolve) => {
      const createCmd = `sc create ${this.serviceName} binPath= "${this.gatewayServerExecutablePath}" start= auto`;

      exec(createCmd, (error, stdout, stderr) => {
        if (error || stderr) {
          log.error("Failed to create service.");
          if (error) this.logErrorDetails(error);
          if (stderr) log.error("STDERR:", stderr);
          resolve(false);
          return;
        }

        log.info("Service created. Starting service...");
        this.startService().then(resolve);
      });
    });
  }

  startService() {
    return new Promise((resolve) => {
      exec(`sc start ${this.serviceName}`, (err, stdout, stderr) => {
        if (err || stderr) {
          log.error("Failed to start service.");
          if (err) this.logErrorDetails(err);
          if (stderr) log.error("STDERR:", stderr);
          resolve(false);
        } else {
          log.info("Service started successfully.");
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
    log.error("Full Error Object:", JSON.stringify(error, null, 2));
  }
}

// Export a single instance of the class
const gatewayServiceInstance = new GatewayServerService();
module.exports = gatewayServiceInstance;

// initializeGatewayServer.js

const { exec, execSync } = require("child_process");
const path = require("path");
const log = console; // Replace this with your actual logger if needed

const SERVICE_NAME = "RustLicenseService";
const RUST_EXECUTABLE = path.join(__dirname, "resources", "gateway", "gatewayserver.exe");

class GatewayServerService {
  static instance;

  constructor() {
    if (GatewayServerService.instance) {
      return GatewayServerService.instance;
    }
    GatewayServerService.instance = this;
  }
  async init(executablePath) {
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


  isServiceRunning() {
    return new Promise((resolve) => {
      exec(`sc query ${SERVICE_NAME}`, (error, stdout) => {
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
      exec(`sc query ${SERVICE_NAME}`, (error, stdout, stderr) => {
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
      const createCmd = `sc create ${SERVICE_NAME} binPath= "${RUST_EXECUTABLE}" start= auto`;

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
      exec(`sc start ${SERVICE_NAME}`, (err, stdout, stderr) => {
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

const {
  app,
  BrowserWindow,
  protocol,
  ipcMain,
  shell,
  dialog,
} = require("electron");
const fs = require("fs");

const { registerOpenFileIpc } = require("./ipc/fileHandler.js");
require("dotenv").config();
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  registerIndividualDashboardIpc,
} = require("./ipc/individualDashboard.js");
const { registerMainDashboardIpc } = require("./ipc/mainDashboard.js");
const { registerCaseDashboardIpc } = require("./ipc/caseDashboard.js");
const { registerReportHandlers } = require("./ipc/reportHandlers.js");
const { registerAuthHandlers } = require("./ipc/authHandlers.js");
const { registerEditReportHandlers } = require("./ipc/editReportHandlers.js");
// Import SessionManager singleton instance
const sessionManager = require("./SessionManager");
const licenseManager = require("./LicenseManager");
const { generateReportIpc } = require("./ipc/generateReport");
const { registerOpportunityToEarnIpc } = require("./ipc/opportunityToEarn");
const { registerTallyIpc } = require("./ipc/tallyHandlers.js");
const { registerVoucherIpc } = require("./ipc/VoucherHandlers.js");
const { registerExcelDownloadHandlers } = require("./ipc/excelDownloadHandler");
const { registerAppLevelIPCHandlers } = require("./ipc/appLevelIPC");
const DatabaseMigration = require("./utils/databaseMigration");
// Moved database require to after AppConfig initialization
const { spawn, execFile, exec, execSync } = require("child_process");
const log = require("electron-log");
const portscanner = require("portscanner"); // Import portscanner
const { autoUpdater } = require("electron-updater");
const { getdata } = require("./ipc/getData.js");
const bonjour = require("bonjour")();
const gatewayServer = require("./InitiateGatewayServer.js");
const systemInfo = require("./SystemInformation");
const userDataDir = app.getPath("userData");

// -------------------------------------------------------------
// Initialise global configuration EARLY so all subsequently
// required local modules can rely on it without throwing
// ReferenceError (e.g. "isDev is not defined").
// -------------------------------------------------------------

// Determine if we're in development mode
const appIsPackaged = app.isPackaged;
const nodeEnv = process.env.NODE_ENV;
const isDevelopment = !appIsPackaged || nodeEnv === "development";

console.log("=== AppConfig Initialization ===");
console.log("app.isPackaged:", appIsPackaged);
console.log("process.env.NODE_ENV:", nodeEnv);
console.log("Determined isDev:", isDevelopment);

global.AppConfig = {
  // Flag that indicates whether we are running in development
  // or inside the packaged application.
  // Use app.isPackaged as primary check, fallback to NODE_ENV
  isDev: isDevelopment,

  // Resolve the base directory based on the environment.
  get baseDir() {
    return this.isDev ? __dirname : process.resourcesPath;
  },

  // Expose Electron's user-data directory for convenient reuse.
  userDataDir,
};

// Log the final configuration
console.log("=== Final AppConfig ===");
console.log("isDev:", global.AppConfig.isDev);
console.log("baseDir:", global.AppConfig.baseDir);
console.log("userDataDir:", global.AppConfig.userDataDir);
console.log("========================");

// NOW it's safe to require database after AppConfig is set
const databaseManager = require("./db/db");

// Removed progressWindow - no longer needed for seamless updates

function discoverMdnsServices(serviceType = "", callback) {
  bonjour.find({ type: serviceType }, (service) => {
    const serviceInfo = {
      name: service.name,
      host: service.host,
      ip: service.referer.address,
      port: service.port,
    };

    // console.log('🔍 Found service:', serviceInfo);

    if (callback && typeof callback === "function") {
      callback(serviceInfo);
    }
  });
}

// Configure electron-log
log.transports.console.level = "debug"; // Set the log level
log.transports.file.level = "info"; // Only log info level and above in the log file

// Set up detailed logging for updates
log.transports.file.fileName = "cypheredge.log";
log.info("===========================================");
log.info(`Application starting - Version ${app.getVersion()}`);
log.info(`User data directory: ${userDataDir}`);
log.info(`Platform: ${process.platform}`);
log.info(`Arch: ${process.arch}`);
log.info(`Node version: ${process.versions.node}`);
log.info(`Electron version: ${process.versions.electron}`);
log.info("===========================================");

// Configure autoUpdater logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Configure autoUpdater for seamless background updates
autoUpdater.autoDownload = true; // Enable automatic background downloads
autoUpdater.disableWebInstaller = true;
autoUpdater.allowPrerelease = false;

// Force non-silent installations
autoUpdater.forceDevUpdateConfig = global.AppConfig.isDev;
autoUpdater.autoInstallOnAppQuit = false; // Prevent auto-install on quit
autoUpdater.installOnQuitWithoutPrompt = false; // Force prompts

// Platform specific configurations
if (process.platform === "darwin") {
  autoUpdater.allowDowngrade = true;
} else if (process.platform === "win32") {
  // app.setAppUserModelId('com.electron.electronapp');
  app.setAppUserModelId(process.execPath); // changed it to process.execPath from 'com.electron.electronapp' to fix the taskbar icon not showing issue ~ Aiyaz
  autoUpdater.autoInstallOnAppQuit = false; // Changed from true to prevent silent installs
  autoUpdater.allowDowngrade = false;
}

// Log update configuration (without exposing the token)
log.info("Update Configuration:", {
  platform: process.platform,
  appVersion: app.getVersion(),
  autoDownload: autoUpdater.autoDownload,
  allowPrerelease: autoUpdater.allowPrerelease,
  feedURL: autoUpdater.getFeedURL(),
  tokenConfigured: !!process.env.GH_TOKEN,
});
log.info("process.env.NODE_ENV", process.env.NODE_ENV);

// Allow updates without code signing in development
if (global.AppConfig.isDev) {
  autoUpdater.forceDevUpdateConfig = true;
}

// No runtime override – electron-updater reads
// publish info from package.json → build.publish.

// Log token status (without exposing the token)
// GH_TOKEN no longer needed for feed configuration
log.info("Auto-updater configured to use package.json publish settings");

// Add version tracking
let lastCheckedVersion = null;

// Auto-update event handlers with detailed logging
autoUpdater.on("checking-for-update", () => {
  performanceTracker.start("update-check");

  logWithTimestamp("info", UPDATE_LOG_PREFIX, "Update check initiated");
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Checking GitHub repository for new releases"
  );

  const updateCheckData = {
    currentVersion: app.getVersion(),
    checkTime: new Date().toISOString(),
    platform: process.platform,
    feedUrl: autoUpdater.getFeedURL(),
    autoDownloadEnabled: autoUpdater.autoDownload,
  };

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Update check configuration",
    updateCheckData
  );

  win?.webContents.send("update-status", "checking");
});

autoUpdater.on("update-available", (info) => {
  performanceTracker.end("update-check");
  performanceTracker.start("update-download-process");

  // Skip if we've already notified about this version
  if (lastCheckedVersion === info.version) {
    logWithTimestamp(
      "warn",
      UPDATE_LOG_PREFIX,
      `Skipping duplicate update notification for version: ${info.version}`
    );
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Update process terminated - duplicate version detected"
    );
    return;
  }

  const updateAvailableData = {
    currentVersion: app.getVersion(),
    newVersion: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes
      ? info.releaseNotes.substring(0, 200) + "..."
      : "No release notes",
    downloadUrl: info.files?.[0]?.url || "URL not available",
    fileSize: info.files?.[0]?.size || "Size unknown",
    detectionTime: new Date().toISOString(),
    isAutoDownloadEnabled: autoUpdater.autoDownload,
  };

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🎉 UPDATE AVAILABLE DETECTED!",
    updateAvailableData
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    `Version upgrade path: ${app.getVersion()} → ${info.version}`
  );

  lastCheckedVersion = info.version;

  // Log seamless download strategy
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🚀 SEAMLESS UPDATE STRATEGY ACTIVATED"
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "No user prompts - initiating silent background download"
  );

  // Send notification to frontend about background download starting
  const frontendNotification = {
    status: "downloading-background",
    version: info.version,
    message: "Update downloading in background...",
    timestamp: new Date().toISOString(),
  };

  logWithTimestamp(
    "info",
    USER_LOG_PREFIX,
    "Frontend notification sent",
    frontendNotification
  );
  win?.webContents.send("update-status", frontendNotification);

  // Create database backup silently in background
  performanceTracker.start("database-backup");

  try {
    const dbPath = path.join(userDataDir, "db.sqlite3");
    const backupDir = path.join(userDataDir, "backups");

    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Starting pre-update database backup"
    );

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        `Created backup directory: ${backupDir}`
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `db-backup-${timestamp}.sqlite`);

    if (fs.existsSync(dbPath)) {
      const dbStats = fs.statSync(dbPath);
      fs.copyFileSync(dbPath, backupPath);

      const backupData = {
        sourcePath: dbPath,
        backupPath: backupPath,
        dbSize: dbStats.size,
        backupTime: timestamp,
        success: true,
      };

      performanceTracker.end("database-backup");
      logWithTimestamp(
        "info",
        SUCCESS_LOG_PREFIX,
        "Database backup completed successfully",
        backupData
      );
    } else {
      logWithTimestamp(
        "warn",
        UPDATE_LOG_PREFIX,
        "Database file not found - skipping backup"
      );
    }
  } catch (error) {
    performanceTracker.end("database-backup");
    const backupError = {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    logWithTimestamp(
      "error",
      ERROR_LOG_PREFIX,
      "Database backup failed - continuing update",
      backupError
    );
  }

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Automatic download will commence (autoDownload=true)"
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "No manual download trigger required"
  );
});

autoUpdater.on("update-not-available", (info) => {
  performanceTracker.end("update-check");

  const noUpdateData = {
    currentVersion: app.getVersion(),
    latestVersion: info?.version || "Unknown",
    checkTime: new Date().toISOString(),
    platform: process.platform,
    isUpToDate: true,
  };

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "No updates available - application is up to date",
    noUpdateData
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Update check completed successfully"
  );

  win?.webContents.send("update-status", "not-available");
});

autoUpdater.on("download-progress", (progress) => {
  // Track download performance and provide detailed progress logging
  const downloadData = {
    percent: Math.round(progress.percent * 100) / 100,
    transferred: progress.transferred,
    total: progress.total,
    speed: progress.bytesPerSecond || 0,
    timeRemaining:
      progress.total && progress.bytesPerSecond
        ? Math.round(
            (progress.total - progress.transferred) / progress.bytesPerSecond
          )
        : "Unknown",
    timestamp: new Date().toISOString(),
  };

  // Log every 10% to avoid spam but provide detailed progress tracking
  if (
    Math.floor(progress.percent) % 10 === 0 &&
    Math.floor(progress.percent) !== Math.floor(progress.percent - 1)
  ) {
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      `📥 Download Progress: ${Math.round(progress.percent)}%`,
      downloadData
    );

    // Calculate and log download speed
    const speedMBps = progress.bytesPerSecond
      ? (progress.bytesPerSecond / 1024 / 1024).toFixed(2)
      : "Unknown";
    logWithTimestamp(
      "info",
      PERFORMANCE_LOG_PREFIX,
      `Download speed: ${speedMBps} MB/s`
    );
  }

  // Send detailed progress to frontend for optional subtle indicator
  const frontendProgress = {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    speed: progress.bytesPerSecond,
    timestamp: new Date().toISOString(),
  };

  win?.webContents.send("update-download-progress", frontendProgress);

  // Very subtle progress in taskbar (user barely notices)
  win?.setProgressBar(progress.percent / 100, { mode: "normal" });

  // Log completion
  if (progress.percent >= 100) {
    performanceTracker.end("update-download-process");
    logWithTimestamp(
      "info",
      SUCCESS_LOG_PREFIX,
      "Update download completed successfully!",
      {
        totalSize: progress.total,
        finalPercent: progress.percent,
        completionTime: new Date().toISOString(),
      }
    );
  }
});

// Add flag for tracking update status
let isUpdating = false;

// Cleanup function to ensure all processes are stopped before update
async function cleanupForUpdate(progressCallback) {
  // Add immediate entry confirmation
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🚪 CLEANUP FUNCTION ENTRY CONFIRMED - Function is being called!"
  );

  // Send initial progress update
  if (progressCallback) {
    progressCallback("Starting cleanup...", "Preparing to stop services");
  }

  performanceTracker.start("cleanup-process");
  isPerformingCleanup = true; // Set flag to prevent window-all-closed from quitting

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🧹 ADMIN-LEVEL CLEANUP SEQUENCE INITIATED"
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Using administrator privileges for clean process termination"
  );

  const cleanupSteps = [];

  try {
    // 1. Stop the Gateway Windows Service with admin privileges
    if (process.platform === "win32") {
      performanceTracker.start("gateway-service-stop");
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        "Step 1/6: Stopping Gateway Windows Service (Admin Mode)"
      );

      // Update progress
      if (progressCallback) {
        progressCallback("Stopping services...", "This may take a moment");
      }

      // Try stopping both services
      const serviceNames = ["LicensingServer"];
      for (const serviceName of serviceNames) {
        // Create a retry function for stopping services
        const stopServiceWithRetry = (
          serviceName,
          maxRetries = 10,
          timeoutMs = 30000
        ) => {
          const startTime = Date.now();
          let attempts = 0;

          while (attempts < maxRetries && Date.now() - startTime < timeoutMs) {
            try {
              attempts++;
              logWithTimestamp(
                "info",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Attempt ${attempts}/${maxRetries}: Stopping service ${serviceName}`
              );

              // First, try to stop the service
              try {
                execSync(`sc stop "${serviceName}"`, { timeout: 5000 });
                logWithTimestamp(
                  "info",
                  UPDATE_LOG_PREFIX,
                  `[CLEANUP] Stop command sent for ${serviceName}`
                );
              } catch (stopError) {
                // Check if service is already stopped or doesn't exist
                if (
                  stopError.message.includes("1062") ||
                  stopError.message.includes("not started") ||
                  stopError.message.includes("1052") ||
                  stopError.message.includes("1060")
                ) {
                  logWithTimestamp(
                    "info",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Service ${serviceName} was already stopped or doesn't exist`
                  );
                  return true;
                }
                // If it's a different error, we'll still try to verify status below
                logWithTimestamp(
                  "warn",
                  UPDATE_LOG_PREFIX,
                  `[CLEANUP] Stop command error for ${serviceName}: ${stopError.message}`
                );
              }

              // Now verify the service has actually stopped using sc query
              let verificationAttempts = 0;
              const maxVerificationAttempts = 5;

              while (verificationAttempts < maxVerificationAttempts) {
                try {
                  verificationAttempts++;
                  const queryResult = execSync(`sc query "${serviceName}"`, {
                    timeout: 3000,
                    encoding: "utf8",
                  });

                  logWithTimestamp(
                    "info",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Verification attempt ${verificationAttempts}: Checking ${serviceName} status`
                  );

                  // Check if service is stopped
                  if (
                    queryResult.includes("STATE") &&
                    (queryResult.includes("STOPPED") ||
                      queryResult.includes("1  STOPPED"))
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] ✅ Service ${serviceName} confirmed STOPPED on attempt ${attempts}`
                    );
                    return true;
                  } else if (
                    queryResult.includes("STOP_PENDING") ||
                    queryResult.includes("3  STOP_PENDING")
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] Service ${serviceName} is stopping... waiting`
                    );
                    // Wait a bit for the service to finish stopping
                    try {
                      execSync(`timeout /t 2 /nobreak > nul 2>&1`, {
                        stdio: "ignore",
                      });
                    } catch (_) {
                      const start = Date.now();
                      while (Date.now() - start < 2000) {
                        // Busy wait 2 seconds
                      }
                    }
                  } else {
                    logWithTimestamp(
                      "warn",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] Service ${serviceName} still running, will retry stop command`
                    );
                    break; // Exit verification loop to retry stop command
                  }
                } catch (queryError) {
                  // Service doesn't exist or query failed
                  if (
                    queryError.message.includes("1060") ||
                    queryError.message.includes("does not exist")
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] ✅ Service ${serviceName} doesn't exist (already removed)`
                    );
                    return true;
                  }
                  logWithTimestamp(
                    "warn",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Query error for ${serviceName}: ${queryError.message}`
                  );
                  break; // Exit verification loop to retry
                }
              }

              // If we get here, either verification failed or service is still running
              logWithTimestamp(
                "warn",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Service ${serviceName} not confirmed stopped, will retry`
              );

              // Wait before retry (exponential backoff, max 5 seconds)
              const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
              try {
                execSync(
                  `timeout /t ${Math.ceil(
                    waitTime / 1000
                  )} /nobreak > nul 2>&1`,
                  { stdio: "ignore" }
                );
              } catch (_) {
                // Fallback to setTimeout if timeout command fails
                const start = Date.now();
                while (Date.now() - start < waitTime) {
                  // Busy wait
                }
              }
            } catch (error) {
              logWithTimestamp(
                "error",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Unexpected error on attempt ${attempts} for ${serviceName}: ${error.message}`
              );

              // Wait before retry
              const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
              try {
                execSync(
                  `timeout /t ${Math.ceil(
                    waitTime / 1000
                  )} /nobreak > nul 2>&1`,
                  { stdio: "ignore" }
                );
              } catch (_) {
                const start = Date.now();
                while (Date.now() - start < waitTime) {
                  // Busy wait
                }
              }
            }
          }

          logWithTimestamp(
            "error",
            UPDATE_LOG_PREFIX,
            `[CLEANUP] ❌ Failed to stop and verify service ${serviceName} after ${attempts} attempts and ${
              Date.now() - startTime
            }ms`
          );
          return false;
        };

        try {
          stopServiceWithRetry(serviceName);
        } catch (_) {
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            `[CLEANUP] Service ${serviceName} retry function completed`
          );
        }
      }

      cleanupSteps.push({
        step: "Gateway Service Stop",
        status: "SUCCESS",
        timing: performanceTracker.end("gateway-service-stop"),
      });
    }

    // 2. Close database connections
    performanceTracker.start("database-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 2/6: Closing database connections"
    );

    // Update progress
    if (progressCallback) {
      progressCallback("Closing database...", "Saving your data");
    }

    try {
      const dbManager = databaseManager.getInstance();
      if (dbManager && dbManager.getDatabase()) {
        const db = dbManager.getDatabase();
        if (db && db.close) {
          db.close();
          logWithTimestamp(
            "info",
            SUCCESS_LOG_PREFIX,
            "Database connection closed successfully"
          );
        }
      }
      cleanupSteps.push({
        step: "Database Cleanup",
        status: "SUCCESS",
        timing: performanceTracker.end("database-cleanup"),
      });
    } catch (e) {
      performanceTracker.end("database-cleanup");
      cleanupSteps.push({
        step: "Database Cleanup",
        status: "ERROR",
        error: e.message,
      });
    }

    // 3. Terminate Python backend with admin privileges
    performanceTracker.start("python-process-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 3/6: Terminating Python backend (Admin Mode)"
    );

    // Update progress
    if (progressCallback) {
      progressCallback("Stopping backend...", "Terminating Python processes");
    }

    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!pythonProcess.killed) {
        pythonProcess.kill("SIGKILL");
      }
    }

    // Force kill any remaining Python processes with admin privileges
    if (process.platform === "win32") {
      try {
        execSync("taskkill /F /IM main.exe", { timeout: 3000 });
        logWithTimestamp(
          "info",
          SUCCESS_LOG_PREFIX,
          "Python processes terminated with admin privileges"
        );
      } catch (e) {
        // Process might not exist - not an error
      }
    }

    cleanupSteps.push({
      step: "Python Process Cleanup",
      status: "SUCCESS",
      timing: performanceTracker.end("python-process-cleanup"),
    });

    // 4. Terminate Gateway executable (Admin Mode - Force Kill)
    performanceTracker.start("gateway-exe-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 4/6: Terminating Gateway executable (Admin Mode)"
    );

    if (process.platform === "win32") {
      // Use multiple aggressive kill methods
      const killMethods = [
        'taskkill /IM "gatewayService.exe" /F',
        'taskkill /IM "gatewayService.exe" /F /T',
        "wmic process where \"name like '%gateway%'\" delete",
        "powershell -Command \"Get-Process | Where-Object {$_.ProcessName -like '*gateway*'} | Stop-Process -Force\"",
      ];

      let killed = false;
      for (let i = 0; i < killMethods.length; i++) {
        try {
          execSync(killMethods[i], {
            shell: true,
            windowsHide: true,
            timeout: 3000,
          });
          killed = true;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (e) {
          // Continue with next method
        }
      }

      // Verify it's actually dead
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        execSync('tasklist | find /I "gatewayService.exe"', { shell: true });
        logWithTimestamp(
          "warn",
          UPDATE_LOG_PREFIX,
          "Gateway process might still be running after kill attempts"
        );
        cleanupSteps.push({
          step: "Gateway Executable Cleanup",
          status: "PARTIAL_SUCCESS",
          timing: performanceTracker.end("gateway-exe-cleanup"),
        });
      } catch (e) {
        logWithTimestamp(
          "info",
          SUCCESS_LOG_PREFIX,
          "Gateway executable terminated successfully with admin privileges"
        );
        cleanupSteps.push({
          step: "Gateway Executable Cleanup",
          status: "SUCCESS",
          timing: performanceTracker.end("gateway-exe-cleanup"),
        });
      }
    }

    // 5. Close main application windows (preserve installation window)
    performanceTracker.start("window-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 5/6: Closing application windows"
    );

    const openWindows = BrowserWindow.getAllWindows();
    let windowsClosedCount = 0;
    let installationWindowsFound = 0;
    let mainWindowSkipped = false;

    openWindows.forEach((window, index) => {
      if (!window.isDestroyed()) {
        const isInstallationWindow = window.isInstallationWindow === true;
        const isMainWindow = window === win;

        if (isInstallationWindow) {
          installationWindowsFound++;
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            `Preserving installation window ${index + 1}`
          );
        } else if (isMainWindow) {
          // CRITICAL: Don't close the main window during update
          // We need it to stay alive to call quitAndInstall
          mainWindowSkipped = true;
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            `Preserving main window during update cleanup`
          );
        } else {
          try {
            window.removeAllListeners("close");
            window.close();
            windowsClosedCount++;
          } catch (e) {
            // Window might already be closing
          }
        }
      }
    });

    logWithTimestamp(
      "info",
      SUCCESS_LOG_PREFIX,
      `Closed ${windowsClosedCount} windows, preserved ${installationWindowsFound} installation windows${
        mainWindowSkipped ? " and main window" : ""
      }`
    );

    cleanupSteps.push({
      step: "Window Cleanup",
      status: "SUCCESS",
      windowsClosed: windowsClosedCount,
      installationWindowsPreserved: installationWindowsFound,
      timing: performanceTracker.end("window-cleanup"),
    });

    // 6. Final settlement wait
    performanceTracker.start("final-wait");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 6/6: Final process settlement (3 seconds)"
    );
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Admin privileges ensure clean termination - minimal wait required"
    );

    // Update progress
    if (progressCallback) {
      progressCallback("Finalizing cleanup...", "Almost ready to install");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    cleanupSteps.push({
      step: "Final Settlement Wait",
      status: "COMPLETED",
      timing: performanceTracker.end("final-wait"),
    });

    const totalCleanupTime = performanceTracker.end("cleanup-process");

    // Admin-level cleanup summary
    const cleanupSummary = {
      totalSteps: cleanupSteps.length,
      successfulSteps: cleanupSteps.filter((s) => s.status === "SUCCESS")
        .length,
      adminPrivileges: true,
      totalCleanupTime: totalCleanupTime,
      completionTime: new Date().toISOString(),
      stepDetails: cleanupSteps,
    };

    logWithTimestamp(
      "info",
      SUCCESS_LOG_PREFIX,
      "🧹 ADMIN-LEVEL CLEANUP COMPLETED SUCCESSFULLY!",
      cleanupSummary
    );
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "All processes terminated cleanly with administrator privileges"
    );
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "System ready for seamless update installation"
    );
  } catch (error) {
    performanceTracker.end("cleanup-process");

    const criticalError = {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      adminPrivileges: true,
    };

    logWithTimestamp(
      "error",
      ERROR_LOG_PREFIX,
      "💥 CRITICAL ERROR IN ADMIN-LEVEL CLEANUP",
      criticalError
    );
    logWithTimestamp(
      "warn",
      UPDATE_LOG_PREFIX,
      "Continuing with update installation despite cleanup errors"
    );
  }

  // Reset flag after cleanup completes
  isPerformingCleanup = false;
}

autoUpdater.on("update-downloaded", (info) => {
  performanceTracker.start("user-interaction-flow");

  const downloadCompletedData = {
    newVersion: info.version,
    currentVersion: app.getVersion(),
    downloadedAt: new Date().toISOString(),
    fileSize: info.files?.[0]?.size || "Unknown",
    releaseNotes: info.releaseNotes
      ? info.releaseNotes.substring(0, 100) + "..."
      : "No release notes",
    platform: process.platform,
  };

  logWithTimestamp(
    "info",
    SUCCESS_LOG_PREFIX,
    "🎉 UPDATE DOWNLOAD COMPLETED SUCCESSFULLY!",
    downloadCompletedData
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Clearing taskbar progress indicator"
  );

  win?.setProgressBar(-1); // Clear taskbar progress

  // Log the seamless strategy transition
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🎯 TRANSITIONING TO USER INTERACTION PHASE"
  );
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "This is the ONLY user interaction in the seamless update process"
  );

  // Send notification to frontend first (for any UI updates)
  const frontendUpdateStatus = {
    status: "ready-to-install",
    version: info.version,
    message: "Update ready to install",
    timestamp: new Date().toISOString(),
  };

  logWithTimestamp(
    "info",
    USER_LOG_PREFIX,
    "Sending ready-to-install status to frontend",
    frontendUpdateStatus
  );
  win?.webContents.send("update-status", frontendUpdateStatus);

  // Show user-friendly notification AFTER download is complete
  const dialogOptions = {
    type: "info",
    title: "Update Ready to Install",
    message: `🎉 New version ${info.version} has been downloaded!`,
    detail:
      "The update is ready to install. Would you like to restart and apply it now, or install it later?",
    buttons: ["Install Now", "Install Later"],
    defaultId: 0,
    cancelId: 1,
  };

  logWithTimestamp(
    "info",
    USER_LOG_PREFIX,
    "Displaying update installation dialog to user",
    {
      dialogTitle: dialogOptions.title,
      dialogMessage: dialogOptions.message,
      buttonOptions: dialogOptions.buttons,
      displayTime: new Date().toISOString(),
    }
  );
  dialog
    .showMessageBox(win, dialogOptions)
    .then(async (response) => {
      performanceTracker.end("user-interaction-flow");

      const userChoice =
        response.response === 0 ? "Install Now" : "Install Later";

      logWithTimestamp(
        "info",
        USER_LOG_PREFIX,
        `User decision recorded: ${userChoice}`,
        {
          buttonIndex: response.response,
          responseTime: new Date().toISOString(),
          userChoice: userChoice,
        }
      );

      if (response.response === 0) {
        // User clicked "Install Now"
        performanceTracker.start("installation-process");

        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "🚀 IMMEDIATE INSTALLATION REQUESTED BY USER"
        );

        // Set updating flag to skip confirmation dialogs FIRST
        isUpdating = true;
        sessionManager.logoutUser();

        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Update flag set - skipping close confirmations"
        );
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "User session logged out for clean installation"
        );

        // Create success flag for next startup
        const updateFlagPath = path.join(
          app.getPath("userData"),
          "update-success.txt"
        );
        fs.writeFileSync(updateFlagPath, info.version);
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          `Success flag created: ${updateFlagPath}`
        );

        // CRITICAL: Give UI time to update before starting heavy operations
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Show minimal installation progress BEFORE cleanup
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Creating installation progress window"
        );

        const installingWindow = new BrowserWindow({
          width: 450,
          height: 320,
          frame: false,
          resizable: false,
          center: true,
          alwaysOnTop: true,
          show: false,
          transparent: false,
          backgroundColor: "#ffffff",
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
          },
        });

        // Mark this as an installation window for cleanup exclusion
        installingWindow.isInstallationWindow = true;

        const installHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Installing CypherEdge Update</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: #ffffff;
                background-color: #ffffff;
                color: #1a1a1a;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                padding: 20px;
                user-select: none;
                opacity: 1;
              }
              .container {
                text-align: center;
                background: #ffffff;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
                border: 1px solid #e5e7eb;
                max-width: 400px;
                width: 100%;
              }
              .logo {
                width: 48px;
                height: 48px;
                margin: 0 auto 20px;
                background: #3b82f6;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
              }
              .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #f3f4f6;
                border-top: 3px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 24px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              h3 {
                font-size: 18px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 8px;
                letter-spacing: -0.025em;
              }
              p {
                font-size: 14px;
                color: #6b7280;
                line-height: 1.5;
                margin-bottom: 20px;
              }
              .progress-bar {
                width: 100%;
                height: 6px;
                background: #f3f4f6;
                border-radius: 3px;
                overflow: hidden;
                margin-top: 24px;
              }
              .progress-fill {
                height: 100%;
                background: #3b82f6;
                border-radius: 3px;
                width: 0%;
                animation: progress 30s ease-out forwards;
              }
              @keyframes progress {
                0% { width: 0%; }
                10% { width: 15%; }
                30% { width: 35%; }
                50% { width: 55%; }
                70% { width: 75%; }
                90% { width: 90%; }
                100% { width: 95%; }
              }
              .step-indicator {
                display: flex;
                justify-content: space-between;
                margin-top: 16px;
                font-size: 11px;
                color: #9ca3af;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">C</div>
              <div class="spinner"></div>
              <h3 id="status">Preparing update...</h3>
              <p id="detail">Please wait while we prepare your system for the update. This may take a moment.</p>
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
              <div class="step-indicator">
                <span>Starting</span>
                <span>Cleaning up</span>
                <span>Installing</span>
              </div>
            </div>
            <script>
              const { ipcRenderer } = require('electron');
              ipcRenderer.on('update-progress', (event, data) => {
                document.getElementById('status').textContent = data.status || 'Installing update...';
                if (data.detail) {
                  document.getElementById('detail').textContent = data.detail;
                }
              });
            </script>
          </body>
        </html>
      `;

        installingWindow.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(installHtml)
        );

        // Show window immediately and wait for it to be fully visible
        installingWindow.once("ready-to-show", () => {
          installingWindow.show();
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "Installation progress window displayed to user"
          );

          // Send initial progress update immediately
          installingWindow.webContents.send("update-progress", {
            status: "Preparing update...",
            detail: "Starting cleanup process...",
          });
        });

        // CRITICAL: Wait for window to be fully shown before starting cleanup
        await new Promise((resolve) => {
          if (installingWindow.isVisible()) {
            resolve();
          } else {
            installingWindow.once("show", () => {
              // Give it a moment to render
              setTimeout(resolve, 100);
            });
          }
        });
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Window confirmed visible - proceeding with installation"
        );

        // Store reference to send progress updates
        const sendProgressUpdate = (status, detail) => {
          if (installingWindow && !installingWindow.isDestroyed()) {
            installingWindow.webContents.send("update-progress", {
              status,
              detail,
            });
          }
        };

        // Hand control to updater – cleanup runs later
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "[DEBUG] launching installer"
        );

        try {
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "🚀 INITIATING QUIT AND INSTALL SEQUENCE"
          );
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "Application will restart with new version"
          );

          performanceTracker.end("installation-process");

          // 🧹 CRITICAL: Run cleanup BEFORE quitAndInstall while app is still fully running
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "🧹 Starting pre-installation cleanup process..."
          );

          // Add detailed error handling around cleanup
          try {
            logWithTimestamp(
              "info",
              UPDATE_LOG_PREFIX,
              "🔧 About to call cleanupForUpdate()..."
            );

            // Send initial cleanup status
            sendProgressUpdate(
              "Starting cleanup...",
              "Preparing to stop services"
            );

            // Run the comprehensive cleanup function
            await cleanupForUpdate(sendProgressUpdate);

            logWithTimestamp(
              "info",
              UPDATE_LOG_PREFIX,
              "✅ Pre-installation cleanup completed successfully"
            );
          } catch (cleanupError) {
            // Log cleanup errors but continue with installation
            logWithTimestamp(
              "error",
              ERROR_LOG_PREFIX,
              "❌ Cleanup function failed but continuing with installation",
              {
                error: cleanupError.message,
                stack: cleanupError.stack,
                timestamp: new Date().toISOString(),
              }
            );

            // Still try to proceed with installation
            logWithTimestamp(
              "warn",
              UPDATE_LOG_PREFIX,
              "⚠️ Proceeding with installation despite cleanup failure"
            );
          }

          // Simple approach - let electron-updater handle everything
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "Calling autoUpdater.quitAndInstall",
            {
              isSilent: false,
              isForceRunAfter: true,
            }
          );

          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            "🚀 LAUNCHING INSTALLER NOW - Application will close and installer will appear"
          );

          // Final progress update before installer launches
          sendProgressUpdate(
            "Ready to install!",
            "The installer will launch in a moment..."
          );

          // Give user a moment to see the message
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // This will show the installer UI properly now that allowElevation=true
          autoUpdater.quitAndInstall(false, true);
        } catch (err) {
          performanceTracker.end("installation-process");
          const installError = {
            error: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString(),
          };
          logWithTimestamp(
            "error",
            ERROR_LOG_PREFIX,
            "Critical error during installation",
            installError
          );
          app.quit();
        }
      } else {
        // User clicked "Install Later"
        logWithTimestamp(
          "info",
          USER_LOG_PREFIX,
          "📅 DEFERRED INSTALLATION SELECTED BY USER"
        );
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Update will be applied on next application restart"
        );
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Update file cached and ready for installation"
        );
      }
    })
    .catch((dialogError) => {
      performanceTracker.end("user-interaction-flow");
      const dialogErrorData = {
        error: dialogError.message,
        stack: dialogError.stack,
        timestamp: new Date().toISOString(),
      };
      logWithTimestamp(
        "error",
        ERROR_LOG_PREFIX,
        "Error displaying installation dialog",
        dialogErrorData
      );
    });
});

autoUpdater.on("error", (err) => {
  // Stop any running performance timers
  if (performanceTracker.timers.has("update-check"))
    performanceTracker.end("update-check");
  if (performanceTracker.timers.has("update-download-process"))
    performanceTracker.end("update-download-process");
  if (performanceTracker.timers.has("installation-process"))
    performanceTracker.end("installation-process");
  // Suppress 403 errors (GitHub authentication issues)
  if (
    err.message &&
    (err.message.includes("403") ||
      err.message.includes("AuthenticationFailed"))
  ) {
    log.info(
      "Update check skipped - GitHub authentication token expired (this is normal after updates)"
    );
    win?.webContents.send("update-error", "");
    win?.setProgressBar(-1);
    return;
  }
  const errorData = {
    errorMessage: err.message,
    errorCode: err.code || "Unknown",
    stack: err.stack || "No stack trace available",
    platform: process.platform,
    appVersion: app.getVersion(),
    timestamp: new Date().toISOString(),
    updateUrl: autoUpdater.getFeedURL(),
    autoDownloadEnabled: autoUpdater.autoDownload,
  };

  logWithTimestamp(
    "error",
    ERROR_LOG_PREFIX,
    "💥 AUTO-UPDATER ERROR OCCURRED",
    errorData
  );

  // Categorize error types for better analysis
  let errorCategory = "UNKNOWN";
  if (err.message.includes("No published releases")) {
    errorCategory = "NO_RELEASES_AVAILABLE";
  } else if (err.message.includes("net::")) {
    errorCategory = "NETWORK_ERROR";
  } else if (err.message.includes("ENOENT")) {
    errorCategory = "FILE_NOT_FOUND";
  } else if (err.message.includes("Permission denied")) {
    errorCategory = "PERMISSION_ERROR";
  } else if (err.message.includes("timeout")) {
    errorCategory = "TIMEOUT_ERROR";
  }

  logWithTimestamp(
    "error",
    ERROR_LOG_PREFIX,
    `Error category identified: ${errorCategory}`
  );

  win?.webContents.send("update-error", err.message);
  win?.setProgressBar(-1); // Clear any progress indication

  // Show error to user only if it's a critical error (not just "no releases")
  if (!err.message.includes("No published releases")) {
    const errorDialogData = {
      errorCategory: errorCategory,
      shownToUser: true,
      userNotificationTime: new Date().toISOString(),
    };

    logWithTimestamp(
      "error",
      USER_LOG_PREFIX,
      "Displaying error dialog to user",
      errorDialogData
    );

    dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "There was a problem updating the application.",
      detail:
        "You can try again later or contact support if the problem persists.",
      buttons: ["OK"],
    });
  } else {
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Non-critical error - no user notification shown"
    );
  }

  // Log recovery suggestions for backend team
  const recoverySuggestions = {
    errorCategory: errorCategory,
    suggestions: getRecoverySuggestions(errorCategory),
    timestamp: new Date().toISOString(),
  };

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Recovery suggestions for backend team",
    recoverySuggestions
  );
});

// Helper function for recovery suggestions
function getRecoverySuggestions(errorCategory) {
  const suggestions = {
    NO_RELEASES_AVAILABLE: [
      "Verify GitHub repository has published releases",
      "Check release visibility settings",
      "Ensure GH_TOKEN has correct permissions",
    ],
    NETWORK_ERROR: [
      "Check internet connectivity",
      "Verify firewall settings",
      "Test GitHub API accessibility",
    ],
    PERMISSION_ERROR: [
      "Check file system permissions",
      "Verify user has write access to update directory",
      "Consider running with elevated permissions",
    ],
    TIMEOUT_ERROR: [
      "Increase timeout settings",
      "Check network stability",
      "Retry during off-peak hours",
    ],
    UNKNOWN: [
      "Review full error logs",
      "Check system resources",
      "Verify update configuration",
    ],
  };

  return suggestions[errorCategory] || suggestions["UNKNOWN"];
}

let win = null;
let splashWindow = null;
let pythonProcess = null;
let isPerformingCleanup = false; // Add this flag

const BACKEND_PORT = 5000; // Replace with the port your backend is listening to

function checkPortAvailability(port) {
  return new Promise((resolve, reject) => {
    portscanner.checkPortStatus(port, "127.0.0.1", (error, status) => {
      if (error) {
        reject(error);
      } else {
        resolve(status === "open");
      }
    });
  });
}

function getProductionExecutablePath() {
  const platformExecutables = {
    win32: path.join(process.resourcesPath, "backend", "main", "main.exe"),
    darwin: path.join(process.resourcesPath, "backend", "main", "main"),
  };

  const executablePath = platformExecutables[process.platform];

  if (!executablePath || !fs.existsSync(executablePath)) {
    const errorMessage = `Executable not found for platform: ${process.platform}. Path: ${executablePath}`;
    log.error(errorMessage);

    // Log the contents of the resources directory
    try {
      const resourcesContents = fs.readdirSync(process.resourcesPath);
      log.info("Contents of resources directory:", resourcesContents);

      const backendPath = path.join(process.resourcesPath, "backend");
      if (fs.existsSync(backendPath)) {
        const backendContents = fs.readdirSync(backendPath);
        log.info("Contents of backend directory:", backendContents);

        const mainPath = path.join(backendPath, "main");
        if (fs.existsSync(mainPath)) {
          const mainContents = fs.readdirSync(mainPath);
          log.info("Contents of main directory:", mainContents);
        }
      }
    } catch (err) {
      log.error("Error listing directory contents:", err);
    }

    dialog.showErrorBox("Executable Missing", errorMessage);
    return null;
  }

  return executablePath;
}

async function startPythonExecutable() {
  return new Promise((resolve, reject) => {
    let command, args;
    let options = {
      detached: false,
      stdio: "pipe",
    };

    if (global.AppConfig.isDev) {
      // Development mode code remains the same
      const venvPythonPath =
        process.platform === "win32"
          ? path.join(__dirname, "../.venv/Scripts/python.exe")
          : path.join(__dirname, "../.venv/bin/python");

      const pythonScriptPath = path.join(__dirname, "../backend/main.py");
      const workingDir = path.join(__dirname, "../");

      if (!fs.existsSync(pythonScriptPath)) {
        const errorMessage =
          "Python script main.py not found in development mode.";
        log.error(errorMessage);
        dialog.showErrorBox("Development Error", errorMessage);
        reject(new Error(errorMessage));
        return;
      }

      if (!fs.existsSync(venvPythonPath)) {
        const errorMessage =
          "Virtual environment not found. Ensure .venv is set up.";
        log.error(errorMessage);
        dialog.showErrorBox("Development Error", errorMessage);
        reject(new Error(errorMessage));
        return;
      }

      command = venvPythonPath;
      args = ["-m", "backend.main"];
      options.cwd = workingDir;
    } else {
      // Production mode
      const executablePath = getProductionExecutablePath();
      if (!executablePath) {
        reject(new Error("Executable not found"));
        return;
      }

      // Check if the executable is actually executable
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
      } catch (err) {
        log.error("Executable lacks execution permissions:", err);
      }

      command = executablePath;

      // Set working directory to the executable's directory
      options.cwd = path.dirname(executablePath);
      log.info("Setting working directory to:", options.cwd);

      // Check if the user sheet exists in the user data directory
      const userSheet = path.join(userDataDir, "Customer_category.xlsx");
      args = ["--customer-sheet-path", userSheet];

      if (!fs.existsSync(userSheet)) {
        const defaultSheet = path.join(
          process.resourcesPath,
          "backend",
          "main",
          "_internal",
          "Customer_category.xlsx"
        );

        if (!fs.existsSync(userSheet)) {
          if (fs.existsSync(defaultSheet)) {
            // Make sure the folder exists
            fs.mkdirSync(path.dirname(userSheet), { recursive: true });

            // Copy the default into userData
            fs.copyFileSync(defaultSheet, userSheet);
            console.log("Copied default user sheet to userData:", userSheet);
          } else {
            console.error("Bundled sheet not found at:", defaultSheet);
          }
        }
      }

      options.env = {
        ...options.env,
        PYTHONIOENCODING: "utf-8",
        CUSTOMER_SHEET_PATH: userSheet,
      };
    }

    try {
      log.info("Spawning process with options:", {
        command,
        args,
        options,
      });

      pythonProcess = spawn(command, args, options);

      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString().trim();
        log.info(`Process stdout: ${output}`);
      });

      pythonProcess.stderr.on("data", (data) => {
        const error = data.toString().trim();
        log.error(`Process stderr: ${error}`);
      });

      pythonProcess.on("error", (error) => {
        const errorMessage = `Failed to start process: ${error.message}`;
        log.error(errorMessage);
        log.error("Error details:", error);
        dialog.showErrorBox("Process Error", errorMessage);
        reject(error);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          const errorMessage = `Process exited with code: ${code}`;
          log.error(errorMessage);
          reject(new Error(errorMessage));
        } else {
          log.info("Process started successfully");
          resolve();
        }
      });

      // Wait a bit to ensure process starts
      setTimeout(() => {
        if (pythonProcess.exitCode === null) {
          log.info(
            "Process still running after timeout - considering it successful"
          );
          resolve();
        }
      }, 2000);
    } catch (error) {
      const errorMessage = `Unexpected error starting process: ${error.message}`;
      log.error(errorMessage);
      log.error("Error details:", error);
      dialog.showErrorBox("Unexpected Error", errorMessage);
      reject(error);
    }
  });
}

const XLSM_SOURCE_DIR = path.join(__dirname, "media", "vouchers", "tallyprime"); // Bundled location
const XLSM_USERDATA_DIR = path.join(app.getPath("userData"), "tallyprime");

// Copies all .xlsm files from sourceDir to destDir, replacing old files with new ones.
function syncTallyprimeFilesToUserData() {
  if (!fs.existsSync(XLSM_SOURCE_DIR)) {
    log.error("Source .xlsm directory not found:", XLSM_SOURCE_DIR);
    return;
  }
  if (!fs.existsSync(XLSM_USERDATA_DIR)) {
    fs.mkdirSync(XLSM_USERDATA_DIR, { recursive: true });
  }
  const xlsmFiles = fs
    .readdirSync(XLSM_SOURCE_DIR)
    .filter((f) => f.endsWith(".xlsm"));

  log.info({ xlsmFiles });
  xlsmFiles.forEach((file) => {
    const src = path.join(XLSM_SOURCE_DIR, file);
    const dest = path.join(XLSM_USERDATA_DIR, file);
    log.info({ src, dest });
    // Always overwrite to ensure latest is shipped on update
    fs.copyFileSync(src, dest);
    log.info(`Synced tallyprime file: ${file}`);
  });
}

// Add this function to handle file protocol
function createProtocol() {
  protocol.registerFileProtocol("app", (request, callback) => {
    const url = request.url.replace("app://", "");
    log.info("Request URL:", url);
    try {
      return callback(path.normalize(`${__dirname}/../react-app/build/${url}`));
    } catch (error) {
      log.error("Protocol error:", error);
    }
  });
}

function createSplashWindow() {
  log.info("🎨 Creating splash window...");

  try {
    splashWindow = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: false,
      resizable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      center: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const splashPath = path.join(__dirname, "/react-app/splash.html");
    log.info("🎨 Loading splash file:", splashPath);

    splashWindow.loadFile(splashPath).catch((error) => {
      log.error("❌ Failed to load splash file:", error);
    });

    splashWindow.once("ready-to-show", () => {
      log.info("✅ Splash screen ready to show - displaying to user");
      splashWindow.show();
      log.info("✅ Splash screen is now visible");
    });

    splashWindow.on("closed", () => {
      log.info("🔒 Splash screen closed");
      splashWindow = null;
    });

    log.info("✅ Splash window instance created successfully");
  } catch (error) {
    log.error("❌ Failed to create splash window:", error);
    throw error;
  }
}

// Add this helper anywhere above createWindow():
function setupEventListeners(win) {
  // Listen for remaining seconds updates
  sessionManager.on("remainingSecondsUpdated", (seconds) => {
    // Safety check: Only send if window exists and isn't destroyed
    if (win && !win.isDestroyed()) {
      win.webContents.send("remainingSecondsUpdated", seconds);
    }
  });

  // Listen for license expiration
  sessionManager.on("licenseExpired", () => {
    log.info("License expired");
    // Optionally handle the license expiration, e.g., show a dialog or quit the app
    sessionManager.logoutUser();

    // Safety check: Only send if window exists and isn't destroyed
    if (win && !win.isDestroyed()) {
      win.webContents.send("navigateToLogin");
    }
  });
}

async function createWindow() {
  log.info("🔍 [CREATEWINDOW_DEBUG] createWindow() function called");
  log.info("🔍 [CREATEWINDOW_DEBUG] Creating new BrowserWindow with dimensions 1800x1000");
  
  win = new BrowserWindow({
    width: 1800,
    height: 1000,
    simpleFullscreen: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "cyphersol-icon.png"),
    autoHideMenuBar: true,
    title: global.AppConfig.isDev
      ? `CypherEdge Dev v${app.getVersion()}`
      : `CypherEdge v${app.getVersion()}`,
  });
  if (global.AppConfig.isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    const prodPath = path.resolve(
      __dirname,
      "react-app",
      "build",
      "index.html"
    );
    win.loadFile(prodPath).catch((err) => {
      log.error("Failed to load production build:", err);
    });
  }

  setupEventListeners(win);
  log.info("🔍 [CREATEWINDOW_DEBUG] Event listeners setup completed");
  log.info("🔍 [CREATEWINDOW_DEBUG] About to set up window.on('close') handler");

  win.on("close", (event) => {
    log.info("Close event triggered");

    // Skip confirmation if we're updating
    if (isUpdating) {
      log.info("Skipping close confirmation for update installation");
      sessionManager.logoutUser();
      return;
    }

    // CRITICAL: Prevent immediate close and clean up listeners first
    event.preventDefault();

    // Remove all SessionManager listeners to prevent "Object destroyed" errors
    try {
      sessionManager.removeAllListeners("remainingSecondsUpdated");
      sessionManager.removeAllListeners("licenseExpired");
      log.info("SessionManager listeners removed before close dialog");
    } catch (err) {
      log.error("Error removing SessionManager listeners:", err);
    }

    const choice = dialog.showMessageBoxSync(win, {
      type: "warning",
      buttons: ["Yes", "Cancel"],
      defaultId: 1,
      title: "Confirm Exit",
      message:
        "Closing the app will log out your session. Do you want to proceed?",
    });

    if (choice === 0) {
      log.info("User confirmed app close. Logging out...");
      sessionManager.logoutUser();
      win.destroy(); // Explicitly destroy the window
    } else {
      log.info("User canceled app close.");
      // Re-establish the event listeners since user cancelled
      setupEventListeners(win);
    }
  });
  // setTimeout(() => {
  //   log.info("Closing window after 5 seconds");
  //   log.info("window dsetroyed");
  //   if (win) win.destroy()
  // }, 5000)

  win.on("closed", () => {
    console.log('🔍 [WINDOW_CLOSE] Window closed event triggered');
    console.log('🔍 [WINDOW_CLOSE] sessionManager defined:', !!sessionManager);
    console.log('🔍 [WINDOW_CLOSE] sessionManager type:', typeof sessionManager);
    console.log('🔍 [WINDOW_CLOSE] sessionManager stopLicenseCountdown:', typeof sessionManager?.stopLicenseCountdown);
    console.log('🔍 [WINDOW_CLOSE] sessionManager removeAllListeners:', typeof sessionManager?.removeAllListeners);
    
    try {
      sessionManager.stopLicenseCountdown();
      console.log('🔍 [WINDOW_CLOSE] stopLicenseCountdown called successfully');
    } catch (error) {
      console.error('🔍 [WINDOW_CLOSE] ERROR calling stopLicenseCountdown:', error);
    }
    
    try {
      if (typeof sessionManager.removeAllListeners === 'function') {
        sessionManager.removeAllListeners();
        console.log('🔍 [WINDOW_CLOSE] removeAllListeners called successfully');
      } else {
        console.error('🔍 [WINDOW_CLOSE] removeAllListeners is not a function:', typeof sessionManager.removeAllListeners);
      }
    } catch (error) {
      console.error('🔍 [WINDOW_CLOSE] ERROR calling removeAllListeners:', error);
    }
    
    win = null;
    log.info("Window closed");
    app.quit();
  });

  const createTempDirectory = () => {
    let tempDir = "";
    if (global.AppConfig.isDev) {
      tempDir = path.join(__dirname, "tmp");
    } else {
      tempDir = path.join(app.getPath("temp"), "statements");
    }

    log.info("TEMP directory:", tempDir);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    } else {
      const failedDir = path.join(tempDir, "failed_pdfs");
      // go into failed directory and delete all the folders which are empty
      fs.readdir(failedDir, (err, files) => {
        if (err) {
          log.error("Error reading temp directory:", err);
          return;
        }
        files.forEach((file) => {
          const filePath = path.join(failedDir, file);
          fs.stat(filePath, (err, stat) => {
            if (err) {
              log.error("Error checking file stats:", err);
              return;
            }
            if (stat.isDirectory()) {
              fs.readdir(filePath, (err, files) => {
                if (err) {
                  log.error("Error reading directory:", err);
                  return;
                }
                if (files.length === 0) {
                  fs.rmdir(filePath, (err) => {
                    if (err) {
                      log.error("Error deleting empty directory:", err);
                      return;
                    }
                    log.info("Empty directory deleted:", filePath);
                  });
                }
              });
            }
          });
        });
      });
    }
    log.info("TEMP directory:", tempDir);
    return tempDir;
  };

  const TMP_DIR = createTempDirectory();

  registerIndividualDashboardIpc();
  registerMainDashboardIpc(TMP_DIR);
  registerCaseDashboardIpc();
  generateReportIpc(TMP_DIR);
  registerOpenFileIpc(global.AppConfig.baseDir, global.AppConfig.userDataDir);
  registerReportHandlers(TMP_DIR);
  registerAuthHandlers(app.getPath("userData"));
  log.info("🔐 Auth handlers registered (including license:check)");
  registerOpportunityToEarnIpc();
  registerTallyIpc();
  registerVoucherIpc();
  getdata();
  registerEditReportHandlers();
  registerExcelDownloadHandlers(app.getPath("downloads"));
  registerAppLevelIPCHandlers(app, win, global.AppConfig.baseDir);

  // Auto-update IPC handlers with detailed logging
  ipcMain.handle("check-for-updates", async () => {
    log.info("Manual update check requested");
    if (global.AppConfig.isDev) {
      const msg = "Skip update check in dev mode";
      log.info(msg);
      return msg;
    }
    try {
      // Use checkForUpdates which respects grace period
      checkForUpdates();
      return { checking: true, message: "Update check started" };
    } catch (err) {
      log.error("Check for updates failed:", err);
      throw err;
    }
  });

  ipcMain.handle("download-update", async () => {
    log.info("Update download requested");
    try {
      // Backup database before update
      const dbPath = path.join(userDataDir, "db.sqlite3");
      const backupDir = path.join(userDataDir, "backups");

      log.info("Creating backup directory:", backupDir);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `db-backup-${timestamp}.sqlite`);

      log.info("Creating database backup:", backupPath);
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        log.info("Database backup created successfully");
      } else {
        log.info("No database found to backup");
      }

      const result = await autoUpdater.downloadUpdate();
      log.info("Update download completed");
      return result;
    } catch (err) {
      log.error("Update download failed:", err);
      throw err;
    }
  });

  ipcMain.handle("install-update", () => {
    log.info(
      "Update installation requested. Quitting app and installing update..."
    );
    if (process.platform === "win32") {
      // For Windows, we want to restart the app after update
      autoUpdater.quitAndInstall(false, true);
    } else {
      // For macOS, let the user choose when to restart
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Add platform-specific update settings
  if (process.platform === "win32") {
    ipcMain.handle("get-update-location", () => {
      const updatePath = path.join(app.getPath("temp"), "cyphersol-updates");
      log.info("Windows update location:", updatePath);
      return updatePath;
    });
  }

  // Handle file saving to temp directory
  ipcMain.handle("save-file-to-temp", async (event, fileBuffer) => {
    try {
      const tempDir = createTempDirectory();
      const fileName = `${uuidv4()}.pdf`;
      const filePath = path.join(tempDir, fileName);

      await fs.promises.writeFile(filePath, Buffer.from(fileBuffer));
      return filePath;
    } catch (error) {
      log.error("Error saving file to temp directory:", error.message);
      throw error;
    }
  });

  // Clean up temp files
  ipcMain.handle("cleanup-temp-files", async () => {
    const tempDir = path.join(app.getPath("temp"), "report-generator");
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      log.error("Error cleaning up temp files:", error);
      throw error;
    }
  });


  // Check for updates after window is ready
  win.webContents.on("did-finish-load", () => {
    if (!global.AppConfig.isDev) {
      // Initial check after 3 seconds
      setTimeout(checkForUpdates, 3000);

      // Check for updates every 4 hours instead of every hour
      setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
    }
  });
}

const isPackaged = app.isPackaged;

// When packaged, resources are unpacked to a different location
const GATEWAY_EXECUTABLE_DIR = isPackaged
  ? process.resourcesPath // Electron's resources dir in packaged mode
  : path.join(__dirname, "./gatewayServer");

console.log("GATEWAY EXECUTABLE DIR:", GATEWAY_EXECUTABLE_DIR);

app.setName("CypherEdge");

// Add this function before app.whenReady()
async function performUserDataMigration() {
  const migrationStartTime = Date.now();

  try {
    log.info("🚀 [USER-DATA-MIGRATION] === STARTING MIGRATION PROCESS ===");
    log.info("[USER-DATA-MIGRATION] SYSTEM CONTEXT", {
      appVersion: app.getVersion(),
      appName: app.getName(),
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      userDataDir: app.getPath("userData"),
      tempDir: app.getPath("temp"),
      processId: process.pid,
      startTime: new Date().toISOString(),
    });

    const migration = new DatabaseMigration();

    // Get initial status
    const initialStatus = migration.getMigrationStatus();
    log.info("[USER-DATA-MIGRATION] INITIAL STATUS", initialStatus);

    // Perform migration
    log.info("[USER-DATA-MIGRATION] CALLING MIGRATION FUNCTION");
    const result = await migration.performMigration();

    const migrationEndTime = Date.now();
    const totalDuration = migrationEndTime - migrationStartTime;

    // Log results based on outcome
    if (result.alreadyCompleted) {
      log.info("✅ [USER-DATA-MIGRATION] ALREADY COMPLETED", {
        totalDurationMs: totalDuration,
      });
    } else if (result.freshInstall) {
      log.info("ℹ️ [USER-DATA-MIGRATION] FRESH INSTALLATION DETECTED", {
        totalDurationMs: totalDuration,
      });
    } else if (result.success) {
      log.info("🎉 [USER-DATA-MIGRATION] MIGRATION SUCCESSFUL!", {
        oldApp: result.oldAppName,
        totalItems: result.totalItems,
        successfulMigrations: result.successfulMigrations,
        failedMigrations: result.failedMigrations,
        preservedOriginal: result.preservedOriginal,
        migrationDurationMs: result.migrationDurationMs,
        totalProcessDurationMs: totalDuration,
      });

      // Log detailed success information
      if (result.successfulMigrations > 0) {
        const migratedFiles = result.migratedItems
          .filter((item) => item.migrationSuccess)
          .map((item) => ({
            name: item.fileName,
            type: item.type,
            description: item.description || "No description",
            size: item.size || "Unknown",
            durationMs: item.migrationDurationMs || "Unknown",
          }));

        log.info("📋 [USER-DATA-MIGRATION] SUCCESSFULLY MIGRATED ITEMS", {
          count: migratedFiles.length,
          items: migratedFiles,
          note: "Original files preserved in old app directory",
        });
      }

      // Log any failures for debugging
      if (result.failedMigrations > 0) {
        const failedFiles = result.migratedItems
          .filter((item) => !item.migrationSuccess)
          .map((item) => ({
            name: item.fileName,
            type: item.type,
            description: item.description || "No description",
          }));

        log.warn("⚠️ [USER-DATA-MIGRATION] FAILED MIGRATIONS", {
          count: failedFiles.length,
          items: failedFiles,
        });
      }
    } else {
      log.error("❌ [USER-DATA-MIGRATION] MIGRATION FAILED", {
        totalItems: result.totalItems || "Unknown",
        successful: result.successfulMigrations || 0,
        failed: result.failedMigrations || "Unknown",
        error: result.error || "Unknown error",
        totalDurationMs: totalDuration,
      });
    }

    // Get final status for comparison
    const finalStatus = migration.getMigrationStatus();
    log.info("[USER-DATA-MIGRATION] FINAL STATUS", finalStatus);

    log.info("🏁 [USER-DATA-MIGRATION] === MIGRATION PROCESS COMPLETED ===", {
      totalDurationMs: totalDuration,
      totalDurationSeconds: (totalDuration / 1000).toFixed(2),
    });

    return result;
  } catch (error) {
    const migrationEndTime = Date.now();
    const totalDuration = migrationEndTime - migrationStartTime;

    log.error("💥 [USER-DATA-MIGRATION] CRITICAL MIGRATION ERROR", {
      error: error.message,
      stack: error.stack,
      totalDurationMs: totalDuration,
      timestamp: new Date().toISOString(),
    });

    // Try to log to a backup location
    try {
      const errorLogPath = path.join(
        app.getPath("temp"),
        "cyphersol-migration-error.log"
      );
      const errorInfo = {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        appVersion: app.getVersion(),
        platform: process.platform,
      };
      fs.writeFileSync(errorLogPath, JSON.stringify(errorInfo, null, 2));
      log.info("[USER-DATA-MIGRATION] Error details saved to:", errorLogPath);
    } catch (backupError) {
      log.error(
        "[USER-DATA-MIGRATION] Failed to save error backup:",
        backupError
      );
    }

    return { success: false, error: error.message, criticalError: true };
  }
}

app.whenReady().then(async () => {
  const appStartTime = Date.now();

  // 🚀 ENHANCED STARTUP LOGGING
  log.info("════════════════════════════════════════════════════════════════");
  log.info("🚀 CYPHEREDGE APPLICATION STARTUP INITIATED");
  log.info("════════════════════════════════════════════════════════════════");
  log.info("📊 STARTUP ENVIRONMENT INFO", {
    userDataDir: userDataDir,
    appVersion: app.getVersion(),
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    processId: process.pid,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    memoryUsage: process.memoryUsage(),
    isElevated:
      process.platform === "win32" ? "Checking..." : "N/A (Non-Windows)",
    workingDirectory: process.cwd(),
    commandLineArgs: process.argv,
  });

  log.info("🔍 [CREATEWINDOW_DEBUG] Main window setup nearly complete - about to register IPC handlers");

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 EMAIL VERIFICATION & AUTO-REPORTING IPC HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  let verifiedEmail = null;
  
  // Store verified email for compatibility reporting
  ipcMain.handle("email-verification:store", async (event, email) => {
    try {
      verifiedEmail = email;
      log.info("🔐 Email stored for compatibility reporting:", email);
      return { success: true };
    } catch (error) {
      log.error("❌ Failed to store verified email:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Start compatibility check after email verification
  ipcMain.handle("email-verification:start-compatibility", async () => {
    try {
      log.info("🔐 Starting compatibility check after email verification");
      
      // Close email verification window and start compatibility check
      if (win && !win.isDestroyed()) {
        win.close();
      }
      
      // Start the compatibility checker
      const { SystemCompatibilityChecker } = require("./SystemCompatibilityChecker");
      const compatChecker = new SystemCompatibilityChecker();
      
      // Run compatibility check (this will create its own window)
      const compatResult = await compatChecker.runFullCheck();
      
      return { success: true, result: compatResult };
    } catch (error) {
      log.error("❌ Failed to start compatibility check:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Auto-report compatibility results to server
  ipcMain.handle("compatibility:auto-report", async (event, compatibilityResult) => {
    try {
      log.info("📊 Auto-reporting compatibility results to server");
      
      const reportData = {
        timestamp: new Date().toISOString(),
        userEmail: verifiedEmail,
        systemInfo: {
          hostname: require('os').hostname(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          appVersion: app.getVersion()
        },
        compatibilityResult: compatibilityResult,
        modeDetection: compatibilityResult.modeDetection || null
      };
      
      // 🔧 DEMO - Replace with real API endpoint
      console.log("📊 [AUTO_REPORT] Report data prepared:", reportData);
      
      /* 
      // 🚀 PRODUCTION - Replace with real server call:
      const response = await fetch('https://api.cyphersol.co.in/compatibility-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });
      
      if (response.ok) {
        log.info("✅ Compatibility report sent to server successfully");
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      */
      
      // Simulate successful report
      await new Promise(resolve => setTimeout(resolve, 1000));
      log.info("✅ Compatibility report sent to server successfully (demo)");
      
      return { success: true, reportData };
    } catch (error) {
      log.error("❌ Failed to send compatibility report:", error);
      return { success: false, error: error.message };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧪 REGISTER APP MODE TESTING IPC HANDLERS (Before System Compatibility Check)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.info("🔍 [CREATEWINDOW_DEBUG] Registering app-mode IPC handlers");
  ipcMain.handle("app-mode:load-config", async () => {
    try {
      const configPath = path.join(__dirname, "compatibility", "config", "appModeConfig.json");
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      log.error("Failed to load app mode config:", error);
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODE NOTIFICATION IPC HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  ipcMain.handle("mode-notification:unscan-acknowledged", async (event) => {
    try {
      log.info("📢 [MODE] UNSCAN mode notification acknowledged by user");
      return { success: true };
    } catch (error) {
      log.error("❌ [MODE] Error handling UNSCAN acknowledgment:", error);
      throw error;
    }
  });

  ipcMain.handle("hybrid-flow:alternative-choice", async (event, hasAlternative) => {
    try {
      log.info("📢 [MODE] HYBRID flow alternative PC choice:", hasAlternative);
      return { success: true, choice: hasAlternative };
    } catch (error) {
      log.error("❌ [MODE] Error handling alternative choice:", error);
      throw error;
    }
  });

  ipcMain.handle("hybrid-flow:payment-choice", async (event, agreedToPay) => {
    try {
      log.info("📢 [MODE] HYBRID flow payment choice:", agreedToPay);
      return { success: true, choice: agreedToPay };
    } catch (error) {
      log.error("❌ [MODE] Error handling payment choice:", error);
      throw error;
    }
  });

  ipcMain.handle("hybrid-flow:close-app", async (event) => {
    try {
      log.info("📢 [MODE] HYBRID flow requested app close");
      app.quit();
      return { success: true };
    } catch (error) {
      log.error("❌ [MODE] Error handling app close:", error);
      throw error;
    }
  });

  ipcMain.handle("app-mode:run-detection", async (event, options = {}) => {
    try {
      log.info("🧪 App mode detection requested from compatibility window", options);
      const { getSharedAppModeManager } = require("./compatibility/SharedAppModeManager");
      const manager = getSharedAppModeManager(log, null);
      
      if (options.scenario && options.scenario !== 'current') {
        // Load test scenario with proper mapping
        const configPath = path.join(__dirname, "compatibility", "config", "appModeConfig.json");
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Map UI scenario names to config scenario names
        const scenarioMapping = {
          'highEnd': 'highEnd',
          'midRange': 'midRange', 
          'lowEnd': 'lowEnd'
        };
        
        const mappedScenario = scenarioMapping[options.scenario] || options.scenario;
        const scenario = config.testing.scenarios[mappedScenario];
        
        if (scenario) {
          // Override test scenario in config
          const originalOverrides = config.testingOverrides;
          config.testingOverrides = {
            ...originalOverrides,
            forceRAM: scenario.ram,
            forceCPU: scenario.cpu,
            forceScanResult: scenario.scanTime !== null ? 'pass' : 'fail',
            forceMode: scenario.expectedMode
          };
          
          // Temporarily save scenario config
          const tempConfigPath = path.join(__dirname, "compatibility", "config", "temp_appModeConfig.json");
          fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
          
          // Debug logging to verify scenario override
          log.info("🧪 DEBUG: Scenario overrides applied", {
            scenario: options.scenario,
            mappedScenario: mappedScenario,
            expectedMode: scenario.expectedMode,
            forceMode: config.testingOverrides.forceMode,
            forceRAM: config.testingOverrides.forceRAM,
            forceCPU: config.testingOverrides.forceCPU,
            developmentMode: config.developmentMode?.enabled
          });
          
          // Run detection with scenario
          const result = await manager.runModeDetection({ scenario: options.scenario });
          
          // Clean up temp config
          if (fs.existsSync(tempConfigPath)) {
            fs.unlinkSync(tempConfigPath);
          }
          
          return result;
        }
      }
      
      // Run with current system/overrides
      if (options.overrides) {
        // Update config with overrides
        const configPath = path.join(__dirname, "compatibility", "config", "appModeConfig.json");
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.testingOverrides = { ...config.testingOverrides, ...options.overrides };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
      
      return await manager.runModeDetection({ scenario: options.scenario || 'current' });
      
    } catch (error) {
      log.error("App mode detection failed:", error);
      throw new Error(`Detection failed: ${error.message}`);
    }
  });

  // 🔍 STEP -1: SYSTEM COMPATIBILITY CHECK (CRITICAL FIRST STEP)
  log.info("📋 INITIALIZATION STEP -1: SYSTEM COMPATIBILITY CHECK");
  
  // Run system compatibility check for both dev and production
  try {
    const { SystemCompatibilityChecker } = require("./SystemCompatibilityChecker");
    const compatStartTime = Date.now();
    
    log.info("🔍 Starting comprehensive system compatibility check...");
    const compatChecker = new SystemCompatibilityChecker();
    const compatResult = await compatChecker.runFullCheck();
    
    const compatEndTime = Date.now();
    const compatDuration = compatEndTime - compatStartTime;
    
    if (!compatResult.canProceed) {
      log.error("❌ CRITICAL: System compatibility check failed", {
        duration: compatDuration,
        issues: compatResult.results.issues.length,
        warnings: compatResult.results.warnings.length,
        canProceed: compatResult.canProceed,
      });
      
      // Show final message and exit gracefully
      log.info("🛑 Application startup terminated due to compatibility issues");
      app.quit();
      return;
    }
    
    log.info("✅ System compatibility check passed", {
      duration: compatDuration,
      successes: compatResult.results.successes.length,
      warnings: compatResult.results.warnings.length,
      issues: compatResult.results.issues.length,
      canProceed: compatResult.canProceed,
    });
    
    // 🔍 DEBUG: Log mode detection result from compatibility check
    if (compatResult.modeDetection) {
      log.info("🎯 [MODE_DEBUG] Mode detection result from compatibility:", {
        determinedMode: compatResult.modeDetection.determinedMode,
        canProceed: compatResult.modeDetection.canProceed,
        confidence: compatResult.modeDetection.confidence,
        userMessage: compatResult.modeDetection.userMessage,
        nextSteps: compatResult.modeDetection.nextSteps
      });
    } else {
      log.warn("⚠️ [MODE_DEBUG] No mode detection result from compatibility check");
    }
    
    if (compatResult.results.warnings.length > 0) {
      log.warn("⚠️ Compatibility warnings detected - proceeding with fallback configuration", {
        warnings: compatResult.results.warnings.map(w => w.test),
      });
    }
    
  } catch (error) {
    log.error("💥 Compatibility check crashed - proceeding with startup anyway", {
      error: error.message,
      stack: error.stack,
    });
    
    // Don't block startup if compatibility checker itself fails
    // This ensures we don't break existing functionality
  }

  // 🎯 STEP 0: CREATE SPLASH SCREEN FIRST
  log.info("📋 INITIALIZATION STEP 0: SPLASH SCREEN CREATION");
  log.info("🔍 [STARTUP_DEBUG] About to create splash screen - checking mode detection status");
  
  try {
    const splashStartTime = Date.now();
    createSplashWindow();
    const splashEndTime = Date.now();
    log.info("✅ Splash screen created successfully", {
      duration: splashEndTime - splashStartTime,
      splashPath: path.join(__dirname, "/react-app/splash.html"),
    });
    log.info("🔍 [STARTUP_DEBUG] Splash screen creation completed - continuing with startup");
  } catch (error) {
    log.error("❌ Splash screen creation failed:", error);
    log.error("🔍 [STARTUP_DEBUG] Splash screen failed, but continuing anyway");
    // Continue anyway - splash is not critical
  }

  try {
    // 🔄 MIGRATE USER DATA FROM OLD APP (Critical first step)
    log.info("📋 INITIALIZATION STEP 1: USER DATA MIGRATION");
    const migrationStartTime = Date.now();
    const migrationResult = await performUserDataMigration();
    const migrationEndTime = Date.now();

    if (migrationResult.criticalError) {
      log.error("💥 CRITICAL MIGRATION ERROR - CONTINUING WITH CAUTION", {
        duration: migrationEndTime - migrationStartTime,
        error: migrationResult,
      });
    } else {
      log.info("✅ User data migration completed", {
        duration: migrationEndTime - migrationStartTime,
        result: migrationResult,
      });
    }

    // 🗄️ Initialize Database AFTER migration (so it uses the migrated data)
    const dbStartTime = Date.now();
    log.info("📋 INITIALIZATION STEP 2: DATABASE INITIALIZATION");
    try {
      const dbManager = databaseManager.getInstance();
      await dbManager.initialize(userDataDir);
      const dbEndTime = Date.now();
      log.info("✅ Database initialized successfully", {
        duration: dbEndTime - dbStartTime,
        databasePath: path.join(userDataDir, "db.sqlite3"),
      });
    } catch (error) {
      log.error("❌ Database initialization failed:", error);
      throw error;
    }

    // 🏁 Check Update Success/Failure Flags
    log.info("📋 CHECKING UPDATE FLAGS");
    const updateFlagPath = path.join(
      app.getPath("userData"),
      "update-success.txt"
    );
    if (fs.existsSync(updateFlagPath)) {
      try {
        const version = fs.readFileSync(updateFlagPath, "utf8");
        fs.unlinkSync(updateFlagPath); // Remove the flag file

        log.info("✅ UPDATE SUCCESS DETECTED", {
          previousVersion: version,
          currentVersion: app.getVersion(),
          updateSuccessful: true,
          restartedAfterUpdate: true,
        });

        // Show success message after app fully loads
        setTimeout(() => {
          dialog.showMessageBox({
            type: "info",
            title: "Update Successful",
            message: `Successfully updated to CypherEdge v${app.getVersion()}`,
            detail:
              "Your application has been updated with the latest features and improvements.",
            buttons: ["OK"],
          });
        }, 3000); // Increased delay to ensure app is fully loaded
      } catch (err) {
        log.error("Error reading update flag:", err);
      }
    } else {
      log.info("No update success flag found - normal startup");
    }

    // Check for update failure flag
    const updateFailurePath = path.join(
      app.getPath("userData"),
      "update-failure.txt"
    );
    if (fs.existsSync(updateFailurePath)) {
      try {
        fs.unlinkSync(updateFailurePath); // Remove the flag file

        // Show failure recovery message
        setTimeout(() => {
          dialog.showMessageBox({
            type: "warning",
            title: "Update Recovery",
            message: "The application recovered from a failed update attempt.",
            detail: "You can try updating again later.",
            buttons: ["OK"],
          });
        }, 2000);
      } catch (err) {
        log.error("Error reading update failure flag:", err);
      }
    }

    // ✅ FIXED: Correct initialization order to prevent license validation race condition
    // 🚨 CRITICAL: Gateway server MUST start BEFORE license validation

    // 1. Start Gateway Server FIRST (needed for license validation)
    log.info("📋 INITIALIZATION STEP 3: GATEWAY SERVER INITIALIZATION");
    try {
      const gatewayStartTime = Date.now();
      log.info(
        "🚀 PHASE 1: Initializing Gateway Server (Required for License Validation)"
      );
      gatewayServer.init(GATEWAY_EXECUTABLE_DIR);
      log.info("✅ Gateway server path configured", {
        executablePath: GATEWAY_EXECUTABLE_DIR,
      });

      // 🔧 ROBUST GATEWAY INITIALIZATION with health checks and fallback
      await gatewayServer.initialize();
      const gatewayEndTime = Date.now();
      log.info("✅ Gateway server initialized and responding on port 7890", {
        duration: gatewayEndTime - gatewayStartTime,
      });
    } catch (error) {
      log.error("❌ GatewayServer initialization failed:", error);
      throw error;
    }

    // 2. Initialize License Manager AFTER Gateway Server is ready
    log.info("📋 INITIALIZATION STEP 4: LICENSE MANAGER INITIALIZATION");
    try {
      const licenseStartTime = Date.now();
      log.info(
        "🚀 PHASE 2: Initializing License Manager (Gateway Server Available)"
      );
      const isLicenseValid = await licenseManager.init(app.getPath("userData"));
      const licenseEndTime = Date.now();
      log.info("✅ License status:", isLicenseValid, {
        duration: licenseEndTime - licenseStartTime,
      });
      log.info("✅ License Info Data:", licenseManager.licenseData);
    } catch (error) {
      log.error("❌ License initialization failed:", error);
      throw error;
    }

    // 3. Initialize Session Manager
    log.info("📋 INITIALIZATION STEP 5: SESSION MANAGER INITIALIZATION");
    try {
      const sessionStartTime = Date.now();
      log.info("🚀 PHASE 3: Initializing Session Manager");
      
      // Verify SessionManager instance and methods
      if (!sessionManager) {
        throw new Error("SessionManager instance not found");
      }
      
      if (typeof sessionManager.init !== 'function') {
        log.warn("⚠️ SessionManager.init method not found, skipping initialization");
        log.info("✅ SessionManager loaded without init (singleton pattern)");
      } else {
        await sessionManager.init();
        log.info("✅ SessionManager initialized successfully");
      }
      
      const sessionEndTime = Date.now();
      log.info("✅ SessionManager phase completed", {
        duration: sessionEndTime - sessionStartTime,
      });
    } catch (error) {
      log.error("❌ SessionManager initialization failed:", error);
      throw error;
    }

    // 4. Initialize System Information (POTENTIAL HANGING POINT - WATCH CLOSELY)
    log.info("📋 INITIALIZATION STEP 6: SYSTEM INFORMATION GATHERING");
    log.info(
      "⚠️  CRITICAL STEP: This is where client machines might hang - monitoring closely..."
    );
    try {
      const systemInfoStartTime = Date.now();
      log.info("🔍 Starting system information collection...");

      await systemInfo.loadData(app.getPath("userData"));

      const systemInfoEndTime = Date.now();
      log.info("✅ SystemInfo loaded successfully", {
        duration: systemInfoEndTime - systemInfoStartTime,
        hostname: systemInfo.getHostname(),
        userSID: systemInfo.getWindowsUserSID(),
        uuid: systemInfo.getUUID() ? "Present" : "Missing",
        macAddress: systemInfo.getMACAddress(),
      });
    } catch (error) {
      log.error("❌ SystemInfo initialization failed:", error);
      throw error;
    }

    // 5. File System Operations
    log.info("📋 INITIALIZATION STEP 7: FILE SYSTEM SETUP");
    try {
      const fileSystemStartTime = Date.now();
      syncTallyprimeFilesToUserData();
      createProtocol();
      const fileSystemEndTime = Date.now();
      log.info("✅ File system operations completed", {
        duration: fileSystemEndTime - fileSystemStartTime,
      });
    } catch (error) {
      log.error("❌ File system setup failed:", error);
      throw error;
    }

    // 6. Main Window Creation
    log.info("📋 INITIALIZATION STEP 8: MAIN WINDOW CREATION");
    log.info("🔍 [STARTUP_DEBUG] About to create main window - checking app state");
    
    try {
      const windowStartTime = Date.now();
      log.info("🔍 [STARTUP_DEBUG] Calling createWindow() function...");
      createWindow();
      const windowEndTime = Date.now();
      log.info("✅ Main window created successfully", {
        duration: windowEndTime - windowStartTime,
      });
      log.info("🔍 [STARTUP_DEBUG] Main window creation completed - should show window soon");
    } catch (error) {
      log.error("❌ Main window creation failed:", error);
      log.error("🔍 [STARTUP_DEBUG] CRITICAL: Main window creation failed - this is likely why no auto-launch");
      throw error;
    }
    
    log.info("🔍 [STARTUP_DEBUG] ✅ ENTIRE STARTUP SEQUENCE COMPLETED SUCCESSFULLY");

    // 7. Window Ready Event Setup
    win.once("ready-to-show", () => {
      log.info("🎯 MAIN WINDOW READY TO SHOW - CLOSING SPLASH");
      if (splashWindow) {
        splashWindow.close();
        log.info("✅ Splash window closed");
      }
      win.show();
      log.info("✅ Main window shown to user");
    });

    // 8. Python Backend Initialization
    log.info("📋 INITIALIZATION STEP 9: PYTHON BACKEND INITIALIZATION");
    try {
      const pythonStartTime = Date.now();
      await startPythonExecutable();
      const pythonEndTime = Date.now();
      log.info("✅ Python backend initialized successfully", {
        duration: pythonEndTime - pythonStartTime,
      });
    } catch (error) {
      log.error("❌ Python initialization failed:", error);
      throw error;
    }

    // 🔍 VERIFY ALL SERVICES ARE RUNNING
    log.info("📋 INITIALIZATION STEP 10: SERVICES VERIFICATION");
    try {
      const verificationStartTime = Date.now();
      await verifyAllServicesRunning();
      const verificationEndTime = Date.now();
      log.info("✅ All services verified as running", {
        duration: verificationEndTime - verificationStartTime,
      });
    } catch (error) {
      log.error("❌ Service verification failed:", error);
      throw error;
    }

    // Calculate total startup time
    const totalStartupTime = Date.now() - appStartTime;
    log.info(
      "════════════════════════════════════════════════════════════════"
    );
    log.info("🎉 APPLICATION STARTUP COMPLETED SUCCESSFULLY");
    log.info(
      "════════════════════════════════════════════════════════════════"
    );
    log.info("📊 STARTUP SUMMARY", {
      totalStartupTime: totalStartupTime,
      totalStartupSeconds: (totalStartupTime / 1000).toFixed(2),
      allServicesRunning: true,
      timestamp: new Date().toISOString(),
    });

    // Initial update check after 1 minute
    if (!global.AppConfig.isDev) {
      setTimeout(() => {
        log.info("🔄 Starting automatic update check");
        checkForUpdates();
      }, 60 * 1000);
    }
  } catch (error) {
    log.error(
      "════════════════════════════════════════════════════════════════"
    );
    log.error("💥 CRITICAL STARTUP FAILURE");
    log.error(
      "════════════════════════════════════════════════════════════════"
    );
    log.error("❌ Failed to initialize App:", error);
    log.error("🔍 Error details:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      totalTimeBeforeFailure: Date.now() - appStartTime,
    });

    // Show error dialog to user before quitting
    if (splashWindow) {
      splashWindow.close();
    }

    dialog.showErrorBox(
      "CypherEdge Startup Error",
      `Failed to start the application:\n\n${error.message}\n\nPlease check the logs for more details.`
    );

    app.quit();
  }
});

app.on("window-all-closed", () => {
  log.info("[DEBUG] window-all-closed event fired");
  log.info("[DEBUG] isUpdating value:", isUpdating);
  log.info("[DEBUG] isPerformingCleanup value:", isPerformingCleanup);
  log.info("[DEBUG] platform:", process.platform);

  if (process.platform !== "darwin") {
    // Don't quit if we're in the middle of an update or cleanup
    if (!isUpdating && !isPerformingCleanup) {
      log.info("[DEBUG] Neither updating nor cleaning up, calling app.quit()");
      app.quit();
    } else {
      log.info(
        "Skipping quit during update/cleanup process - installer will handle it"
      );
    }
  }
});

app.on("will-quit", (event) => {
  log.info("App is quitting");
  log.info("isUpdating flag:", isUpdating);
  
  // Clean up shared AppModeManager instance
  try {
    const { resetSharedAppModeManager } = require("./compatibility/SharedAppModeManager");
    resetSharedAppModeManager();
    log.info("Shared AppModeManager instance cleaned up");
  } catch (error) {
    log.warn("Error cleaning up shared AppModeManager:", error.message);
  }

  // Clean up SessionManager listeners before quit
  try {
    if (sessionManager && typeof sessionManager.removeAllListeners === 'function') {
      sessionManager.removeAllListeners("remainingSecondsUpdated");
      sessionManager.removeAllListeners("licenseExpired");
      log.info("SessionManager listeners cleaned up on quit");
    }
  } catch (err) {
    log.error("Error cleaning up SessionManager listeners on quit:", err);
  }

  if (isUpdating) {
    log.info("Auto install update on quit");
  }

  // Clean logout on quit
  try {
    if (sessionManager && typeof sessionManager.logoutUser === 'function') {
      sessionManager.logoutUser();
    }
  } catch (error) {
    log.error("Error calling sessionManager.logoutUser():", error);
  }
  if (pythonProcess) {
    log.info("Stopping Python process...");
    pythonProcess.kill("SIGTERM");
  }
});

// Compact cleanup function for update process
const stopEverythingNeatly = async () => {
  try {
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "[CLEANUP] Starting aggressive gateway termination..."
    );

    // 1. Stop Gateway Windows Service (try both possible service names)
    if (process.platform === "win32") {
      // Try stopping both services
      const serviceNames = ["LicensingServer"];
      for (const serviceName of serviceNames) {
        // Create a retry function for stopping services
        const stopServiceWithRetry = (
          serviceName,
          maxRetries = 10,
          timeoutMs = 30000
        ) => {
          const startTime = Date.now();
          let attempts = 0;

          while (attempts < maxRetries && Date.now() - startTime < timeoutMs) {
            try {
              attempts++;
              logWithTimestamp(
                "info",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Attempt ${attempts}/${maxRetries}: Stopping service ${serviceName}`
              );

              // First, try to stop the service
              try {
                execSync(`sc stop "${serviceName}"`, { timeout: 5000 });
                logWithTimestamp(
                  "info",
                  UPDATE_LOG_PREFIX,
                  `[CLEANUP] Stop command sent for ${serviceName}`
                );
              } catch (stopError) {
                // Check if service is already stopped or doesn't exist
                if (
                  stopError.message.includes("1062") ||
                  stopError.message.includes("not started") ||
                  stopError.message.includes("1052") ||
                  stopError.message.includes("1060")
                ) {
                  logWithTimestamp(
                    "info",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Service ${serviceName} was already stopped or doesn't exist`
                  );
                  return true;
                }
                // If it's a different error, we'll still try to verify status below
                logWithTimestamp(
                  "warn",
                  UPDATE_LOG_PREFIX,
                  `[CLEANUP] Stop command error for ${serviceName}: ${stopError.message}`
                );
              }

              // Now verify the service has actually stopped using sc query
              let verificationAttempts = 0;
              const maxVerificationAttempts = 5;

              while (verificationAttempts < maxVerificationAttempts) {
                try {
                  verificationAttempts++;
                  const queryResult = execSync(`sc query "${serviceName}"`, {
                    timeout: 3000,
                    encoding: "utf8",
                  });

                  logWithTimestamp(
                    "info",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Verification attempt ${verificationAttempts}: Checking ${serviceName} status`
                  );

                  // Check if service is stopped
                  if (
                    queryResult.includes("STATE") &&
                    (queryResult.includes("STOPPED") ||
                      queryResult.includes("1  STOPPED"))
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] ✅ Service ${serviceName} confirmed STOPPED on attempt ${attempts}`
                    );
                    return true;
                  } else if (
                    queryResult.includes("STOP_PENDING") ||
                    queryResult.includes("3  STOP_PENDING")
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] Service ${serviceName} is stopping... waiting`
                    );
                    // Wait a bit for the service to finish stopping
                    try {
                      execSync(`timeout /t 2 /nobreak > nul 2>&1`, {
                        stdio: "ignore",
                      });
                    } catch (_) {
                      const start = Date.now();
                      while (Date.now() - start < 2000) {
                        // Busy wait 2 seconds
                      }
                    }
                  } else {
                    logWithTimestamp(
                      "warn",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] Service ${serviceName} still running, will retry stop command`
                    );
                    break; // Exit verification loop to retry stop command
                  }
                } catch (queryError) {
                  // Service doesn't exist or query failed
                  if (
                    queryError.message.includes("1060") ||
                    queryError.message.includes("does not exist")
                  ) {
                    logWithTimestamp(
                      "info",
                      UPDATE_LOG_PREFIX,
                      `[CLEANUP] ✅ Service ${serviceName} doesn't exist (already removed)`
                    );
                    return true;
                  }
                  logWithTimestamp(
                    "warn",
                    UPDATE_LOG_PREFIX,
                    `[CLEANUP] Query error for ${serviceName}: ${queryError.message}`
                  );
                  break; // Exit verification loop to retry
                }
              }

              // If we get here, either verification failed or service is still running
              logWithTimestamp(
                "warn",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Service ${serviceName} not confirmed stopped, will retry`
              );

              // Wait before retry (exponential backoff, max 5 seconds)
              const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
              try {
                execSync(
                  `timeout /t ${Math.ceil(
                    waitTime / 1000
                  )} /nobreak > nul 2>&1`,
                  { stdio: "ignore" }
                );
              } catch (_) {
                // Fallback to setTimeout if timeout command fails
                const start = Date.now();
                while (Date.now() - start < waitTime) {
                  // Busy wait
                }
              }
            } catch (error) {
              logWithTimestamp(
                "error",
                UPDATE_LOG_PREFIX,
                `[CLEANUP] Unexpected error on attempt ${attempts} for ${serviceName}: ${error.message}`
              );

              // Wait before retry
              const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
              try {
                execSync(
                  `timeout /t ${Math.ceil(
                    waitTime / 1000
                  )} /nobreak > nul 2>&1`,
                  { stdio: "ignore" }
                );
              } catch (_) {
                const start = Date.now();
                while (Date.now() - start < waitTime) {
                  // Busy wait
                }
              }
            }
          }

          logWithTimestamp(
            "error",
            UPDATE_LOG_PREFIX,
            `[CLEANUP] ❌ Failed to stop and verify service ${serviceName} after ${attempts} attempts and ${
              Date.now() - startTime
            }ms`
          );
          return false;
        };

        try {
          stopServiceWithRetry(serviceName);
        } catch (_) {
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            `[CLEANUP] Service ${serviceName} retry function completed`
          );
        }
      }

      // Wait for services to fully stop
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        "[CLEANUP] Waiting for services to stop..."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Kill gateway processes aggressively
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        "[CLEANUP] Force terminating gateway processes..."
      );

      // Try multiple kill methods
      const killMethods = [
        // Method 1: Kill by exact name
        'taskkill /IM "gatewayService.exe" /F',
        // Method 2: Kill with tree
        'taskkill /IM "gatewayService.exe" /F /T',
        // Method 3: Kill any gateway pattern
        "wmic process where \"name like '%gateway%'\" delete",
        // Method 4: PowerShell force kill
        "powershell -Command \"Get-Process | Where-Object {$_.ProcessName -like '*gateway*'} | Stop-Process -Force\"",
      ];

      for (let i = 0; i < killMethods.length; i++) {
        try {
          logWithTimestamp(
            "info",
            UPDATE_LOG_PREFIX,
            `[CLEANUP] Kill method ${i + 1}: ${killMethods[i].substring(
              0,
              30
            )}...`
          );
          execSync(killMethods[i], { shell: true, windowsHide: true });
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (e) {
          // Continue with next method
        }
      }

      // Final verification
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        execSync('tasklist | find /I "gatewayService.exe"', { shell: true });
        logWithTimestamp(
          "warn",
          UPDATE_LOG_PREFIX,
          "[CLEANUP] Gateway process might still be running"
        );
      } catch (e) {
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "[CLEANUP] Gateway process successfully terminated"
        );
      }
    }

    // 2. Close SQLite
    try {
      const db = databaseManager.getInstance()?.getDatabase();
      if (db) {
        db.close();
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "[CLEANUP] Closed database connection"
        );
      }
    } catch (_) {}

    // 3. Kill Python backend
    if (pythonProcess) {
      pythonProcess.kill("SIGTERM");
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        "[CLEANUP] Terminated Python backend"
      );
    }

    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "[CLEANUP] Gateway termination complete"
    );
  } catch (e) {
    logWithTimestamp(
      "error",
      UPDATE_LOG_PREFIX,
      `[CLEANUP] stopEverythingNeatly error: ${e.message}`
    );
  }
};

// Critical for auto-updater to work!
app.on("before-quit-for-update", async () => {
  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "Before quit for update triggered"
  );
  // Prevent normal quit behavior during update
  isUpdating = true;

  // Run cleanup
  await stopEverythingNeatly();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Add these IPC handlers
ipcMain.handle("start-download", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle("quit-and-install", () => {
  log.info("Manual quit and install requested via IPC");
  autoUpdater.quitAndInstall(false, true);
});

// Modify the update check function
function checkForUpdates() {
  if (global.AppConfig.isDev) {
    log.info("Skipping update check in development mode");
    return;
  }

  // Check if we recently updated (within 15 minutes)
  const updateFlagPath = path.join(
    app.getPath("userData"),
    "update-success.txt"
  );
  const gracePeriodPath = path.join(
    app.getPath("userData"),
    "update-grace-period.json"
  );

  try {
    // Check if update just completed
    if (fs.existsSync(updateFlagPath)) {
      // Create grace period file
      fs.writeFileSync(
        gracePeriodPath,
        JSON.stringify({
          timestamp: Date.now(),
          version: app.getVersion(),
        })
      );
    }

    // Check if we're in grace period
    if (fs.existsSync(gracePeriodPath)) {
      const graceData = JSON.parse(fs.readFileSync(gracePeriodPath, "utf8"));
      const timeSinceUpdate = Date.now() - graceData.timestamp;

      // Skip update check if within 15 minutes of update
      if (timeSinceUpdate < 15 * 60 * 1000) {
        log.info(
          `Skipping update check - in grace period (${Math.round(
            timeSinceUpdate / 1000 / 60
          )} minutes since update)`
        );
        return;
      } else {
        // Grace period expired, remove file
        fs.unlinkSync(gracePeriodPath);
      }
    }
  } catch (err) {
    log.error("Error checking update grace period:", err);
  }

  const currentVersion = app.getVersion();

  // Skip check if we're already on the latest notified version
  if (lastCheckedVersion && lastCheckedVersion === currentVersion) {
    log.info("Already on latest notified version:", currentVersion);
    return;
  }

  log.info("Checking for updates...");
  autoUpdater.checkForUpdates().catch((err) => {
    log.error("Error checking for updates:", err);
    // dialog.showMessageBox({
    //   type: "error",
    //   title: "Update Error",
    //   message: `Error checking for updates: ${err.message}`,
    //   buttons: ["OK"],
    // });
  });
}

// Set up detailed logging for updates
log.transports.file.fileName = "cyphersol.log";

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v2.0.0
// ═══════════════════════════════════════════════════════════════════════════════════════
// Created for: Backend Team Analysis & Software Improvement
// Purpose: Detailed tracking of update process, user behavior, and system performance
// ═══════════════════════════════════════════════════════════════════════════════════════

const UPDATE_LOG_PREFIX = "🔄 [AUTO-UPDATE]";
const PERFORMANCE_LOG_PREFIX = "⚡ [PERFORMANCE]";
const USER_LOG_PREFIX = "👤 [USER-INTERACTION]";
const SYSTEM_LOG_PREFIX = "🖥️ [SYSTEM]";
const ERROR_LOG_PREFIX = "❌ [ERROR]";
const SUCCESS_LOG_PREFIX = "✅ [SUCCESS]";

// Enhanced logging utility functions
const logWithTimestamp = (level, prefix, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${prefix} [${timestamp}] ${message}`;

  if (data) {
    log[level](`${logMessage}`, JSON.stringify(data, null, 2));
  } else {
    log[level](logMessage);
  }

  // Also log to console in development for immediate feedback
  if (global.AppConfig.isDev) {
    console.log(`${prefix} ${message}`, data || "");
  }
};

// Performance tracking utilities
const performanceTracker = {
  timers: new Map(),

  start(operationName) {
    const startTime = Date.now();
    this.timers.set(operationName, startTime);
    logWithTimestamp(
      "info",
      PERFORMANCE_LOG_PREFIX,
      `Started: ${operationName}`
    );
    return startTime;
  },

  end(operationName) {
    const endTime = Date.now();
    const startTime = this.timers.get(operationName);
    if (startTime) {
      const duration = endTime - startTime;
      this.timers.delete(operationName);
      logWithTimestamp(
        "info",
        PERFORMANCE_LOG_PREFIX,
        `Completed: ${operationName} | Duration: ${duration}ms`
      );
      return duration;
    }
    return null;
  },
};

// System information logger
const logSystemInfo = () => {
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    userDataDir: userDataDir,
    isPackaged: app.isPackaged,
    isDevelopment: global.AppConfig.isDev,
    totalMemory: process.getSystemMemoryInfo
      ? process.getSystemMemoryInfo().total
      : "N/A",
    availableMemory: process.getSystemMemoryInfo
      ? process.getSystemMemoryInfo().free
      : "N/A",
  };

  logWithTimestamp(
    "info",
    SYSTEM_LOG_PREFIX,
    "System Information Collected",
    systemInfo
  );
  return systemInfo;
};

// Initialize comprehensive logging
log.info(
  "═══════════════════════════════════════════════════════════════════════════════════════"
);
log.info("🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v2.0.0 INITIALIZED");
log.info(
  "═══════════════════════════════════════════════════════════════════════════════════════"
);
log.info(`📅 Session Start Time: ${new Date().toISOString()}`);
log.info(`🏷️ Application Version: ${app.getVersion()}`);
log.info(`📁 User Data Directory: ${userDataDir}`);
log.info(`🖥️ Platform: ${process.platform} (${process.arch})`);
log.info(`⚡ Node Version: ${process.versions.node}`);
log.info(`🔋 Electron Version: ${process.versions.electron}`);
log.info(
  `🔧 Development Mode: ${global.AppConfig.isDev ? "ENABLED" : "DISABLED"}`
);
log.info(
  "═══════════════════════════════════════════════════════════════════════════════════════"
);

// Log detailed system information
logSystemInfo();

// Add service verification function
async function verifyAllServicesRunning() {
  log.info("🔍 VERIFYING ALL SERVICES STATUS");

  const serviceStatus = {
    database: false,
    gateway: false,
    license: false,
    session: false,
    python: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Check Database
    try {
      const dbManager = databaseManager.getInstance();
      if (dbManager && dbManager.getDatabase()) {
        serviceStatus.database = true;
        log.info("✅ Database service: RUNNING");
      }
    } catch (e) {
      log.error("❌ Database service: FAILED", { error: e.message });
    }

    // Check Gateway Server (port 7890)
    try {
      const isGatewayRunning = await checkPortAvailability(7890);
      serviceStatus.gateway = isGatewayRunning;
      if (isGatewayRunning) {
        log.info("✅ Gateway service: RUNNING (port 7890)");
      } else {
        log.error("❌ Gateway service: NOT RESPONDING (port 7890)");
      }
    } catch (e) {
      log.error("❌ Gateway service: CHECK FAILED", { error: e.message });
    }

    // Check License Manager
    try {
      if (licenseManager && licenseManager.licenseData) {
        serviceStatus.license = true;
        log.info("✅ License service: VALID", {
          hasLicenseData: !!licenseManager.licenseData,
        });
      } else {
        log.error("❌ License service: NO VALID LICENSE");
      }
    } catch (e) {
      log.error("❌ License service: CHECK FAILED", { error: e.message });
    }

    // Check Session Manager
    try {
      if (sessionManager) {
        serviceStatus.session = true;
        log.info("✅ Session service: RUNNING");
      }
    } catch (e) {
      log.error("❌ Session service: CHECK FAILED", { error: e.message });
    }

    // Check Python Backend (port 7500)
    try {
      const isPythonRunning = await checkPortAvailability(7500);
      serviceStatus.python = isPythonRunning;
      if (isPythonRunning) {
        log.info("✅ Python backend: RUNNING (port 7500)");
      } else {
        log.error("❌ Python backend: NOT RESPONDING (port 7500)");
      }
    } catch (e) {
      log.error("❌ Python backend: CHECK FAILED", { error: e.message });
    }

    // Overall service health
    const allServicesRunning = Object.values(serviceStatus).every((status) =>
      typeof status === "boolean" ? status : true
    );

    log.info("🏥 OVERALL SERVICE HEALTH CHECK", {
      ...serviceStatus,
      allServicesHealthy: allServicesRunning,
      healthPercentage: Math.round(
        (Object.values(serviceStatus).filter((s) => s === true).length / 5) *
          100
      ),
    });

    if (!allServicesRunning) {
      log.warn("⚠️ SOME SERVICES ARE NOT RUNNING PROPERLY");

      // Show warning to user if critical services are down
      if (!serviceStatus.database || !serviceStatus.gateway) {
        setTimeout(() => {
          dialog.showMessageBox({
            type: "warning",
            title: "Service Warning",
            message: "Some application services may not be running properly.",
            detail:
              "Please check the logs or restart the application if you experience issues.",
            buttons: ["OK"],
          });
        }, 2000);
      }
    }

    return serviceStatus;
  } catch (error) {
    log.error("💥 SERVICE VERIFICATION FAILED", {
      error: error.message,
      stack: error.stack,
    });
    return serviceStatus;
  }
}

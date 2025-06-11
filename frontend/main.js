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

// Platform specific configurations
if (process.platform === "darwin") {
  autoUpdater.allowDowngrade = true;
} else if (process.platform === "win32") {
  // app.setAppUserModelId('com.electron.electronapp');
  app.setAppUserModelId(process.execPath); // changed it to process.execPath from 'com.electron.electronapp' to fix the taskbar icon not showing issue ~ Aiyaz
  autoUpdater.autoInstallOnAppQuit = true;
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

// Removed redundant settings - configured above

// Configure autoUpdater for GitHub repository
autoUpdater.setFeedURL({
  provider: "github",
  owner: "Shama-Cyphersol",
  repo: "beta_testers_ca",
  token: process.env.GH_TOKEN,
});

// Log token status (without exposing the token)
if (!process.env.GH_TOKEN) {
  log.error("GH_TOKEN is not set! Updates will not work properly.");
} else {
  log.info("GH_TOKEN is configured properly for updates.");
}

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
    const dbPath = path.join(userDataDir, "database.sqlite");
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
async function cleanupForUpdate() {
  performanceTracker.start("cleanup-process");

  logWithTimestamp(
    "info",
    UPDATE_LOG_PREFIX,
    "🧹 COMPREHENSIVE CLEANUP SEQUENCE INITIATED"
  );

  const cleanupSteps = [];

  try {
    // 1. Close database connections first (most important)
    performanceTracker.start("database-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 1/5: Closing database connections"
    );

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
      logWithTimestamp(
        "warn",
        UPDATE_LOG_PREFIX,
        "Database cleanup warning - continuing",
        { error: e.message }
      );
    }

    // 2. Terminate Python backend gracefully, then forcefully if needed
    performanceTracker.start("python-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 2/5: Stopping Python backend"
    );

    if (pythonProcess && !pythonProcess.killed) {
      try {
        // Try graceful shutdown first
        pythonProcess.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // If still running, force kill
        if (!pythonProcess.killed) {
          pythonProcess.kill("SIGKILL");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Force kill any remaining Python processes on Windows
        if (process.platform === "win32") {
          try {
            execSync("taskkill /F /IM main.exe /T", { timeout: 3000 });
            logWithTimestamp("info", UPDATE_LOG_PREFIX, "Force killed Python processes");
          } catch (e) {
            // Process might not exist
          }
        }

        cleanupSteps.push({
          step: "Python Process Cleanup",
          status: "SUCCESS",
          timing: performanceTracker.end("python-cleanup"),
        });
      } catch (e) {
        performanceTracker.end("python-cleanup");
        logWithTimestamp(
          "warn",
          UPDATE_LOG_PREFIX,
          "Python cleanup warning - continuing"
        );
      }
    } else {
      performanceTracker.end("python-cleanup");
      logWithTimestamp("info", UPDATE_LOG_PREFIX, "Python process not running");
    }

    // 3. Stop Gateway Service (Windows only)
    if (process.platform === "win32") {
      performanceTracker.start("gateway-cleanup");
      logWithTimestamp(
        "info",
        UPDATE_LOG_PREFIX,
        "Step 3/5: Stopping Gateway Service"
      );

      try {
        // Stop the Windows service
        execSync("sc stop LicensingServer", { timeout: 5000 });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Force kill any remaining gateway processes
        try {
          execSync("taskkill /F /IM gatewayService.exe /T", { timeout: 3000 });
          logWithTimestamp("info", UPDATE_LOG_PREFIX, "Force killed Gateway processes");
        } catch (e) {
          // Process might not exist
        }

        cleanupSteps.push({
          step: "Gateway Service Stop",
          status: "SUCCESS",
          timing: performanceTracker.end("gateway-cleanup"),
        });
      } catch (e) {
        performanceTracker.end("gateway-cleanup");
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Gateway service stop attempted - continuing"
        );
      }
    }

    // 4. Close non-essential windows
    performanceTracker.start("window-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 4/5: Closing application windows"
    );

    const openWindows = BrowserWindow.getAllWindows();
    let windowsClosedCount = 0;

    openWindows.forEach((window) => {
      if (!window.isDestroyed() && !window.isInstallationWindow) {
        try {
          window.removeAllListeners("close");
          window.close();
          windowsClosedCount++;
        } catch (e) {
          // Window might already be closing
        }
      }
    });

    cleanupSteps.push({
      step: "Window Cleanup",
      status: "SUCCESS",
      windowsClosed: windowsClosedCount,
      timing: performanceTracker.end("window-cleanup"),
    });

    // 5. Final system cleanup wait
    performanceTracker.start("final-cleanup");
    logWithTimestamp(
      "info",
      UPDATE_LOG_PREFIX,
      "Step 5/5: Final system cleanup"
    );

    // Give system time to clean up file handles and processes
    await new Promise((resolve) => setTimeout(resolve, 3000));

    cleanupSteps.push({
      step: "Final System Cleanup",
      status: "SUCCESS",
      timing: performanceTracker.end("final-cleanup"),
    });

    const totalCleanupTime = performanceTracker.end("cleanup-process");

    logWithTimestamp(
      "info",
      SUCCESS_LOG_PREFIX,
      "🧹 COMPREHENSIVE CLEANUP COMPLETED!",
      {
        totalSteps: cleanupSteps.length,
        totalTime: totalCleanupTime,
        summary: "All services stopped, system ready for update",
        details: cleanupSteps,
      }
    );

    return true;
  } catch (error) {
    performanceTracker.end("cleanup-process");
    logWithTimestamp(
      "error",
      ERROR_LOG_PREFIX,
      "Cleanup error - continuing with update",
      { error: error.message }
    );
    // Don't throw - we want to continue with the update even if cleanup partially fails
    return false;
  }
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

  // Clear taskbar progress
  win?.setProgressBar(-1);

  // Send notification to frontend
  win?.webContents.send("update-status", {
    status: "ready-to-install",
    version: info.version,
    message: "Update ready to install",
    timestamp: new Date().toISOString(),
  });

  // Show update dialog with simple options
  const dialogOptions = {
    type: "info",
    title: "Update Ready",
    message: `Version ${info.version} is ready to install`,
    detail: "The application will restart to apply the update. Save any work before continuing.",
    buttons: ["Install Now", "Install on Exit"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };

  dialog
    .showMessageBox(win, dialogOptions)
    .then(async (response) => {
      performanceTracker.end("user-interaction-flow");

      if (response.response === 0) {
        // User clicked "Install Now"
        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "🚀 USER SELECTED: INSTALL NOW"
        );

        // Set flags
        isUpdating = true;

        // Create a professional installation window
        const installingWindow = new BrowserWindow({
          width: 450,
          height: 200,
          frame: false,
          resizable: false,
          center: true,
          alwaysOnTop: true,
          skipTaskbar: false, // Show in taskbar so user knows something is happening
          backgroundColor: '#1e1e1e',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Mark as installation window
        installingWindow.isInstallationWindow = true;

        // Professional installation HTML with progress steps
        const installHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Installing CypherEdge Update</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 40px 30px;
                background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
                color: #ffffff;
                text-align: center;
                user-select: none;
                display: flex;
                flex-direction: column;
                justify-content: center;
                height: 100vh;
                box-sizing: border-box;
                overflow: hidden;
              }
              .logo {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 20px;
                color: #4CAF50;
              }
              h2 {
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: 500;
                color: #ffffff;
              }
              .version {
                font-size: 14px;
                color: #888;
                margin-bottom: 25px;
              }
              .progress-container {
                width: 100%;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                margin: 20px 0;
                overflow: hidden;
              }
              .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                border-radius: 2px;
                animation: progress 3s ease-in-out infinite;
                width: 0%;
              }
              @keyframes progress {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 100%; }
              }
              .spinner {
                width: 32px;
                height: 32px;
                border: 3px solid rgba(255,255,255,0.1);
                border-top: 3px solid #4CAF50;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .status {
                font-size: 13px;
                color: #aaa;
                margin-top: 15px;
                line-height: 1.4;
              }
              .warning {
                font-size: 12px;
                color: #ff9800;
                margin-top: 20px;
                padding: 10px;
                background: rgba(255, 152, 0, 0.1);
                border-radius: 4px;
                border-left: 3px solid #ff9800;
              }
            </style>
          </head>
          <body>
            <div class="logo">CypherEdge</div>
            <div class="spinner"></div>
            <h2>Installing Update</h2>
            <div class="version">Version ${info.version}</div>
            <div class="progress-container">
              <div class="progress-bar"></div>
            </div>
            <div class="status">
              Stopping services and preparing installation...<br>
              This may take a few moments.
            </div>
            <div class="warning">
              ⚠️ Please do not close this window or shut down your computer
            </div>
          </body>
        </html>`;

        await installingWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(installHtml)}`
        );

        installingWindow.show();

        // Prevent window from being closed during update
        installingWindow.on('close', (e) => {
          if (isUpdating) {
            e.preventDefault();
            // Show a warning if user tries to close
            dialog.showMessageBox(installingWindow, {
              type: 'warning',
              title: 'Update in Progress',
              message: 'Please wait for the update to complete.',
              detail: 'Closing this window may corrupt the installation.',
              buttons: ['OK']
            });
          }
        });

        // Update window content during different phases
        const updateStatus = (message) => {
          const script = `
            document.querySelector('.status').innerHTML = '${message}';
          `;
          installingWindow.webContents.executeJavaScript(script).catch(() => { });
        };

        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Professional installation window displayed"
        );

        // Clean logout
        sessionManager.logoutUser();
        updateStatus("Logging out user session...");

        // Perform cleanup
        updateStatus("Stopping services (Database, Python, Gateway)...<br>This ensures a clean installation.");
        await cleanupForUpdate();

        // Small delay to ensure everything is ready
        updateStatus("Finalizing preparation...<br>Almost ready to install!");
        setTimeout(() => {
          try {
            updateStatus("Installing CypherEdge ${info.version}...<br>The application will restart automatically.");

            logWithTimestamp(
              "info",
              UPDATE_LOG_PREFIX,
              "🚀 EXECUTING QUIT AND INSTALL"
            );

            // Create success flag for next startup
            const updateFlagPath = path.join(
              app.getPath("userData"),
              "update-success.txt"
            );
            try {
              fs.writeFileSync(updateFlagPath, info.version);
              logWithTimestamp(
                "info",
                UPDATE_LOG_PREFIX,
                `Update success flag created: ${updateFlagPath}`
              );
            } catch (flagError) {
              logWithTimestamp(
                "warn",
                UPDATE_LOG_PREFIX,
                "Could not create update success flag",
                { error: flagError.message }
              );
            }

            // Force the installation window to stay open
            installingWindow.setClosable(false);

            // Quit and install with restart - proper parameters for Windows
            if (process.platform === "win32") {
              // Windows: silent install with restart
              autoUpdater.quitAndInstall(true, true);
            } else {
              // macOS/Linux: let user restart manually
              autoUpdater.quitAndInstall(false, true);
            }
          } catch (err) {
            logWithTimestamp(
              "error",
              ERROR_LOG_PREFIX,
              "Installation error",
              { error: err.message }
            );

            // Update the installation window to show error
            updateStatus(`❌ Installation failed: ${err.message}<br>Please try again later or contact support.`);

            // Create failure flag for next startup
            try {
              const failureFlagPath = path.join(
                app.getPath("userData"),
                "update-failure.txt"
              );
              fs.writeFileSync(failureFlagPath, err.message);
            } catch (flagError) {
              logWithTimestamp("warn", UPDATE_LOG_PREFIX, "Could not create failure flag");
            }

            // Show error dialog after a delay
            setTimeout(() => {
              dialog.showMessageBox(installingWindow, {
                type: 'error',
                title: 'Update Failed',
                message: 'The update installation failed.',
                detail: 'The application will continue running with the current version. You can try updating again later.',
                buttons: ['OK']
              }).then(() => {
                isUpdating = false;
                installingWindow.close();
              });
            }, 2000);
          }
        }, 1000); // Increased delay to 1 second for better UX
      } else {
        // User clicked "Install on Exit"
        logWithTimestamp(
          "info",
          USER_LOG_PREFIX,
          "📅 USER SELECTED: INSTALL ON EXIT"
        );

        // This will install the update when the app is closed normally
        autoUpdater.autoInstallOnAppQuit = true;

        logWithTimestamp(
          "info",
          UPDATE_LOG_PREFIX,
          "Update will be installed when application exits"
        );
      }
    })
    .catch((error) => {
      performanceTracker.end("user-interaction-flow");
      logWithTimestamp(
        "error",
        ERROR_LOG_PREFIX,
        "Error showing update dialog",
        { error: error.message }
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
  splashWindow.loadFile(splashPath);

  splashWindow.once("ready-to-show", () => {
    log.info("Splashscreen ready to show");
    splashWindow.show();
  });

  splashWindow.on("closed", () => {
    log.info("Splashscreen closed");
    splashWindow = null;
  });
}

// Add this helper anywhere above createWindow():
function setupEventListeners(win) {
  // Listen for remaining seconds updates
  sessionManager.on("remainingSecondsUpdated", (seconds) => {
    // console.log(`Remaining seconds: ${seconds}`);
    if (win && !win.isDestroyed()) {
      win.webContents.send("remainingSecondsUpdated", seconds);
    }
  });

  // Listen for license expiration
  sessionManager.on("licenseExpired", () => {
    log.info("License expired");
    // Optionally handle the license expiration, e.g., show a dialog or quit the app
    sessionManager.logoutUser();

    if (win && !win.isDestroyed()) {
      win.webContents.send("navigateToLogin");
    }

    // win?.destroy();
  });
}

async function createWindow() {
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

  win.on("close", (event) => {
    log.info("Close event triggered");

    // Skip confirmation if we're updating
    if (isUpdating) {
      log.info("Skipping close confirmation for update installation");
      sessionManager.logoutUser();
      return;
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
    } else {
      log.info("User canceled app close.");
      event.preventDefault();
    }
  });
  // setTimeout(() => {
  //   log.info("Closing window after 5 seconds");
  //   log.info("window dsetroyed");
  //   if (win) win.destroy()
  // }, 5000)

  win.on("closed", () => {
    sessionManager.stopLicenseCountdown();
    sessionManager.removeAllListeners();
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
      const result = await autoUpdater.checkForUpdates();
      log.info("Check for updates result:", result);
      return result;
    } catch (err) {
      log.error("Check for updates failed:", err);
      throw err;
    }
  });

  ipcMain.handle("download-update", async () => {
    log.info("Update download requested");
    try {
      // Backup database before update
      const dbPath = path.join(userDataDir, "database.sqlite");
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
      autoUpdater.quitAndInstall(true, true);
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

  log.info("🚀 APP READY - STARTING INITIALIZATION SEQUENCE", {
    userDataDir: userDataDir,
    appVersion: app.getVersion(),
    timestamp: new Date().toISOString(),
    startupTime: appStartTime,
    platform: process.platform,
    isPackaged: app.isPackaged,
  });

  createSplashWindow();

  try {
    // 🔄 MIGRATE USER DATA FROM OLD APP (Critical first step)
    const migrationStartTime = Date.now();
    log.info("📋 INITIALIZATION STEP 1: USER DATA MIGRATION");
    const migrationResult = await performUserDataMigration();
    const migrationEndTime = Date.now();

    log.info("Migration completed", {
      duration: migrationEndTime - migrationStartTime,
      success: !migrationResult.criticalError,
    });

    if (migrationResult.criticalError) {
      log.error("💥 CRITICAL MIGRATION ERROR - CONTINUING WITH CAUTION");
      // Continue with app initialization even if migration fails
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
      });
    } catch (error) {
      log.error("❌ Database initialization failed:", error);
      throw error;
    }

    // 🏁 Check Update Success/Failure Flags
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
            detail: "Your application has been updated with the latest features and improvements.",
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
    try {
      log.info(
        "🚀 PHASE 1: Initializing Gateway Server (Required for License Validation)"
      );
      gatewayServer.init(GATEWAY_EXECUTABLE_DIR);
      log.info("✅ Gateway server path configured");

      // 🔧 ROBUST GATEWAY INITIALIZATION with health checks and fallback
      await gatewayServer.initialize();
      log.info("✅ Gateway server initialized and responding on port 7890");
    } catch (error) {
      log.error("❌ GatewayServer initialization failed:", error);
      throw error;
    }

    // 2. Initialize License Manager AFTER Gateway Server is ready
    try {
      log.info(
        "🚀 PHASE 2: Initializing License Manager (Gateway Server Available)"
      );
      const isLicenseValid = await licenseManager.init(app.getPath("userData"));
      log.info("✅ License status:", isLicenseValid);
      log.info("✅ License Info Data:", licenseManager.licenseData);
    } catch (error) {
      log.error("❌ License initialization failed:", error);
      throw error;
    }

    // 3. Initialize Session Manager
    try {
      log.info("🚀 PHASE 3: Initializing Session Manager");
      await sessionManager.init();
      log.info("✅ SessionManager initialized successfully");
    } catch (error) {
      log.error("❌ SessionManager initialization failed:", error);
      throw error;
    }

    try {
      await systemInfo.loadData(app.getPath("userData"));
      log.info("SystemInfo loaded successfully");
      log.info(
        "SystemInfo data:",
        systemInfo.getHostname(),
        systemInfo.getWindowsUserSID()
      );
    } catch (error) {
      log.error("SystemInfo initialization failed:", error);
      throw error;
    }

    createProtocol();
    createWindow();

    win.once("ready-to-show", () => {
      splashWindow?.close();
      win.show();
    });

    try {
      await startPythonExecutable();
    } catch (error) {
      log.error("Python initialization failed:", error);
      throw error;
    }

    // 🔍 VERIFY ALL SERVICES ARE RUNNING
    await verifyAllServicesRunning();

    // Calculate total startup time
    const totalStartupTime = Date.now() - appStartTime;
    log.info("🎉 APPLICATION STARTUP COMPLETED SUCCESSFULLY", {
      totalStartupTime: totalStartupTime,
      totalStartupSeconds: (totalStartupTime / 1000).toFixed(2),
      allServicesRunning: true,
    });

    // Initial update check after 1 minute
    if (!global.AppConfig.isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          log.error("Error in initial update check:", err);
        });
      }, 60 * 1000);
    }
  } catch (error) {
    log.error("Failed to initialize App:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  log.info("App is quitting");
  sessionManager.logoutUser();
  if (pythonProcess) {
    log.info("Stopping Python process...");
    pythonProcess.kill("SIGTERM");
  }
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
  autoUpdater.quitAndInstall(true, true);
});

// Modify the update check function
function checkForUpdates() {
  if (global.AppConfig.isDev) {
    log.info("Skipping update check in development mode");
    return;
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
log.transports.file.fileName = "cypheredge.log";

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
log.info("🚀 CYPHEREDGE AUTO-UPDATE LOGGING SYSTEM v2.0.0 INITIALIZED");
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
    const allServicesRunning = Object.values(serviceStatus).every(status =>
      typeof status === 'boolean' ? status : true
    );

    log.info("🏥 OVERALL SERVICE HEALTH CHECK", {
      ...serviceStatus,
      allServicesHealthy: allServicesRunning,
      healthPercentage: Math.round(
        (Object.values(serviceStatus).filter(s => s === true).length / 5) * 100
      ),
    });

    if (!allServicesRunning) {
      log.warn("⚠️ SOME SERVICES ARE NOT RUNNING PROPERLY");

      // Show warning to user if critical services are down
      if (!serviceStatus.database || !serviceStatus.gateway) {
        setTimeout(() => {
          dialog.showMessageBox({
            type: 'warning',
            title: 'Service Warning',
            message: 'Some application services may not be running properly.',
            detail: 'Please check the logs or restart the application if you experience issues.',
            buttons: ['OK']
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

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
log.transports.file.fileName = 'cyphersol.log';
log.info('===========================================');
log.info(`Application starting - Version ${app.getVersion()}`);
log.info(`User data directory: ${userDataDir}`);
log.info(`Platform: ${process.platform}`);
log.info(`Arch: ${process.arch}`);
log.info(`Node version: ${process.versions.node}`);
log.info(`Electron version: ${process.versions.electron}`);
log.info('===========================================');

// Configure autoUpdater logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Configure autoUpdater for seamless background updates
autoUpdater.autoDownload = true;  // Enable automatic background downloads
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
  repo: "ca-offline-suite",
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
  performanceTracker.start('update-check');
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update check initiated');
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Checking GitHub repository for new releases');
  
  const updateCheckData = {
    currentVersion: app.getVersion(),
    checkTime: new Date().toISOString(),
    platform: process.platform,
    feedUrl: autoUpdater.getFeedURL(),
    autoDownloadEnabled: autoUpdater.autoDownload
  };
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update check configuration', updateCheckData);
  
  win?.webContents.send("update-status", "checking");
});

autoUpdater.on("update-available", (info) => {
  performanceTracker.end('update-check');
  performanceTracker.start('update-download-process');
  
  // Skip if we've already notified about this version
  if (lastCheckedVersion === info.version) {
    logWithTimestamp('warn', UPDATE_LOG_PREFIX, `Skipping duplicate update notification for version: ${info.version}`);
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update process terminated - duplicate version detected');
    return;
  }

  const updateAvailableData = {
    currentVersion: app.getVersion(),
    newVersion: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes ? info.releaseNotes.substring(0, 200) + '...' : 'No release notes',
    downloadUrl: info.files?.[0]?.url || 'URL not available',
    fileSize: info.files?.[0]?.size || 'Size unknown',
    detectionTime: new Date().toISOString(),
    isAutoDownloadEnabled: autoUpdater.autoDownload
  };

  logWithTimestamp('info', UPDATE_LOG_PREFIX, '🎉 UPDATE AVAILABLE DETECTED!', updateAvailableData);
  logWithTimestamp('info', UPDATE_LOG_PREFIX, `Version upgrade path: ${app.getVersion()} → ${info.version}`);
  
  lastCheckedVersion = info.version;

  // Log seamless download strategy
  logWithTimestamp('info', UPDATE_LOG_PREFIX, '🚀 SEAMLESS UPDATE STRATEGY ACTIVATED');
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'No user prompts - initiating silent background download');
  
  // Send notification to frontend about background download starting
  const frontendNotification = {
    status: "downloading-background", 
    version: info.version,
    message: "Update downloading in background...",
    timestamp: new Date().toISOString()
  };
  
  logWithTimestamp('info', USER_LOG_PREFIX, 'Frontend notification sent', frontendNotification);
  win?.webContents.send("update-status", frontendNotification);
  
  // Create database backup silently in background
  performanceTracker.start('database-backup');
  
  try {
        const dbPath = path.join(userDataDir, "database.sqlite");
        const backupDir = path.join(userDataDir, "backups");
    
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Starting pre-update database backup');
        
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
      logWithTimestamp('info', UPDATE_LOG_PREFIX, `Created backup directory: ${backupDir}`);
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
        success: true
      };
      
      performanceTracker.end('database-backup');
      logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Database backup completed successfully', backupData);
    } else {
      logWithTimestamp('warn', UPDATE_LOG_PREFIX, 'Database file not found - skipping backup');
    }
  } catch (error) {
    performanceTracker.end('database-backup');
    const backupError = {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    logWithTimestamp('error', ERROR_LOG_PREFIX, 'Database backup failed - continuing update', backupError);
  }
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Automatic download will commence (autoDownload=true)');
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'No manual download trigger required');
});

autoUpdater.on("update-not-available", (info) => {
  performanceTracker.end('update-check');
  
  const noUpdateData = {
    currentVersion: app.getVersion(),
    latestVersion: info?.version || 'Unknown',
    checkTime: new Date().toISOString(),
    platform: process.platform,
    isUpToDate: true
  };
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'No updates available - application is up to date', noUpdateData);
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update check completed successfully');
  
  win?.webContents.send("update-status", "not-available");
});

autoUpdater.on("download-progress", (progress) => {
  // Track download performance and provide detailed progress logging
  const downloadData = {
    percent: Math.round(progress.percent * 100) / 100,
    transferred: progress.transferred,
    total: progress.total,
    speed: progress.bytesPerSecond || 0,
    timeRemaining: progress.total && progress.bytesPerSecond ? 
      Math.round((progress.total - progress.transferred) / progress.bytesPerSecond) : 'Unknown',
    timestamp: new Date().toISOString()
  };
  
  // Log every 10% to avoid spam but provide detailed progress tracking
  if (Math.floor(progress.percent) % 10 === 0 && Math.floor(progress.percent) !== Math.floor(progress.percent - 1)) {
    logWithTimestamp('info', UPDATE_LOG_PREFIX, `📥 Download Progress: ${Math.round(progress.percent)}%`, downloadData);
    
    // Calculate and log download speed
    const speedMBps = progress.bytesPerSecond ? (progress.bytesPerSecond / 1024 / 1024).toFixed(2) : 'Unknown';
    logWithTimestamp('info', PERFORMANCE_LOG_PREFIX, `Download speed: ${speedMBps} MB/s`);
  }
  
  // Send detailed progress to frontend for optional subtle indicator
  const frontendProgress = {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    speed: progress.bytesPerSecond,
    timestamp: new Date().toISOString()
  };
  
  win?.webContents.send("update-download-progress", frontendProgress);
  
  // Very subtle progress in taskbar (user barely notices)
  win?.setProgressBar(progress.percent / 100, { mode: 'normal' });
  
  // Log completion
  if (progress.percent >= 100) {
    performanceTracker.end('update-download-process');
    logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Update download completed successfully!', {
      totalSize: progress.total,
      finalPercent: progress.percent,
      completionTime: new Date().toISOString()
    });
  }
});

// Add flag for tracking update status
let isUpdating = false;

// Cleanup function to ensure all processes are stopped before update
async function cleanupForUpdate() {
  performanceTracker.start('cleanup-process');
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, '🧹 ADMIN-LEVEL CLEANUP SEQUENCE INITIATED');
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Using administrator privileges for clean process termination');
  
  const cleanupSteps = [];
  
  try {
    // 1. Stop the Gateway Windows Service with admin privileges
    if (process.platform === 'win32') {
      performanceTracker.start('gateway-service-stop');
      logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 1/6: Stopping Gateway Windows Service (Admin Mode)');
      
      try {
        execSync('sc stop LicensingServer', { timeout: 5000 });
        logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Gateway service stopped successfully with admin privileges');
        cleanupSteps.push({ step: 'Gateway Service Stop', status: 'SUCCESS', timing: performanceTracker.end('gateway-service-stop') });
      } catch (e) {
        performanceTracker.end('gateway-service-stop');
        logWithTimestamp('warn', UPDATE_LOG_PREFIX, 'Gateway service already stopped or not running');
        cleanupSteps.push({ step: 'Gateway Service Stop', status: 'ALREADY_STOPPED' });
      }
      
      // Short wait for service to stop
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 2. Close database connections
    performanceTracker.start('database-cleanup');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 2/6: Closing database connections');
    
    try {
      const dbManager = databaseManager.getInstance();
      if (dbManager && dbManager.getDatabase()) {
        const db = dbManager.getDatabase();
        if (db && db.close) {
          db.close();
          logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Database connection closed successfully');
        }
      }
      cleanupSteps.push({ step: 'Database Cleanup', status: 'SUCCESS', timing: performanceTracker.end('database-cleanup') });
    } catch (e) {
      performanceTracker.end('database-cleanup');
      cleanupSteps.push({ step: 'Database Cleanup', status: 'ERROR', error: e.message });
    }
    
    // 3. Terminate Python backend with admin privileges
    performanceTracker.start('python-process-cleanup');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 3/6: Terminating Python backend (Admin Mode)');
    
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
      }
      }
      
    // Force kill any remaining Python processes with admin privileges
      if (process.platform === 'win32') {
        try {
          execSync('taskkill /F /IM main.exe', { timeout: 3000 });
        logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Python processes terminated with admin privileges');
        } catch (e) {
        // Process might not exist - not an error
      }
    }
    
    cleanupSteps.push({ step: 'Python Process Cleanup', status: 'SUCCESS', timing: performanceTracker.end('python-process-cleanup') });
    
    // 4. Terminate Gateway executable with admin privileges
    performanceTracker.start('gateway-exe-cleanup');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 4/6: Terminating Gateway executable (Admin Mode)');
    
    if (process.platform === 'win32') {
      try {
        execSync('taskkill /F /IM gatewayService.exe', { timeout: 3000 });
        logWithTimestamp('info', SUCCESS_LOG_PREFIX, 'Gateway executable terminated with admin privileges');
        cleanupSteps.push({ step: 'Gateway Executable Cleanup', status: 'SUCCESS', timing: performanceTracker.end('gateway-exe-cleanup') });
      } catch (e) {
        performanceTracker.end('gateway-exe-cleanup');
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Gateway executable already terminated');
        cleanupSteps.push({ step: 'Gateway Executable Cleanup', status: 'ALREADY_TERMINATED' });
      }
    }
    
    // 5. Close main application windows (preserve installation window)
    performanceTracker.start('window-cleanup');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 5/6: Closing application windows');
    
    const openWindows = BrowserWindow.getAllWindows();
    let windowsClosedCount = 0;
    let installationWindowsFound = 0;
    
    openWindows.forEach((win, index) => {
      if (!win.isDestroyed()) {
        const isInstallationWindow = win.isInstallationWindow === true;
        
        if (isInstallationWindow) {
          installationWindowsFound++;
          logWithTimestamp('info', UPDATE_LOG_PREFIX, `Preserving installation window ${index + 1}`);
        } else {
        win.removeAllListeners('close');
          win.close();
          windowsClosedCount++;
        }
      }
    });
    
    logWithTimestamp('info', SUCCESS_LOG_PREFIX, `Closed ${windowsClosedCount} windows, preserved ${installationWindowsFound} installation windows`);
    cleanupSteps.push({ 
      step: 'Window Cleanup', 
      status: 'SUCCESS', 
      windowsClosed: windowsClosedCount,
      installationWindowsPreserved: installationWindowsFound,
      timing: performanceTracker.end('window-cleanup')
    });
    
    // 6. Final settlement wait
    performanceTracker.start('final-wait');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Step 6/6: Final process settlement (3 seconds)');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Admin privileges ensure clean termination - minimal wait required');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    cleanupSteps.push({ step: 'Final Settlement Wait', status: 'COMPLETED', timing: performanceTracker.end('final-wait') });
    
    const totalCleanupTime = performanceTracker.end('cleanup-process');
    
    // Admin-level cleanup summary
    const cleanupSummary = {
      totalSteps: cleanupSteps.length,
      successfulSteps: cleanupSteps.filter(s => s.status === 'SUCCESS').length,
      adminPrivileges: true,
      totalCleanupTime: totalCleanupTime,
      completionTime: new Date().toISOString(),
      stepDetails: cleanupSteps
    };
    
    logWithTimestamp('info', SUCCESS_LOG_PREFIX, '🧹 ADMIN-LEVEL CLEANUP COMPLETED SUCCESSFULLY!', cleanupSummary);
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'All processes terminated cleanly with administrator privileges');
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'System ready for seamless update installation');
    
  } catch (error) {
    performanceTracker.end('cleanup-process');
    
    const criticalError = {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      adminPrivileges: true
    };
    
    logWithTimestamp('error', ERROR_LOG_PREFIX, '💥 CRITICAL ERROR IN ADMIN-LEVEL CLEANUP', criticalError);
    logWithTimestamp('warn', UPDATE_LOG_PREFIX, 'Continuing with update installation despite cleanup errors');
  }
}

autoUpdater.on("update-downloaded", (info) => {
  performanceTracker.start('user-interaction-flow');
  
  const downloadCompletedData = {
    newVersion: info.version,
    currentVersion: app.getVersion(),
    downloadedAt: new Date().toISOString(),
    fileSize: info.files?.[0]?.size || 'Unknown',
    releaseNotes: info.releaseNotes ? info.releaseNotes.substring(0, 100) + '...' : 'No release notes',
    platform: process.platform
  };
  
  logWithTimestamp('info', SUCCESS_LOG_PREFIX, '🎉 UPDATE DOWNLOAD COMPLETED SUCCESSFULLY!', downloadCompletedData);
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Clearing taskbar progress indicator');
  
  win?.setProgressBar(-1); // Clear taskbar progress
  
  // Log the seamless strategy transition
  logWithTimestamp('info', UPDATE_LOG_PREFIX, '🎯 TRANSITIONING TO USER INTERACTION PHASE');
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'This is the ONLY user interaction in the seamless update process');
  
  // Send notification to frontend first (for any UI updates)
  const frontendUpdateStatus = {
    status: "ready-to-install", 
    version: info.version,
    message: "Update ready to install",
    timestamp: new Date().toISOString()
  };
  
  logWithTimestamp('info', USER_LOG_PREFIX, 'Sending ready-to-install status to frontend', frontendUpdateStatus);
  win?.webContents.send("update-status", frontendUpdateStatus);
  
  // Show user-friendly notification AFTER download is complete
  const dialogOptions = {
      type: "info",
    title: "Update Ready to Install",
    message: `🎉 New version ${info.version} has been downloaded!`,
    detail: "The update is ready to install. Would you like to restart and apply it now, or install it later?",
    buttons: ["Install Now", "Install Later"],
      defaultId: 0,
      cancelId: 1,
  };
  
  logWithTimestamp('info', USER_LOG_PREFIX, 'Displaying update installation dialog to user', {
    dialogTitle: dialogOptions.title,
    dialogMessage: dialogOptions.message,
    buttonOptions: dialogOptions.buttons,
    displayTime: new Date().toISOString()
  });
  
  dialog
    .showMessageBox(dialogOptions)
    .then(async (response) => {
      performanceTracker.end('user-interaction-flow');
      
      const userChoice = response.response === 0 ? 'Install Now' : 'Install Later';
      
      logWithTimestamp('info', USER_LOG_PREFIX, `User decision recorded: ${userChoice}`, {
        buttonIndex: response.response,
        responseTime: new Date().toISOString(),
        userChoice: userChoice
      });
      
      if (response.response === 0) {  // User clicked "Install Now"
        performanceTracker.start('installation-process');
        
        logWithTimestamp('info', UPDATE_LOG_PREFIX, '🚀 IMMEDIATE INSTALLATION REQUESTED BY USER');
        
        // Set updating flag to skip confirmation dialogs FIRST
        isUpdating = true;
        sessionManager.logoutUser();
        
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update flag set - skipping close confirmations');
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'User session logged out for clean installation');
        
        // Create success flag for next startup
        const updateFlagPath = path.join(app.getPath("userData"), "update-success.txt");
        fs.writeFileSync(updateFlagPath, info.version);
        logWithTimestamp('info', UPDATE_LOG_PREFIX, `Success flag created: ${updateFlagPath}`);
        
        // Show minimal installation progress BEFORE cleanup
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Creating installation progress window');
        
        const installingWindow = new BrowserWindow({
          width: 350,
          height: 100,
        frame: false,
        resizable: false,
        center: true,
        alwaysOnTop: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
        
        // Mark this as an installation window for cleanup exclusion
        installingWindow.isInstallationWindow = true;
      
      const installHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Installing Update</title>
            <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                margin: 0;
                  padding: 20px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  text-align: center;
                user-select: none;
              }
                .spinner {
                  width: 20px;
                  height: 20px;
                  border: 2px solid rgba(255,255,255,0.3);
                  border-top: 2px solid white;
                border-radius: 50%;
                  animation: spin 1s linear infinite;
                  margin: 0 auto 10px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
                h3 { margin: 0; font-size: 14px; font-weight: 500; }
            </style>
          </head>
          <body>
              <div class="spinner"></div>
              <h3>Installing update...</h3>
          </body>
        </html>
      `;
      
      installingWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(installHtml));
      
      installingWindow.once('ready-to-show', () => {
        installingWindow.show();
          logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Installation progress window displayed to user');
        });
        
        // Run cleanup AFTER showing installation window
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Starting pre-installation cleanup sequence');
        await cleanupForUpdate();
        
        // Install update
      setTimeout(() => {
        try {
            logWithTimestamp('info', UPDATE_LOG_PREFIX, '🚀 INITIATING QUIT AND INSTALL SEQUENCE');
            logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Application will restart with new version');
            
            performanceTracker.end('installation-process');
            autoUpdater.autoInstallOnAppQuit = false;
            autoUpdater.quitAndInstall(true, true);
        } catch (err) {
            performanceTracker.end('installation-process');
            const installError = {
              error: err.message,
              stack: err.stack,
              timestamp: new Date().toISOString()
            };
            logWithTimestamp('error', ERROR_LOG_PREFIX, 'Critical error during installation', installError);
          app.quit();
        }
        }, 1000);
        
      } else {
        // User clicked "Install Later"
        logWithTimestamp('info', USER_LOG_PREFIX, '📅 DEFERRED INSTALLATION SELECTED BY USER');
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update will be applied on next application restart');
        logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Update file cached and ready for installation');
      }
    })
    .catch((dialogError) => {
      performanceTracker.end('user-interaction-flow');
      const dialogErrorData = {
        error: dialogError.message,
        stack: dialogError.stack,
        timestamp: new Date().toISOString()
      };
      logWithTimestamp('error', ERROR_LOG_PREFIX, 'Error displaying installation dialog', dialogErrorData);
    });
});

autoUpdater.on("error", (err) => {
  // Stop any running performance timers
  if (performanceTracker.timers.has('update-check')) performanceTracker.end('update-check');
  if (performanceTracker.timers.has('update-download-process')) performanceTracker.end('update-download-process');
  if (performanceTracker.timers.has('installation-process')) performanceTracker.end('installation-process');
  
  const errorData = {
    errorMessage: err.message,
    errorCode: err.code || 'Unknown',
    stack: err.stack || 'No stack trace available',
    platform: process.platform,
    appVersion: app.getVersion(),
    timestamp: new Date().toISOString(),
    updateUrl: autoUpdater.getFeedURL(),
    autoDownloadEnabled: autoUpdater.autoDownload
  };
  
  logWithTimestamp('error', ERROR_LOG_PREFIX, '💥 AUTO-UPDATER ERROR OCCURRED', errorData);
  
  // Categorize error types for better analysis
  let errorCategory = 'UNKNOWN';
  if (err.message.includes('No published releases')) {
    errorCategory = 'NO_RELEASES_AVAILABLE';
  } else if (err.message.includes('net::')) {
    errorCategory = 'NETWORK_ERROR';
  } else if (err.message.includes('ENOENT')) {
    errorCategory = 'FILE_NOT_FOUND';
  } else if (err.message.includes('Permission denied')) {
    errorCategory = 'PERMISSION_ERROR';
  } else if (err.message.includes('timeout')) {
    errorCategory = 'TIMEOUT_ERROR';
  }
  
  logWithTimestamp('error', ERROR_LOG_PREFIX, `Error category identified: ${errorCategory}`);
  
  win?.webContents.send("update-error", err.message);
  win?.setProgressBar(-1); // Clear any progress indication
  
  // Show error to user only if it's a critical error (not just "no releases")
  if (!err.message.includes("No published releases")) {
    const errorDialogData = {
      errorCategory: errorCategory,
      shownToUser: true,
      userNotificationTime: new Date().toISOString()
    };
    
    logWithTimestamp('error', USER_LOG_PREFIX, 'Displaying error dialog to user', errorDialogData);
    
  dialog.showMessageBox({
    type: "error",
    title: "Update Error",
    message: "There was a problem updating the application.",
    detail: "You can try again later or contact support if the problem persists.",
    buttons: ["OK"]
  });
  } else {
    logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Non-critical error - no user notification shown');
  }
  
  // Log recovery suggestions for backend team
  const recoverySuggestions = {
    errorCategory: errorCategory,
    suggestions: getRecoverySuggestions(errorCategory),
    timestamp: new Date().toISOString()
  };
  
  logWithTimestamp('info', UPDATE_LOG_PREFIX, 'Recovery suggestions for backend team', recoverySuggestions);
});

// Helper function for recovery suggestions
function getRecoverySuggestions(errorCategory) {
  const suggestions = {
    'NO_RELEASES_AVAILABLE': [
      'Verify GitHub repository has published releases',
      'Check release visibility settings',
      'Ensure GH_TOKEN has correct permissions'
    ],
    'NETWORK_ERROR': [
      'Check internet connectivity',
      'Verify firewall settings',
      'Test GitHub API accessibility'
    ],
    'PERMISSION_ERROR': [
      'Check file system permissions',
      'Verify user has write access to update directory',
      'Consider running with elevated permissions'
    ],
    'TIMEOUT_ERROR': [
      'Increase timeout settings',
      'Check network stability',
      'Retry during off-peak hours'
    ],
    'UNKNOWN': [
      'Review full error logs',
      'Check system resources',
      'Verify update configuration'
    ]
  };
  
  return suggestions[errorCategory] || suggestions['UNKNOWN'];
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

async function startPythonExecutable() {  return new Promise((resolve, reject) => {
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
    win.webContents.send("remainingSecondsUpdated", seconds);
  });

  // Listen for license expiration
  sessionManager.on("licenseExpired", () => {
    log.info("License expired");
    // Optionally handle the license expiration, e.g., show a dialog or quit the app
    sessionManager.logoutUser();

    win.webContents.send("navigateToLogin");
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
    title: global.AppConfig.isDev ? `CypherSol Dev v${app.getVersion()}` : `CypherSol v${app.getVersion()}`,
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
  registerOpenFileIpc(global.AppConfig.baseDir);
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

app.setName("CypherSol Dev");

app.whenReady().then(async () => {
  log.info("App is ready", userDataDir);

  createSplashWindow();

  try {
    // 🗄️ Initialize Database FIRST (Core Requirement)
    try {
      const dbManager = databaseManager.getInstance();
      await dbManager.initialize(userDataDir);
      log.info("✅ Database initialized successfully");
    } catch (error) {
      log.error("❌ Database initialization failed:", error);
      throw error;
    }

    // 🏁 Check Update Success/Failure Flags
    const updateFlagPath = path.join(app.getPath("userData"), "update-success.txt");
    if (fs.existsSync(updateFlagPath)) {
      try {
        const version = fs.readFileSync(updateFlagPath, 'utf8');
        fs.unlinkSync(updateFlagPath); // Remove the flag file
        
        // Show success message after app fully loads
        setTimeout(() => {
          dialog.showMessageBox({
            type: "info",
            title: "Update Successful",
            message: `Successfully updated to version ${app.getVersion()}`,
            buttons: ["OK"]
          });
        }, 2000);
      } catch (err) {
        log.error("Error reading update flag:", err);
      }
    }
    
    // Check for update failure flag
    const updateFailurePath = path.join(app.getPath("userData"), "update-failure.txt");
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
            buttons: ["OK"]
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
      log.info("🚀 PHASE 1: Initializing Gateway Server (Required for License Validation)");
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
      log.info("🚀 PHASE 2: Initializing License Manager (Gateway Server Available)");
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

    // await new Promise(resolve => setTimeout(resolve, 255500)); // Wait 1.5 seconds

    createProtocol();
    createWindow();

    win.once("ready-to-show", () => {
      splashWindow.close();
      win.show();
    });

    try {
      await startPythonExecutable();
    } catch (error) {
      log.error("Python initialization failed:", error);
      throw error;
    }

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
log.transports.file.fileName = 'cyphersol.log';

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v2.0.0
// ═══════════════════════════════════════════════════════════════════════════════════════
// Created for: Backend Team Analysis & Software Improvement
// Purpose: Detailed tracking of update process, user behavior, and system performance
// ═══════════════════════════════════════════════════════════════════════════════════════

const UPDATE_LOG_PREFIX = '🔄 [AUTO-UPDATE]';
const PERFORMANCE_LOG_PREFIX = '⚡ [PERFORMANCE]';
const USER_LOG_PREFIX = '👤 [USER-INTERACTION]';
const SYSTEM_LOG_PREFIX = '🖥️ [SYSTEM]';
const ERROR_LOG_PREFIX = '❌ [ERROR]';
const SUCCESS_LOG_PREFIX = '✅ [SUCCESS]';

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
    console.log(`${prefix} ${message}`, data || '');
  }
};

// Performance tracking utilities
const performanceTracker = {
  timers: new Map(),
  
  start(operationName) {
    const startTime = Date.now();
    this.timers.set(operationName, startTime);
    logWithTimestamp('info', PERFORMANCE_LOG_PREFIX, `Started: ${operationName}`);
    return startTime;
  },
  
  end(operationName) {
    const endTime = Date.now();
    const startTime = this.timers.get(operationName);
    if (startTime) {
      const duration = endTime - startTime;
      this.timers.delete(operationName);
      logWithTimestamp('info', PERFORMANCE_LOG_PREFIX, `Completed: ${operationName} | Duration: ${duration}ms`);
      return duration;
    }
    return null;
  }
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
    totalMemory: process.getSystemMemoryInfo ? process.getSystemMemoryInfo().total : 'N/A',
    availableMemory: process.getSystemMemoryInfo ? process.getSystemMemoryInfo().free : 'N/A'
  };
  
  logWithTimestamp('info', SYSTEM_LOG_PREFIX, 'System Information Collected', systemInfo);
  return systemInfo;
};

// Initialize comprehensive logging
log.info('═══════════════════════════════════════════════════════════════════════════════════════');
log.info('🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v2.0.0 INITIALIZED');
log.info('═══════════════════════════════════════════════════════════════════════════════════════');
log.info(`📅 Session Start Time: ${new Date().toISOString()}`);
log.info(`🏷️ Application Version: ${app.getVersion()}`);
log.info(`📁 User Data Directory: ${userDataDir}`);
log.info(`🖥️ Platform: ${process.platform} (${process.arch})`);
log.info(`⚡ Node Version: ${process.versions.node}`);
log.info(`🔋 Electron Version: ${process.versions.electron}`);
log.info(`🔧 Development Mode: ${global.AppConfig.isDev ? 'ENABLED' : 'DISABLED'}`);
log.info('═══════════════════════════════════════════════════════════════════════════════════════');

// Log detailed system information
logSystemInfo();

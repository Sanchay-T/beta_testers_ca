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
const { registerExcelDownloadHandlers } = require("./ipc/excelDownloadHandler")
const db = require("./db/db");
const { spawn, execFile } = require("child_process");
const log = require("electron-log");
const portscanner = require("portscanner"); // Import portscanner
const { autoUpdater } = require("electron-updater");
const { getdata } = require("./ipc/getData.js");

// Configure electron-log
log.transports.console.level = "debug"; // Set the log level
log.transports.file.level = "info"; // Only log info level and above in the log file

// Configure autoUpdater logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Instead of electron-is-dev, we'll use this simple check
const isDev = process.env.NODE_ENV === "development";

// Configure autoUpdater for testing without code signing
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.allowPrerelease = true;

// Platform specific configurations
if (process.platform === 'darwin') {
  autoUpdater.allowDowngrade = true;
} else if (process.platform === 'win32') {
  // app.setAppUserModelId('com.electron.electronapp');
  app.setAppUserModelId(process.execPath); // changed it to process.execPath from 'com.electron.electronapp' to fix the taskbar icon not showing issue ~ Aiyaz
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
}

// Log update configuration
log.info('Update Configuration:', {
  platform: process.platform,
  appVersion: app.getVersion(),
  autoDownload: autoUpdater.autoDownload,
  allowPrerelease: autoUpdater.allowPrerelease,
  feedURL: autoUpdater.getFeedURL()
});
log.info("process.env.NODE_ENV", process.env.NODE_ENV);

// Allow updates without code signing in development
if (isDev) {
  autoUpdater.forceDevUpdateConfig = true;
}

autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

// Configure autoUpdater for GitHub repository
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Shama-Cyphersol',
  repo: 'ca-offline-suite'
});

// Auto-update event handlers with detailed logging
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for updates...');
  win?.webContents.send('update-status', 'checking');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available. Current version:', app.getVersion());
  log.info('New version:', info.version);
  log.info('Release date:', info.releaseDate);
  win?.webContents.send('update-status', 'available', info);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available. Current version:', app.getVersion());
  log.info('Latest version:', info?.version);
  win?.webContents.send('update-status', 'not-available');
});

autoUpdater.on('download-progress', (progress) => {
  const logMessage = `
    Download progress:
    • Speed: ${progress.bytesPerSecond} bytes/s
    • Downloaded: ${progress.transferred} bytes
    • Total: ${progress.total} bytes
    • Percent: ${progress.percent}%
  `;
  log.info(logMessage);
  win?.webContents.send('update-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded. Version:', info.version);
  log.info('Release notes:', info.releaseNotes);
  win?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  log.error('Auto-updater error:', err.message);
  log.error('Error details:', err);
  win?.webContents.send('update-error', err.message);
});

log.info("Working Directory:", process.cwd());

const BASE_DIR = isDev ? __dirname : process.resourcesPath;
log.info("current directory", app.getAppPath());
log.info("BASE_DIR", BASE_DIR);
log.info("__dirname", __dirname);

let win = null;
let pythonProcess = null;

const BACKEND_PORT = 5000; // Replace with the port your backend is listening to

// Listen for remaining seconds updates
// sessionManager.on('remainingSecondsUpdated', (seconds) => {
//   console.log(`Remaining seconds: ${seconds}`);
// });

// Listen for license expiration
sessionManager.on("licenseExpired", () => {
  log.info("License expired");
  // Optionally handle the license expiration, e.g., show a dialog or quit the app
  sessionManager.clearUser();

  win.webContents.send("navigateToLogin");
  // win?.destroy();
});

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
    const errorMessage = `Executable not found for platform: ${process.platform}`;
    log.error(errorMessage);
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
    if (isDev) {
      const venvPythonPath =
        process.platform === "win32"
          ? path.join(__dirname, "../.venv/Scripts/python.exe") // Path to .venv Python on Windows
          : path.join(__dirname, "../.venv/bin/python"); // Path to .venv Python on macOS/Linux

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
      const executablePath = getProductionExecutablePath();
      if (!executablePath) {
        reject(new Error("Executable not found"));
        return;
      }

      command = executablePath;
      args = [];
    }

    try {
      log.info("Options : ", options);
      pythonProcess = spawn(command, args, options);

      pythonProcess.stdout.on("data", (data) =>
        log.info(`Process stdout: ${data}`)
      );
      pythonProcess.stderr.on("data", (data) =>
        log.error(`Process stderr: ${data}`)
      );

      pythonProcess.on("error", (error) => {
        const errorMessage = `Failed to start process: ${error.message}`;
        log.error(errorMessage);
        dialog.showErrorBox("Process Error", errorMessage);
        reject(error);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          const errorMessage = `Process exited with non-zero code: ${code}`;
          log.error(errorMessage);
          // dialog.showErrorBox("Process Exited", errorMessage);
          reject(new Error(errorMessage));
        } else {
          log.info("Process started successfully.");
          resolve();
        }
      });

      setTimeout(resolve, 2000);
    } catch (error) {
      const errorMessage = `Unexpected error starting process: ${error.message}`;
      log.error(errorMessage);
      dialog.showErrorBox("Unexpected Error", errorMessage);
      reject(error);
    }
  });
}

// Add this function to handle file protocol
function createProtocol() {
  protocol.registerFileProtocol("app", (request, callback) => {
    const url = request.url.replace("app://", "");
    try {
      return callback(path.normalize(`${__dirname}/../react-app/build/${url}`));
    } catch (error) {
      log.error("Protocol error:", error);
    }
  });
}

async function createWindow() {
  log.info("Creating window");
  win = new BrowserWindow({
    width: 1800,
    height: 1000,
    simpleFullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "cyphersol-icon.png"),
    autoHideMenuBar: true,
    title: isDev ? "CypherSol Dev" : "CypherSol",
  });
  if (isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    const prodPath = path.resolve(
      __dirname,
      "react-app",
      "build",
      "index.html"
    );
    log.info("Directory name:", __dirname);
    log.info("Production path:", prodPath);
    win.loadFile(prodPath).catch((err) => {
      log.error("Failed to load production build:", err);
    });
  }

  win.on("close", (event) => {
    // event.preventDefault();
    log.info("Close event triggered");
    // win.hide();
    // if (process.platform === 'darwin') {
    // Show the confirmation dialog when the close button is clicked
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
      sessionManager.clearUser();
      // Add your session logout logic here
    } else {
      log.info("User canceled app close.");
      event.preventDefault(); // Prevent app from closing, keeping it in the background
    }
    // }
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
    if (isDev) {
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
  registerOpenFileIpc(BASE_DIR);
  registerReportHandlers(TMP_DIR);
  registerAuthHandlers();
  registerOpportunityToEarnIpc();
  getdata();
  registerEditReportHandlers();
  registerExcelDownloadHandlers(app.getPath("downloads"));

  // Auto-update IPC handlers with detailed logging
  ipcMain.handle('check-for-updates', async () => {
    log.info('Manual update check requested');
    if (isDev) {
      const msg = 'Skip update check in dev mode';
      log.info(msg);
      return msg;
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      log.info('Check for updates result:', result);
      return result;
    } catch (err) {
      log.error('Check for updates failed:', err);
      throw err;
    }
  });

  ipcMain.handle('download-update', async () => {
    log.info('Update download requested');
    try {
      // Backup database before update
      const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
      const backupDir = path.join(app.getPath('userData'), 'backups');

      log.info('Creating backup directory:', backupDir);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `db-backup-${timestamp}.sqlite`);

      log.info('Creating database backup:', backupPath);
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        log.info('Database backup created successfully');
      } else {
        log.info('No database found to backup');
      }

      const result = await autoUpdater.downloadUpdate();
      log.info('Update download completed');
      return result;
    } catch (err) {
      log.error('Update download failed:', err);
      throw err;
    }
  });

  ipcMain.handle('install-update', () => {
    log.info('Update installation requested. Quitting app and installing update...');
    if (process.platform === 'win32') {
      // For Windows, we want to restart the app after update
      autoUpdater.quitAndInstall(true, true);
    } else {
      // For macOS, let the user choose when to restart
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Add platform-specific update settings
  if (process.platform === 'win32') {
    ipcMain.handle('get-update-location', () => {
      const updatePath = path.join(app.getPath('temp'), 'cyphersol-updates');
      log.info('Windows update location:', updatePath);
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
}

app.setName("CypherSol Dev");

app.whenReady().then(async () => {
  log.info("App is ready", app.getPath("userData"));
  try {
    // try {
    //   sessionManager.init();
    // } catch (error) {
    //   log.error("SessionManager initialization failed:", error);
    //   throw error;
    // }

    // try {
    //   licenseManager.init();
    // } catch (error) {
    //   log.error("LicenseManager initialization failed:", error);
    //   throw error;
    // }

    try {
      sessionManager.init();
    } catch (error) {
      log.error("SessionManager initialization failed:", error);
      throw error;
    }

    try {
      licenseManager.init();
      log.info("Python process started successfully");
    } catch (error) {
      log.error("LicenseManager initialization failed:", error);
      throw error;
    }

    try {
      startPythonExecutable();
    } catch (error) {
      log.error("Python initialization failed:", error);
      throw error;
    }

    // Proceed with the window creation and other tasks after initialization
    log.info("After all initializations");
    createProtocol();
    createWindow();

    // Initial update check after 1 minute
    if (!isDev) {
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
  sessionManager.clearUser();
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

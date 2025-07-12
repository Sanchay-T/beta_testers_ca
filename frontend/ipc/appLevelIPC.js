const { dialog, ipcMain } = require("electron");
const sudo = require("sudo-prompt");
const log = require("electron-log");
const path = require("path");

function registerAppLevelIPCHandlers(appInstance, appWindow, base_dir) {
  ipcMain.handle("app:check-admin-rights", async () => {
    if (process.platform === "darwin") {
      return { elevated: true };
    }

    try {
      const isElevated = await import("is-elevated");
      const elevated = await isElevated.default();
      return { elevated: elevated };
    } catch (error) {
      log.warn("is-elevated module failed, using fallback:", error.message);
      // Fallback: assume not elevated on error
      return { elevated: false };
    }
  });

  ipcMain.on("app:relaunchAsAdmin", () => {
    log.info("Relaunching as admin");

    const isDev = !appInstance.isPackaged;
    const platform = process.platform;

    let execCommand;

    if (platform === "darwin") {
      // macOS
      // macOS – use AppleScript via osascript for proper GUI context
      // const electronPath = path.join(base_dir, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
      // const entryPath = path.join(base_dir, 'main.js');
      const execPath = process.execPath;

      // const escapedPath = appPath.replace(/"/g, '\\"');
      // const command = `do shell script "${electronPath} \\"${entryPath}\\"" with administrator privileges`;
      execCommand = `${execPath}`;
    } else if (platform === "win32") {
      // Windows
      const winElectronPath = path.join(
        base_dir,
        "node_modules",
        "electron",
        "dist",
        "electron.exe"
      );
      const entryPath = path.join(base_dir, "main.js");
      execCommand = isDev
        ? `"${winElectronPath}" "${entryPath}"`
        : `"${process.execPath}"`;
    } else {
      // Linux
      const entryPath = path.join(base_dir, "main.js");
      execCommand = isDev
        ? `"${process.execPath}" "${entryPath}"`
        : `"${process.execPath}"`;
    }

    log.info(`[Admin Relaunch] Platform: ${platform}`);
    log.info(`[Admin Relaunch] Command: ${execCommand}`);

    sudo.exec(
      execCommand,
      { name: "Cyphersol Relaunch" },
      (error, stdout, stderr) => {
        if (error) {
          log.error("Failed to relaunch as admin:", error);
          if (appWindow && !appWindow.isDestroyed()) {
            appWindow.webContents.send("admin-relaunch-failed", {
              error: error.message || error.toString(),
            });
          }
          return;
        }

        log.info("Relaunch Stdout: " + stdout);
        if (stderr) {
          log.info("Relaunch Stderr: " + stderr);
        }
        log.info("Successfully launched with elevated permissions");
      }
    );

    // setTimeout(() => {
    //     appInstance.exit(0);
    // }, 500); // 300ms is usually enough; tweak if needed    });
  });
}

module.exports = { registerAppLevelIPCHandlers };

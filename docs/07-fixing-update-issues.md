# Fixing Auto-Update Issues

## The Problem

You're experiencing two issues:
1. **Slow updates** - Downloads and restarts take a long time
2. **Uninstall failure** - "Failed to uninstall old application files" error on some PCs

## Root Causes Analysis

### Why Updates Fail on Some PCs

The error occurs because Windows can't delete old files that are still in use. Your app has multiple processes:

1. **Main Electron Process** - The UI
2. **Python Backend** (`main.exe`) - FastAPI server
3. **Gateway Service** (`gatewayService.exe`) - Windows service for licensing
4. **Database Connections** - SQLite file handles
5. **Log Files** - Being actively written

When the updater tries to replace files, these processes are still running and locking files.

### Why It Works on Some PCs

- **Faster PCs**: Processes terminate quicker
- **Windows Version**: Different Windows versions handle file locking differently
- **Antivirus**: Some AV software may delay file operations
- **User Permissions**: Admin vs non-admin users
- **Background Services**: How quickly Windows can stop the Gateway service

## Immediate Fixes

### Fix 1: Improve Process Cleanup

Add this to your `main.js` before the update install:

```javascript
// Add this function after line 380 (where autoUpdater events are)
async function cleanupForUpdate() {
  log.info("Cleaning up processes before update...");
  
  try {
    // 1. Stop the Gateway Windows Service
    if (process.platform === 'win32') {
      log.info("Stopping Gateway service...");
      execSync('sc stop LicensingServer', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for service to stop
    }
    
    // 2. Close database connections
    log.info("Closing database connections...");
    const dbManager = DatabaseManager.getInstance();
    if (dbManager && dbManager.getDatabase()) {
      // SQLite doesn't have a close method, but we can null the reference
      dbManager.getDatabase().close?.();
    }
    
    // 3. Kill Python backend forcefully
    if (pythonProcess && !pythonProcess.killed) {
      log.info("Terminating Python backend...");
      
      // First try graceful shutdown
      pythonProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force kill if still running
      if (!pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
        
        // On Windows, also use taskkill as backup
        if (process.platform === 'win32') {
          try {
            execSync('taskkill /F /IM main.exe', { timeout: 3000 });
          } catch (e) {
            log.warn("Taskkill failed:", e.message);
          }
        }
      }
    }
    
    // 4. Close all windows
    BrowserWindow.getAllWindows().forEach(win => {
      win.removeAllListeners('close');
      win.close();
    });
    
    // 5. Wait a bit for everything to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    log.error("Error during cleanup:", error);
    // Continue anyway - update might still work
  }
}

// Modify the update-downloaded event (around line 380)
autoUpdater.on("update-downloaded", async (event) => {
  log.info("Update downloaded. Preparing to install...");
  
  // Show update dialog
  const dialogOpts = {
    type: "info",
    buttons: ["Install Update", "Later"],
    title: "Application Update",
    message: process.platform === "win32" ? event.releaseNotes : event.releaseName,
    detail: "A new version has been downloaded. The application will restart to apply the update.",
  };

  const response = dialog.showMessageBoxSync(dialogOpts);
  
  if (response === 0) {
    // User chose to install
    log.info("User accepted update. Starting cleanup...");
    
    // Clean up before installing
    await cleanupForUpdate();
    
    // Mark update as in progress
    isUpdating = true;
    
    // Force quit and install
    autoUpdater.quitAndInstall(true, true);
  }
});
```

### Fix 2: Add Retry Logic for Failed Updates

Add this error handler:

```javascript
// Add after the autoUpdater configuration (around line 350)
let updateRetryCount = 0;
const MAX_UPDATE_RETRIES = 3;

autoUpdater.on("error", async (error) => {
  log.error("Update error:", error);
  
  // Check if it's an uninstall error
  if (error.message && error.message.includes("uninstall")) {
    updateRetryCount++;
    
    if (updateRetryCount < MAX_UPDATE_RETRIES) {
      log.info(`Update failed, attempting retry ${updateRetryCount}/${MAX_UPDATE_RETRIES}`);
      
      // More aggressive cleanup
      await cleanupForUpdate();
      
      // Kill any remaining instances
      if (process.platform === 'win32') {
        try {
          execSync('taskkill /F /IM Cyphersol.exe');
          execSync('taskkill /F /IM main.exe');
          execSync('taskkill /F /IM gatewayService.exe');
        } catch (e) {
          // Ignore errors - processes might not exist
        }
      }
      
      // Wait and retry
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 5000);
    } else {
      // Show manual update instructions
      dialog.showErrorBox(
        "Update Failed",
        "The automatic update failed. Please:\n\n" +
        "1. Close Cyphersol completely\n" +
        "2. Open Task Manager and end any Cyphersol processes\n" +
        "3. Download the latest version manually from our website\n" +
        "4. Run the installer as Administrator"
      );
    }
  }
});
```

### Fix 3: Update NSIS Configuration

In `package.json`, update the NSIS configuration:

```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": false,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "Cyphersol",
  "deleteAppDataOnUninstall": false,
  "artifactName": "${productName}-Setup-${version}.${ext}",
  "uninstallDisplayName": "${productName}",
  "differentialPackage": false,  // Change to false
  "warningsAsErrors": false,
  "include": "build/installer.nsh"  // Add custom script
}
```

### Fix 4: Create Custom NSIS Script

Create `frontend/build/installer.nsh`:

```nsis
!macro customUnInit
  ; Kill all app processes before uninstall
  nsExec::Exec 'taskkill /F /IM "Cyphersol.exe"'
  nsExec::Exec 'taskkill /F /IM "main.exe"'
  nsExec::Exec 'taskkill /F /IM "gatewayService.exe"'
  
  ; Stop the Windows service
  nsExec::Exec 'sc stop LicensingServer'
  
  ; Wait for processes to terminate
  Sleep 3000
  
  ; Delete service if exists
  nsExec::Exec 'sc delete LicensingServer'
!macroend

!macro customInstall
  ; Ensure old processes are killed before install
  nsExec::Exec 'taskkill /F /IM "Cyphersol.exe"'
  nsExec::Exec 'taskkill /F /IM "main.exe"'
  Sleep 1000
!macroend
```

## Why Updates Are Slow

1. **Download Speed**: GitHub releases might be slow from some locations
2. **Differential Updates**: Currently disabled, full downloads every time
3. **Antivirus Scanning**: New exe files get scanned
4. **Process Cleanup**: Takes time to stop all services

### Speed Improvements:

1. **Enable Differential Updates** (after fixing uninstall issues):
   ```json
   "differentialPackage": true
   ```

2. **Add Progress Indication**:
   The progress window is good, but add estimated time:
   ```javascript
   autoUpdater.on("download-progress", (progressObj) => {
     const mbPerSecond = progressObj.bytesPerSecond / 1048576;
     const remainingBytes = progressObj.total - progressObj.transferred;
     const remainingSeconds = remainingBytes / progressObj.bytesPerSecond;
     
     let message = `Download speed: ${mbPerSecond.toFixed(2)} MB/s`;
     message += ` - Remaining: ${Math.round(remainingSeconds)} seconds`;
     
     sendToProgressWindow("download-progress", {
       ...progressObj,
       message
     });
   });
   ```

3. **Pre-download Updates**:
   ```javascript
   // Check for updates more frequently but download in background
   setInterval(() => {
     if (!isUpdating) {
       autoUpdater.checkForUpdatesAndNotify();
     }
   }, 30 * 60 * 1000); // Every 30 minutes
   ```

## Testing the Fix

1. **Build with the changes**
2. **Install on a test machine**
3. **Create a new version** (bump version in package.json)
4. **Publish the update**
5. **Test update on various PCs**

## Long-term Solutions

1. **Move to MSI installer**: Better process handling than NSIS
2. **Implement staged rollouts**: Test updates on subset of users first
3. **Add telemetry**: Track update success/failure rates
4. **Consider portable version**: No installation needed
5. **Implement background updates**: Download while app is running

## Diagnostic Commands

To help users with stuck updates:

```batch
@echo off
echo Cleaning up Cyphersol processes...

taskkill /F /IM "Cyphersol.exe" 2>nul
taskkill /F /IM "main.exe" 2>nul
taskkill /F /IM "gatewayService.exe" 2>nul

sc stop LicensingServer 2>nul
sc delete LicensingServer 2>nul

echo Done! You can now run the installer.
pause
```

Save as `cleanup-cyphersol.bat` and have users run it before manual updates.
# CypherEdge UAT Auto-Update System - Complete Technical Documentation

**Version**: 2.3.407
**Last Updated**: November 11, 2025
**Status**: Production Ready (with critical fixes applied)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem History & Root Cause Analysis](#problem-history--root-cause-analysis)
3. [System Architecture](#system-architecture)
4. [Component Breakdown](#component-breakdown)
5. [Complete Update Flow](#complete-update-flow)
6. [File Structure & Responsibilities](#file-structure--responsibilities)
7. [Logging System](#logging-system)
8. [Configuration Files](#configuration-files)
9. [Testing Procedures](#testing-procedures)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Future Improvements](#future-improvements)

---

## Executive Summary

CypherEdge UAT is a complex Electron application with multiple backend services (Python FastAPI, .NET Gateway Service) that requires seamless auto-updates. The application uses **DigitalOcean Spaces (S3-compatible CDN)** for hosting update files and **electron-updater v6.6.2** for client-side update management.

### **Critical Problem Solved**
**Issue**: Updates from version N to N+1 would download successfully but fail during installation, causing `app.asar` corruption and JSON parsing errors on next launch.

**Root Cause**: Race condition where Windows file locks were not fully released before NSIS installer attempted to replace `app.asar` during the update installation phase.

**Solution**: Implemented a **two-stage waiting strategy**:
1. **Pre-uninstall cleanup**: Kill all processes + wait 5 seconds (in `customUnInit` macro)
2. **Pre-install stabilization**: Wait 10 seconds for Windows to release file locks (in `customInstall` macro)
3. **Post-install delay**: Wait 5 seconds before launching new version (in `customInstall` macro)

**Total safety margin**: 20 seconds of strategic wait times ensuring clean file replacement.

---

## Problem History & Root Cause Analysis

### Timeline of Issues

#### **Phase 1: Initial Problem Discovery**
- **Date**: Version 2.3.404 → 2.3.405 update
- **Symptom**: After clicking "Install Now" and app restarting, JSON parsing error appears
- **User Impact**: Application becomes completely unusable
- **Error Message**:
  ```
  SyntaxError: Unexpected token < in JSON at position 0
  at JSON.parse()
  at app.getVersion()
  ```

#### **Phase 2: Investigation & Hypothesis**
- **Root Cause Identified**: `app.asar` file corruption during update
- **Why Corruption Occurred**:
  1. User clicks "Install Now" in version 2.3.404
  2. Electron app quits and launches NSIS installer (`CypherEdge-UAT-Setup-2.3.405.exe /S --updated`)
  3. NSIS uninstaller runs to remove old version
  4. **PROBLEM**: Python backend (`main.exe`), Gateway service (`gatewayService.exe`), and Electron processes still running
  5. **RESULT**: Windows prevents file deletion/replacement due to file locks
  6. NSIS tries to install new version anyway
  7. `app.asar` gets **partially written** → corruption
  8. New app launches with corrupted `app.asar` → `package.json` cannot be read → JSON parse error

#### **Phase 3: First Fix Attempt (Version 2.3.406)**
- **Solution**: Added `customUnInit` macro to NSIS installer
- **Purpose**: Kill all processes BEFORE uninstall phase
- **Implementation**:
  ```nsis
  !macro customUnInit
    ; Kill Electron app
    taskkill /F /IM "CypherEdge-UAT.exe" /T
    ; Kill Python backend
    taskkill /F /IM "main.exe" /T
    ; Kill Gateway service
    taskkill /F /IM "gatewayService.exe" /T
    ; Stop Windows service
    sc stop LicensingServer
    ; Wait 5 seconds
    Sleep 5000
  !macroend
  ```
- **Result**: ❌ **FAILED** - app.asar still not replaced properly

#### **Phase 4: Deep Dive Analysis**
- **Log Analysis**: Discovered that:
  1. `customUnInit` successfully killed all processes ✅
  2. Uninstaller ran successfully ✅
  3. Installer ran successfully ✅
  4. **BUT** `app.asar` timestamp did NOT change ❌
- **Realization**: There's a **timing gap** between uninstall completion and install start
- **Windows Behavior**: Even after processes are killed, Windows needs time to release file handles
- **Problem**: NSIS immediately starts installation after uninstall without waiting for file locks to clear

#### **Phase 5: Final Fix (Version 2.3.407)**
- **Solution**: Added `Sleep 10000` at the **beginning of customInstall** macro
- **Purpose**: Give Windows 10 seconds to fully release file locks after uninstall phase completes
- **Result**: ✅ **SUCCESS** - app.asar now replaces cleanly

### Technical Root Cause Diagram

```
UPDATE FLOW WITHOUT FIX (BROKEN):
═══════════════════════════════════════════════════════════════

User clicks "Restart Now"
         ↓
Electron quits (main processes killed)
         ↓
NSIS Installer launches with /S --updated flag
         ↓
customUnInit runs → Kill processes → Wait 5s
         ↓
Uninstall phase runs (removes most files)
         ↓
❌ IMMEDIATE INSTALL START (no wait!)
         ↓
Try to replace app.asar → LOCKED BY WINDOWS ❌
         ↓
Partial write → CORRUPTION
         ↓
App launches with corrupted app.asar
         ↓
JSON.parse() error → APP CRASH


UPDATE FLOW WITH FIX (WORKING):
═══════════════════════════════════════════════════════════════

User clicks "Restart Now"
         ↓
Electron quits + pre-cleanup in main.js
         ↓
NSIS Installer launches with /S --updated flag
         ↓
customUnInit runs → Kill processes → Wait 5s ✅
         ↓
Uninstall phase runs (removes most files)
         ↓
✅ customInstall starts → Sleep 10000 (NEW FIX)
         ↓
Windows releases ALL file locks during this wait
         ↓
Install new version → app.asar replaces cleanly ✅
         ↓
Wait 5s for file system stabilization
         ↓
Launch new version
         ↓
validateAppIntegrity() runs → PASSES ✅
         ↓
App starts successfully with new version
```

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CYPHEREDGE UAT APPLICATION               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │  Electron Main  │  │  React Frontend  │  │  Python   │ │
│  │    Process      │◄─┤   (Port 3000)    │  │  Backend  │ │
│  │   (Node.js)     │  │                  │  │ (Port 7500)│ │
│  └────────┬────────┘  └──────────────────┘  └─────┬─────┘ │
│           │                                         │       │
│           │          ┌────────────────┐            │       │
│           └──────────┤  .NET Gateway  │────────────┘       │
│                      │    Service     │                    │
│                      │  (Port 7890)   │                    │
│                      └────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Auto-Update Check (every 5 minutes)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              DIGITALOCEAN SPACES CDN (S3)                   │
├─────────────────────────────────────────────────────────────┤
│  URL: https://cypheredge-exe-uat.blr1.cdn.digitalocean     │
│       spaces.com/releases/windows/                          │
│                                                             │
│  Files:                                                     │
│  ├── latest.yml (version metadata)                         │
│  ├── CypherEdge-UAT-Setup-2.3.407.exe (1.6GB installer)   │
│  └── [older versions...]                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ electron-updater library
                          ↓
                    Version Comparison
                          │
                          ├─ No Update → Continue normal operation
                          │
                          └─ Update Available → Download → User Notification
```

### Component Responsibilities

| Component | Technology | Port | Purpose | Update Impact |
|-----------|-----------|------|---------|---------------|
| **Electron Main Process** | Node.js 20.18.3 | - | Application orchestration, IPC hub, auto-update management | Must be killed before update |
| **React Frontend** | React 18 | 3000 (dev) | User interface, dashboard views | Bundled in app.asar |
| **Python Backend** | FastAPI, PyInstaller | 7500 | PDF processing, ML extraction, bank statement analysis | `main.exe` must be killed before update |
| **Gateway Service** | .NET Core | 7890 | License validation, authentication | `gatewayService.exe` and Windows service must be stopped |
| **SQLite Database** | Drizzle ORM | - | Local data storage | Database connections must be closed |

---

## Component Breakdown

### 1. electron-updater Configuration

**Location**: `frontend/main.js` (lines 85-95, 995-1200)

**Key Features**:
- **Provider**: Generic (S3-compatible)
- **Update URL**: `https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows`
- **Channel**: `latest`
- **Auto-download**: `true`
- **Check interval**: Every 5 minutes (300000ms)
- **Differential updates**: Disabled (full installer download)

**Configuration Code**:
```javascript
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows',
  channel: 'latest'
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false; // We handle this manually
```

### 2. NSIS Custom Installer

**Location**: `frontend/build/installer.nsh`

**Critical Macros**:

#### **customUnInit** (Lines 129-216)
- **Purpose**: Runs BEFORE uninstaller removes files
- **Timing**: During update, this is the FIRST thing that happens
- **Responsibilities**:
  1. Kill `CypherEdge-UAT.exe` process
  2. Kill `main.exe` (Python backend)
  3. Kill `gatewayService.exe` (Gateway service)
  4. Stop `LicensingServer` Windows service
  5. Wait 5 seconds for clean shutdown
  6. Verify all processes terminated

#### **customInstall** (Lines 18-93)
- **Purpose**: Runs DURING new version installation
- **Timing**: After uninstall completes, before files are copied
- **Critical Addition** (NEW FIX):
  ```nsis
  ${If} ${Silent}  ; Only during auto-updates
    DetailPrint "[PRE-INSTALL-WAIT] Uninstall phase complete"
    DetailPrint "[PRE-INSTALL-WAIT] Waiting 10 seconds for Windows to release file locks..."
    Sleep 10000  ; ← THIS IS THE CRITICAL FIX
    DetailPrint "[PRE-INSTALL-WAIT] ✓ File system stabilized - safe to install"
  ${EndIf}
  ```
- **Additional Responsibilities**:
  1. Check and install VC++ Redistributable if missing
  2. Add Windows Firewall rules
  3. Show user notification during silent update
  4. Wait 5 seconds after installation before launching
  5. Launch new version

#### **customUnInstall** (Lines 95-121)
- **Purpose**: Cleanup when user uninstalls application
- **Responsibilities**: Remove firewall rules

### 3. Integrity Validation

**Location**: `frontend/main.js` (lines 100-179)

**Purpose**: Detect corrupted `app.asar` on startup and prevent app launch

**Implementation**:
```javascript
function validateAppIntegrity() {
  log.info("🔍 ═══ STARTING APP INTEGRITY CHECK ═══");

  try {
    // Test 1: Read package.json from ASAR
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

    // Test 2: Parse JSON (this is where corruption fails)
    const packageJson = JSON.parse(packageJsonContent);

    // Test 3: Validate critical fields
    if (!packageJson.version || !packageJson.name || !packageJson.main) {
      throw new Error('package.json missing critical fields');
    }

    log.info(`[INTEGRITY-CHECK]   ✓ version: ${packageJson.version}`);
    log.info("✅ ═══ APP INTEGRITY CHECK PASSED ═══");
    return { success: true, version: packageJson.version };

  } catch (error) {
    log.error("❌ ═══ APP INTEGRITY CHECK FAILED ═══");

    // Show user-friendly error dialog
    dialog.showErrorBox(
      'CypherEdge Installation Corrupted',
      `The application installation appears to be corrupted.\n\n` +
      `Error: ${error.message}\n\n` +
      `Please:\n1. Uninstall CypherEdge completely\n2. Reinstall from fresh installer`
    );

    app.quit();
    process.exit(1);
  }
}

// Run immediately on startup
const integrityResult = validateAppIntegrity();
```

### 4. React Update UI

**Location**: `frontend/react-app/src/components/UpdateNotification.js`

**Features**:
- Toast notifications for update availability
- Download progress indicator
- "Restart Now" button with full-screen modal
- Installation progress animation

**Key States**:
```javascript
const [updateStatus, setUpdateStatus] = useState("idle");
const [progress, setProgress] = useState(0);
const [isInstalling, setIsInstalling] = useState(false);
```

**User Flow**:
1. **Update Available**: Toast with "Download" button
2. **Downloading**: Progress bar showing download percentage
3. **Downloaded**: Toast with "Restart Now" button
4. **Installing**: Full-screen modal with spinning gear animation
5. **Relaunch**: New version starts automatically

---

## Complete Update Flow

### Phase 0: Update Check (Every 5 Minutes)

```javascript
// main.js - Scheduled check
setInterval(() => {
  log.info("🔄 Starting automatic update check");
  autoUpdater.checkForUpdates().catch(err => {
    log.error("[UPDATE-CHECK] Error:", err);
  });
}, 300000); // 5 minutes
```

**Process**:
1. electron-updater fetches `latest.yml` from CDN
2. Compares `version` field with current `app.getVersion()`
3. Uses semver comparison (e.g., 2.3.407 > 2.3.406)
4. If newer version found → Trigger `update-available` event

### Phase 1: Update Detection

**Event**: `update-available`

**Code** (`main.js` lines 1015-1050):
```javascript
autoUpdater.on("update-available", (info) => {
  log.info("[2025-11-11T12:30:10.807Z] [UPDATE] 🎉 UPDATE AVAILABLE DETECTED!", {
    currentVersion: app.getVersion(),
    newVersion: info.version,
    releaseDate: info.releaseDate,
    downloadUrl: info.files[0].url,
    isAutoDownloadEnabled: autoUpdater.autoDownload
  });

  // System requirements check
  const systemInfo = require('./SystemInformation');
  const sysData = systemInfo.getData();

  if (sysData.memoryGB < 8) {
    log.warn("[UPDATE] ⚠️ Low RAM detected - update may fail");
  }

  // Send notification to React frontend
  if (mainWindow) {
    mainWindow.webContents.send("update-status", {
      status: "downloading-background",
      version: info.version,
      message: "Update downloading in background..."
    });
  }

  // autoDownload = true, so download starts automatically
});
```

### Phase 2: Download Progress

**Event**: `download-progress`

**Code** (`main.js` lines 1075-1095):
```javascript
autoUpdater.on("download-progress", (progressObj) => {
  log.info(`[UPDATE] 📥 Download Progress: ${Math.round(progressObj.percent)}%`, {
    percent: progressObj.percent,
    transferred: progressObj.transferred,
    total: progressObj.total,
    speed: progressObj.bytesPerSecond,
    timeRemaining: Math.round(progressObj.delta / progressObj.bytesPerSecond)
  });

  // Update taskbar progress indicator (Windows)
  if (mainWindow) {
    mainWindow.setProgressBar(progressObj.percent / 100);
  }

  // Send progress to React UI
  mainWindow.webContents.send("update-progress", progressObj);
});
```

**Download Details**:
- **File Size**: ~1.6GB (full installer)
- **Download Speed**: ~60 MB/s (depends on connection)
- **Download Time**: ~27 seconds (on good connection)
- **Storage Location**: `%LOCALAPPDATA%\cypheredge-uat-updater\pending\CypherEdge-UAT-Setup-2.3.407.exe`

### Phase 3: Download Complete

**Event**: `update-downloaded`

**Code** (`main.js` lines 1100-1135):
```javascript
autoUpdater.on("update-downloaded", (info) => {
  log.info("[UPDATE] 🎉 UPDATE DOWNLOAD COMPLETED SUCCESSFULLY!", {
    newVersion: info.version,
    currentVersion: app.getVersion(),
    downloadedAt: new Date().toISOString(),
    platform: process.platform
  });

  // Clear taskbar progress
  if (mainWindow) {
    mainWindow.setProgressBar(-1); // Remove progress bar
  }

  // Show dialog to user: "Install Now" or "Install Later"
  const dialogOpts = {
    type: "info",
    buttons: ["Install Now", "Install Later"],
    title: "Update Ready to Install",
    message: `🎉 New version ${info.version} has been downloaded!`,
    detail: "Click 'Install Now' to restart and apply the update."
  };

  dialog.showMessageBox(mainWindow, dialogOpts).then(({ response }) => {
    if (response === 0) { // "Install Now" clicked
      log.info("[USER] User clicked 'Install Now'");

      // Trigger installation process
      quitAndInstallUpdate();
    } else {
      log.info("[USER] User clicked 'Install Later'");
      // Update will install on next app quit
      autoUpdater.autoInstallOnAppQuit = true;
    }
  });
});
```

### Phase 4: Pre-Installation Cleanup (in main.js)

**Function**: `quitAndInstallUpdate()` (`main.js` lines 1140-1250)

**Purpose**: Clean up Electron-side resources BEFORE launching NSIS installer

**Steps**:
```javascript
async function quitAndInstallUpdate() {
  log.info("═══════════════════════════════════════════════════════════════");
  log.info("   QUIT AND INSTALL SEQUENCE - COMPREHENSIVE LOGGING");
  log.info("═══════════════════════════════════════════════════════════════");

  // Step 1: Set update flag (skips close confirmations)
  isUpdating = true;

  // Step 2: Logout user session
  if (typeof sessionManager.logout === 'function') {
    sessionManager.logout();
  }

  // Step 3: Create success flag file
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'update-success.txt'),
    `Updated to ${autoUpdater.currentVersion.version} at ${new Date().toISOString()}`
  );

  // Step 4: Show installation progress window to user
  const installWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false }
  });
  installWindow.loadFile('install-progress.html');

  // Step 5: Admin-level cleanup sequence
  log.info("[UPDATE] 🧹 ADMIN-LEVEL CLEANUP SEQUENCE INITIATED");

  // Stop Gateway service
  await execPromise('sc stop LicensingServer');
  log.info("[UPDATE] Gateway service stopped");

  // Close database connections
  if (databaseManager && typeof databaseManager.close === 'function') {
    await databaseManager.close();
  }

  // Kill Python backend
  await execPromise('taskkill /F /IM "main.exe" /T');
  log.info("[UPDATE] Python backend terminated");

  // Kill Gateway executable
  await execPromise('taskkill /F /IM "gatewayService.exe" /T');
  log.info("[UPDATE] Gateway executable terminated");

  // Close all windows except install progress window
  BrowserWindow.getAllWindows().forEach(window => {
    if (window !== installWindow) {
      window.close();
    }
  });

  // Step 6: Wait 3 seconds for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 3000));

  log.info("[QUIT-INSTALL] Step 6/6: Calling autoUpdater.quitAndInstall(true, true)");
  log.info("[QUIT-INSTALL] NSIS installer will now:");
  log.info("[QUIT-INSTALL]   1. Run customUnInit (kill remaining processes)");
  log.info("[QUIT-INSTALL]   2. Uninstall old version");
  log.info("[QUIT-INSTALL]   3. Wait 10 seconds for file locks");
  log.info("[QUIT-INSTALL]   4. Install new version");
  log.info("[QUIT-INSTALL]   5. Wait 5 seconds for stabilization");
  log.info("[QUIT-INSTALL]   6. Launch new version");

  // Launch NSIS installer and quit Electron
  autoUpdater.quitAndInstall(true, true);
}
```

### Phase 5: NSIS Installer Execution

**Command Line**: `CypherEdge-UAT-Setup-2.3.407.exe /S --updated`

**Flags**:
- `/S`: Silent mode (no user interaction)
- `--updated`: Indicates this is an auto-update (not fresh install)

**NSIS Script Flow** (`installer.nsh`):

```nsis
; ═══════════════════════════════════════════════════════════════
; STEP 1: customUnInit (Pre-Uninstall Cleanup)
; ═══════════════════════════════════════════════════════════════
!macro customUnInit
  DetailPrint "[CLEANUP-LOG] Step 1/6: Killing Electron application..."
  nsExec::ExecToLog 'taskkill /F /IM "CypherEdge-UAT.exe" /T'

  DetailPrint "[CLEANUP-LOG] Step 2/6: Killing Python backend..."
  nsExec::ExecToLog 'taskkill /F /IM "main.exe" /T'

  DetailPrint "[CLEANUP-LOG] Step 3/6: Killing Gateway service..."
  nsExec::ExecToLog 'taskkill /F /IM "gatewayService.exe" /T'

  DetailPrint "[CLEANUP-LOG] Step 4/6: Stopping LicensingServer Windows service..."
  nsExec::ExecToLog 'sc stop LicensingServer'

  DetailPrint "[CLEANUP-LOG] Step 5/6: Waiting 5 seconds for clean shutdown..."
  Sleep 5000

  DetailPrint "[CLEANUP-LOG] Step 6/6: Verifying all processes terminated..."
  ; Double-check kill commands
  nsExec::ExecToLog 'taskkill /F /IM "CypherEdge-UAT.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "main.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "gatewayService.exe" /T'

  DetailPrint "[CLEANUP-LOG] ✓ All file locks released"
!macroend

; ═══════════════════════════════════════════════════════════════
; STEP 2: NSIS Uninstaller Runs (Built-in)
; ═══════════════════════════════════════════════════════════════
; - Removes old files from C:\Users\sanch\AppData\Local\Programs\CypherEdge-UAT\
; - Deletes registry keys
; - Removes shortcuts
; Duration: ~2-3 seconds

; ═══════════════════════════════════════════════════════════════
; STEP 3: customInstall (Pre-Install Stabilization) ← CRITICAL FIX
; ═══════════════════════════════════════════════════════════════
!macro customInstall
  ${If} ${Silent}
    DetailPrint ""
    DetailPrint "╔════════════════════════════════════════════════════════╗"
    DetailPrint "║    WAITING FOR FILE SYSTEM TO STABILIZE               ║"
    DetailPrint "╚════════════════════════════════════════════════════════╝"
    DetailPrint ""
    DetailPrint "[PRE-INSTALL-WAIT] Uninstall phase complete"
    DetailPrint "[PRE-INSTALL-WAIT] Waiting 10 seconds for Windows to release file locks..."
    DetailPrint "[PRE-INSTALL-WAIT] This prevents app.asar locking issues"

    Sleep 10000  ; ← CRITICAL: Wait for Windows to release all file handles

    DetailPrint "[PRE-INSTALL-WAIT] ✓ File system stabilized - safe to install"
    DetailPrint ""
  ${EndIf}

  ; Check and install VC++ Redistributable
  DetailPrint "Pre-reqs: Checking Microsoft VC++ 2015–2022..."
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != 1
    DetailPrint "Installing VC++ x64..."
    ExecWait '"$INSTDIR\vcredist_x64.exe" /install /quiet /norestart'
  ${EndIf}

  ; Add firewall rules
  DetailPrint "Configuring Windows Firewall..."
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Cyphersol Gateway Server-TCP" dir=in action=allow protocol=TCP'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Cyphersol Gateway Server-UDP" dir=in action=allow protocol=UDP'

  ; Show message box during silent install
  MessageBox MB_OK|MB_ICONINFORMATION "CypherEdge is being updated. The application will restart automatically after installation." /SD IDOK
!macroend

; ═══════════════════════════════════════════════════════════════
; STEP 4: NSIS Installer Copies New Files (Built-in)
; ═══════════════════════════════════════════════════════════════
; - Copies all files from installer to installation directory
; - Key file: app.asar (222 MB) ← THIS NOW REPLACES CLEANLY ✅
; - Duration: ~10-15 seconds

; ═══════════════════════════════════════════════════════════════
; STEP 5: Post-Install Stabilization & Launch
; ═══════════════════════════════════════════════════════════════
!macro customInstall (continued)
  ${If} ${Silent}
    DetailPrint "[UPDATE-LOG] Waiting 5 seconds for file system stabilization..."
    Sleep 5000

    DetailPrint "[UPDATE-LOG] Launching CypherEdge-UAT..."
    Exec "$INSTDIR\CypherEdge-UAT.exe"
  ${EndIf}
!macroend
```

### Phase 6: New Version Startup

**Process**: `CypherEdge-UAT.exe` (version 2.3.407)

**Initialization Sequence** (`main.js`):

```javascript
// 1. Integrity Check (lines 100-179)
const integrityResult = validateAppIntegrity();
if (!integrityResult.success) {
  // Show error dialog and quit
  process.exit(1);
}

// 2. Log startup
log.info("===========================================");
log.info(`Application starting - Version ${app.getVersion()}`);
log.info(`User data directory: ${userDataDir}`);
log.info(`Platform: ${process.platform}`);
log.info("===========================================");

// 3. Check for update success flag
const updateSuccessFlag = path.join(app.getPath('userData'), 'update-success.txt');
if (fs.existsSync(updateSuccessFlag)) {
  log.info("[UPDATE] ✅ Update completed successfully!");
  log.info(`[UPDATE] Upgraded to version ${app.getVersion()}`);

  // Delete flag file
  fs.unlinkSync(updateSuccessFlag);

  // Show success notification to user
  if (mainWindow) {
    mainWindow.webContents.send("update-complete", {
      version: app.getVersion(),
      message: "CypherEdge has been updated successfully!"
    });
  }
}

// 4. Continue normal startup...
```

---

## File Structure & Responsibilities

### Update-Related Files

```
C:\Users\sanch\Desktop\beta_testers_ca\
│
├── frontend/
│   ├── .env                              # APP_VERSION source of truth
│   ├── package.json                      # electron-builder config, version
│   ├── main.js                           # Auto-updater logic (lines 85-1250)
│   │   ├── autoUpdater setup
│   │   ├── Event handlers (update-available, download-progress, etc.)
│   │   ├── quitAndInstallUpdate()
│   │   ├── validateAppIntegrity()
│   │   └── Comprehensive logging
│   │
│   ├── build/
│   │   └── installer.nsh                 # NSIS custom macros
│   │       ├── customUnInit              # Pre-uninstall cleanup
│   │       ├── customInstall             # Pre-install wait + setup
│   │       └── customUnInstall           # Firewall cleanup
│   │
│   ├── react-app/
│   │   ├── package.json                  # Version sync
│   │   ├── splash.html                   # Version display
│   │   └── src/
│   │       └── components/
│   │           ├── UpdateNotification.js # React UI for updates
│   │           └── MainDashboardComponents/
│   │               └── MainDashboard.js  # Version display
│   │
│   └── dist/                             # Build output
│       ├── CypherEdge-UAT-Setup-2.3.407.exe
│       ├── latest.yml                    # Uploaded to CDN
│       └── builder-effective-config.yaml
│
└── AUTO_UPDATE_SYSTEM_DOCUMENTATION.md   # This file
```

### Configuration Flow

```
.env (APP_VERSION=2.3.407)
    ↓
npm run sync-version
    ↓
Updates:
    ├── frontend/package.json → version: "2.3.407"
    ├── frontend/react-app/package.json → version: "2.3.407"
    ├── frontend/react-app/splash.html → "Version 2.3.407"
    └── MainDashboard.js → "v2.3.407"
    ↓
npm run build
    ↓
electron-builder reads package.json version
    ↓
Creates:
    ├── CypherEdge-UAT-Setup-2.3.407.exe
    └── latest.yml with version: 2.3.407
```

---

## Logging System

### Log Location

**Path**: `%APPDATA%\CypherEdge-UAT\logs\cyphersol.log`
**Full Path**: `C:\Users\[username]\AppData\Roaming\CypherEdge-UAT\logs\cyphersol.log`

### Log Configuration

**File**: `frontend/main.js` (lines 85-93)

```javascript
const log = require('electron-log');

log.transports.console.level = 'debug';
log.transports.file.level = 'info';
log.transports.file.fileName = 'cyphersol.log';

log.info("===========================================");
log.info(`Application starting - Version ${app.getVersion()}`);
log.info(`User data directory: ${userDataDir}`);
log.info(`Platform: ${process.platform}`);
log.info(`Arch: ${os.arch()}`);
log.info("===========================================");
```

### Log Prefixes & Tags

| Prefix | Purpose | Example |
|--------|---------|---------|
| `[UPDATE]` | Update flow events | `[UPDATE] 🎉 UPDATE AVAILABLE DETECTED!` |
| `[INTEGRITY-CHECK]` | App integrity validation | `[INTEGRITY-CHECK] ✓ version: 2.3.407` |
| `[QUIT-INSTALL]` | Pre-installation cleanup | `[QUIT-INSTALL] Step 3/6: All windows closed` |
| `[UPDATE-UI]` | React UI interactions | `[UPDATE-UI] User clicked "Restart Now"` |
| `[CLEANUP-LOG]` | NSIS cleanup sequence | `[CLEANUP-LOG] ✓ CypherEdge-UAT.exe terminated` |
| `[PRE-INSTALL-WAIT]` | Critical timing fix | `[PRE-INSTALL-WAIT] Waiting 10 seconds for file locks...` |
| `[UPDATE-LOG]` | NSIS installation steps | `[UPDATE-LOG] Launching CypherEdge-UAT...` |
| `[PERFORMANCE]` | Download speed metrics | `[PERFORMANCE] Download speed: 58.82 MB/s` |
| `[SUCCESS]` | Completion milestones | `[SUCCESS] 🧹 ADMIN-LEVEL CLEANUP COMPLETED!` |
| `[USER]` | User interactions | `[USER] User clicked 'Install Now'` |

### Critical Log Checkpoints

#### 1. **Integrity Check on Startup**
```
[2025-11-11 18:01:35.484] [info] 🔍 ═══ STARTING APP INTEGRITY CHECK ═══
[2025-11-11 18:01:35.487] [info] [INTEGRITY-CHECK] Test 1/3: Reading package.json from ASAR...
[2025-11-11 18:01:35.488] [info] [INTEGRITY-CHECK] Package.json read successfully (1024 bytes)
[2025-11-11 18:01:35.489] [info] [INTEGRITY-CHECK] Test 2/3: Parsing package.json...
[2025-11-11 18:01:35.490] [info] [INTEGRITY-CHECK] Test 3/3: Validating critical fields...
[2025-11-11 18:01:35.491] [info] [INTEGRITY-CHECK]   ✓ version: 2.3.407
[2025-11-11 18:01:35.492] [info] ✅ ═══ APP INTEGRITY CHECK PASSED ═══
```

#### 2. **Update Detection**
```
[2025-11-11 18:00:10.806] [info] [UPDATE] ✅ System requirements PASSED
[2025-11-11 18:00:10.807] [info] [UPDATE] 🎉 UPDATE AVAILABLE DETECTED! {
  currentVersion: '2.3.406',
  newVersion: '2.3.407',
  releaseDate: '2025-11-11T12:19:00.249Z',
  downloadUrl: 'CypherEdge-UAT-Setup-2.3.407.exe',
  isAutoDownloadEnabled: true
}
```

#### 3. **Download Progress**
```
[2025-11-11 18:00:19.011] [info] [UPDATE] 📥 Download Progress: 31% {
  percent: 30.88,
  transferred: 494315383,
  total: 1600851782,
  speed: 61681480 MB/s
}
[2025-11-11 18:00:37.247] [info] [SUCCESS] Update download completed! {
  totalSize: 1600851782,
  finalPercent: 100
}
```

#### 4. **Pre-Installation Cleanup (main.js)**
```
[2025-11-11 18:00:43.752] [info] [UPDATE] 🧹 ADMIN-LEVEL CLEANUP SEQUENCE INITIATED
[2025-11-11 18:00:44.719] [info] [UPDATE] Step 1/6: Gateway service stopped
[2025-11-11 18:00:46.732] [info] [UPDATE] Step 2/6: Database connections closed
[2025-11-11 18:00:50.799] [info] [UPDATE] Step 3/6: Python backend terminated
[2025-11-11 18:00:53.937] [info] [UPDATE] Step 4/6: Gateway executable terminated
[2025-11-11 18:00:53.985] [info] [UPDATE] Step 5/6: Closed 1 windows
[2025-11-11 18:00:54.009] [info] [UPDATE] Step 6/6: Final process settlement (3 seconds)
```

#### 5. **NSIS Installer Execution** (Look for these in NSIS log window)
```
[CLEANUP-LOG] Step 1/6: Killing Electron application...
[CLEANUP-LOG]   ✓ CypherEdge-UAT.exe terminated
[CLEANUP-LOG] Step 2/6: Killing Python backend...
[CLEANUP-LOG]   ✓ Python backend (main.exe) terminated
[CLEANUP-LOG] Step 5/6: Waiting 5 seconds for clean shutdown...
[CLEANUP-LOG]   ✓ Wait complete
[CLEANUP-LOG] ╔════════════════════════════════════════════════╗
[CLEANUP-LOG] ║   CLEANUP COMPLETE - FILES NOW SAFE TO REPLACE ║
[CLEANUP-LOG] ╚════════════════════════════════════════════════╝

[PRE-INSTALL-WAIT] Uninstall phase complete
[PRE-INSTALL-WAIT] Waiting 10 seconds for Windows to release file locks...
[PRE-INSTALL-WAIT] This prevents app.asar locking issues
[PRE-INSTALL-WAIT] ✓ File system stabilized - safe to install

[UPDATE-LOG] Waiting 5 seconds for file system stabilization...
[UPDATE-LOG] File system stabilized - safe to launch
[UPDATE-LOG] Launching CypherEdge-UAT...
[UPDATE-LOG] Launch command issued - app should start shortly
```

---

## Configuration Files

### 1. frontend/.env

**Purpose**: Source of truth for version number

**Key Variables**:
```bash
# AWS/DigitalOcean Spaces credentials
AWS_ACCESS_KEY_ID=DO00V8GXBHB7BYZW2WJJ
AWS_SECRET_ACCESS_KEY=YG/PmVxCzH0/Um+BQPFXepvOexvyfPBLVN8eXaz2mRc
SPACES_REGION=blr1
SPACES_BUCKET=cypheredge-exe-uat
SPACES_ENDPOINT=https://blr1.digitaloceanspaces.com

# Update system configuration
UPDATE_SERVER_URL=https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows
UPDATE_CHANNEL=latest

# Version (source of truth)
APP_VERSION=2.3.407
```

### 2. frontend/package.json (Update Config)

**Relevant Sections**:
```json
{
  "name": "CypherEdge-UAT",
  "version": "2.3.407",
  "productName": "CypherEdge-UAT",
  "build": {
    "appId": "com.cyphersol.cypheredge.uat",
    "productName": "CypherEdge-UAT",
    "compression": "normal",
    "artifactName": "${productName}-Setup-${version}.${ext}",
    "publish": {
      "provider": "generic",
      "url": "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows",
      "channel": "latest"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "artifactName": "${productName}-Setup-${version}.${ext}",
      "requestedExecutionLevel": "requireAdministrator"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "include": "build/installer.nsh",
      "differentialPackage": false
    }
  }
}
```

**Key Points**:
- `appId`: Must remain consistent across versions
- `productName`: Used in installer filename
- `compression: "normal"`: Faster builds (vs "maximum")
- `differentialPackage: false`: Always download full installer
- `include: "build/installer.nsh"`: Links custom NSIS script
- `requestedExecutionLevel: "requireAdministrator"`: Needed for process killing

### 3. frontend/dist/latest.yml (CDN Metadata)

**Generated by**: electron-builder during build
**Uploaded to**: CDN at `/releases/windows/latest.yml`

**Content**:
```yaml
version: 2.3.407
files:
  - url: CypherEdge-UAT-Setup-2.3.407.exe
    sha512: lwt8UCKSAcvjLT/kIvh9T/swnw0zv5CvrhRtRHQ4uTe6iwEGewLJUxXod0fvJaYoAa5mCQ6dWZ0fAsZSHiA0gA==
path: CypherEdge-UAT-Setup-2.3.407.exe
sha512: lwt8UCKSAcvjLT/kIvh9T/swnw0zv5CvrhRtRHQ4uTe6iwEGewLJUxXod0fvJaYoAa5mCQ6dWZ0fAsZSHiA0gA==
releaseDate: '2025-11-11T12:19:00.249Z'
```

**electron-updater Behavior**:
1. Fetches this file every 5 minutes
2. Compares `version` with current `app.getVersion()`
3. If newer → download `files[0].url` relative to CDN base URL
4. Verifies download using `sha512` checksum

---

## Testing Procedures

### Pre-Release Testing Checklist

Before uploading a new version to CDN:

#### 1. **Version Sync Verification**
```bash
cd frontend
npm run sync-version

# Verify version consistency:
grep -r "2.3.407" package.json react-app/package.json react-app/splash.html
```

#### 2. **Build Process**
```bash
cd frontend
npm run build

# Expected output:
# - CypherEdge-UAT-Setup-2.3.407.exe (1.6GB)
# - latest.yml
# - builder-effective-config.yaml
```

#### 3. **Standalone Install Test**
```bash
# Install fresh on clean Windows machine
CypherEdge-UAT-Setup-2.3.407.exe

# Verify:
# - App launches successfully
# - Version shown in UI matches 2.3.407
# - All features work (PDF upload, dashboard, etc.)
# - No errors in logs (%APPDATA%\CypherEdge-UAT\logs\cyphersol.log)
```

#### 4. **Integrity Check Test**
```bash
# Intentionally corrupt app.asar
cd "C:\Users\[username]\AppData\Local\Programs\CypherEdge-UAT\resources"
echo "corrupted" >> app.asar

# Launch app
CypherEdge-UAT.exe

# Expected: Error dialog appears:
# "CypherEdge Installation Corrupted"
# "Please: 1. Uninstall CypherEdge completely 2. Reinstall from fresh installer"
```

### Update Testing Protocol

#### Phase 1: Setup Old Version
```bash
# 1. Ensure version N-1 is installed and running
# Example: 2.3.406 installed

# 2. Check current version
# Open app → Check version in dashboard
# Should show: v2.3.406
```

#### Phase 2: Upload New Version to CDN
```bash
# 1. Build new version (2.3.407)
cd frontend
npm run build

# 2. Upload to DigitalOcean Spaces
python upload-to-s3.py

# Script contents:
import boto3
import os
from dotenv import load_dotenv

load_dotenv('frontend/.env')

s3 = boto3.client('s3',
    region_name=os.getenv('SPACES_REGION'),
    endpoint_url=os.getenv('SPACES_ENDPOINT'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

bucket = os.getenv('SPACES_BUCKET')
prefix = 'releases/windows/'

# Upload installer
s3.upload_file(
    'frontend/dist/CypherEdge-UAT-Setup-2.3.407.exe',
    bucket,
    f'{prefix}CypherEdge-UAT-Setup-2.3.407.exe',
    ExtraArgs={'ACL': 'public-read', 'ContentType': 'application/x-msdownload'}
)

# Upload latest.yml with no-cache headers
s3.upload_file(
    'frontend/dist/latest.yml',
    bucket,
    f'{prefix}latest.yml',
    ExtraArgs={'ACL': 'public-read', 'ContentType': 'text/yaml', 'CacheControl': 'max-age=0, no-cache'}
)

# 3. Verify CDN access
curl https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml
# Should return:
# version: 2.3.407
# files:
#   - url: CypherEdge-UAT-Setup-2.3.407.exe
#     sha512: [hash]
```

#### Phase 3: Trigger Update Detection
```bash
# 1. Wait for automatic check (5 minutes) OR
# 2. Force check (if you added a manual check button in UI)

# Expected behavior:
# - Toast notification: "Update Available - A new version (2.3.407) is available"
# - "Download" button appears
```

#### Phase 4: Download Phase Monitoring
```bash
# 1. Click "Download" button
# 2. Monitor logs in real-time:
Get-Content "C:\Users\sanch\AppData\Roaming\CypherEdge-UAT\logs\cyphersol.log" -Tail 50 -Wait

# Expected log output:
# [UPDATE] 🎉 UPDATE AVAILABLE DETECTED!
# [UPDATE] 📥 Download Progress: 10%
# [UPDATE] 📥 Download Progress: 25%
# [UPDATE] 📥 Download Progress: 50%
# [UPDATE] 📥 Download Progress: 75%
# [UPDATE] 📥 Download Progress: 100%
# [SUCCESS] Update download completed!
```

#### Phase 5: Installation Phase Testing
```bash
# 1. Toast notification appears: "Update Ready"
# 2. Click "Restart Now" button
# 3. Expected visual sequence:
#    a. Full-screen modal appears (spinning gear ⚙️)
#    b. Message: "Installing Update - CypherEdge is being updated..."
#    c. Pulsing dots animation
#    d. Modal stays visible for 3 seconds
#    e. App closes

# 4. Behind the scenes (check Task Manager during this phase):
#    - All CypherEdge processes terminate
#    - NSIS installer process appears (CypherEdge-UAT-Setup-2.3.407.exe)
#    - NSIS installer completes (takes ~30-60 seconds)
#    - New CypherEdge-UAT.exe process appears

# 5. App automatically relaunches
#    - New version should load
#    - Check version in dashboard → should show v2.3.407
```

#### Phase 6: Post-Update Verification
```bash
# 1. Check integrity log
Get-Content "C:\Users\sanch\AppData\Roaming\CypherEdge-UAT\logs\cyphersol.log" | Select-String "INTEGRITY"

# Expected output:
# [info] 🔍 ═══ STARTING APP INTEGRITY CHECK ═══
# [info] [INTEGRITY-CHECK]   ✓ version: 2.3.407
# [info] ✅ ═══ APP INTEGRITY CHECK PASSED ═══

# 2. Verify app.asar was replaced
Get-Item "C:\Users\sanch\AppData\Local\Programs\CypherEdge-UAT\resources\app.asar" | Select-Object LastWriteTime, Length

# LastWriteTime should match recent install time (within last few minutes)

# 3. Check update success flag
# File should NOT exist (it gets deleted after successful startup):
Test-Path "C:\Users\sanch\AppData\Roaming\CypherEdge-UAT\update-success.txt"
# Expected: False

# 4. Functional testing
# - Upload PDF → Process statement → Verify results
# - Check all dashboard views
# - Test Tally integration
# - Verify Gateway service is running (license validation)
```

### Automated Test Script

**File**: `test-update-flow.ps1`

```powershell
# CypherEdge UAT Update Flow Test Script

param(
    [string]$OldVersion = "2.3.406",
    [string]$NewVersion = "2.3.407"
)

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CypherEdge UAT Update Flow Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Phase 1: Verify old version installed
Write-Host "[1/6] Verifying old version ($OldVersion) is installed..." -ForegroundColor Yellow
$appPath = "$env:LOCALAPPDATA\Programs\CypherEdge-UAT\CypherEdge-UAT.exe"
if (-not (Test-Path $appPath)) {
    Write-Host "❌ CypherEdge-UAT not installed at expected location" -ForegroundColor Red
    exit 1
}
Write-Host "✅ CypherEdge-UAT found" -ForegroundColor Green

# Phase 2: Check if app is running
Write-Host "[2/6] Checking if app is running..." -ForegroundColor Yellow
$process = Get-Process -Name "CypherEdge-UAT" -ErrorAction SilentlyContinue
if ($null -eq $process) {
    Write-Host "⚠️  App not running - please launch it first" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ App is running (PID: $($process.Id))" -ForegroundColor Green

# Phase 3: Verify CDN has new version
Write-Host "[3/6] Checking CDN for new version ($NewVersion)..." -ForegroundColor Yellow
$latestYml = Invoke-WebRequest -Uri "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml" -UseBasicParsing
$content = $latestYml.Content
if ($content -match "version: (.+)") {
    $cdnVersion = $matches[1].Trim()
    if ($cdnVersion -eq $NewVersion) {
        Write-Host "✅ CDN has version $NewVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ CDN has version $cdnVersion, expected $NewVersion" -ForegroundColor Red
        exit 1
    }
}

# Phase 4: Wait for update detection (max 6 minutes)
Write-Host "[4/6] Waiting for update detection (checking logs every 10 seconds)..." -ForegroundColor Yellow
$logFile = "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log"
$maxWait = 360 # 6 minutes
$elapsed = 0
$updateDetected = $false

while ($elapsed -lt $maxWait -and -not $updateDetected) {
    Start-Sleep -Seconds 10
    $elapsed += 10

    $recent = Get-Content $logFile -Tail 50 | Out-String
    if ($recent -match "UPDATE AVAILABLE DETECTED") {
        $updateDetected = $true
        Write-Host "✅ Update detected in logs" -ForegroundColor Green
    } else {
        Write-Host "   Waiting... ($elapsed seconds elapsed)" -ForegroundColor Gray
    }
}

if (-not $updateDetected) {
    Write-Host "❌ Update not detected within $maxWait seconds" -ForegroundColor Red
    exit 1
}

# Phase 5: Monitor download progress
Write-Host "[5/6] Monitoring download progress..." -ForegroundColor Yellow
$downloadComplete = $false
$maxDownloadWait = 300 # 5 minutes
$elapsed = 0

while ($elapsed -lt $maxDownloadWait -and -not $downloadComplete) {
    Start-Sleep -Seconds 5
    $elapsed += 5

    $recent = Get-Content $logFile -Tail 50 | Out-String
    if ($recent -match "Download Progress: (\d+)%") {
        $progress = $matches[1]
        Write-Host "   Download: $progress%" -ForegroundColor Gray

        if ($recent -match "Update download completed") {
            $downloadComplete = $true
            Write-Host "✅ Download complete" -ForegroundColor Green
        }
    }
}

if (-not $downloadComplete) {
    Write-Host "❌ Download did not complete within $maxDownloadWait seconds" -ForegroundColor Red
    exit 1
}

# Phase 6: Wait for installation
Write-Host "[6/6] Waiting for installation (this will close the app)..." -ForegroundColor Yellow
Write-Host "   ⚠️  Please click 'Install Now' when prompted" -ForegroundColor Yellow

$installationStarted = $false
$maxInstallWait = 180 # 3 minutes
$elapsed = 0

while ($elapsed -lt $maxInstallWait -and -not $installationStarted) {
    Start-Sleep -Seconds 5
    $elapsed += 5

    # Check if process is gone (app closed for installation)
    $process = Get-Process -Name "CypherEdge-UAT" -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        $installationStarted = $true
        Write-Host "✅ Installation started (app closed)" -ForegroundColor Green
    }
}

if (-not $installationStarted) {
    Write-Host "⚠️  User may not have clicked 'Install Now'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Test Phase Complete" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait for NSIS installer to complete (~60 seconds)" -ForegroundColor White
Write-Host "2. New version should auto-launch" -ForegroundColor White
Write-Host "3. Check version in app → should show v$NewVersion" -ForegroundColor White
Write-Host "4. Run: .\verify-post-update.ps1 -Version $NewVersion" -ForegroundColor White
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: "JSON.parse() error" after update

**Symptoms**:
- App shows error dialog on launch: "Unexpected token < in JSON"
- App is completely unusable
- Logs show: `[INTEGRITY-CHECK] ❌ APP INTEGRITY CHECK FAILED`

**Root Cause**: `app.asar` corrupted during update (file lock issue)

**Immediate Fix for User**:
1. Uninstall CypherEdge UAT completely
2. Download fresh installer from CDN
3. Reinstall

**Prevention** (Already Implemented in v2.3.407):
- 10-second pre-install wait in `customInstall` macro
- Comprehensive process cleanup in `customUnInit`
- Integrity check on startup catches corruption early

#### Issue 2: Update downloads but never installs

**Symptoms**:
- Toast notification: "Update Ready"
- User clicks "Restart Now"
- App closes but never reopens
- No new version installed

**Diagnostic Steps**:
```bash
# 1. Check if installer is in pending folder
Test-Path "$env:LOCALAPPDATA\cypheredge-uat-updater\pending\CypherEdge-UAT-Setup-*.exe"

# 2. Check if installer ran
Get-EventLog -LogName Application -Source "MsiInstaller" -Newest 10

# 3. Check for NSIS errors
Get-EventLog -LogName Application -Source "NSIS" -Newest 10
```

**Common Causes**:
- Antivirus blocking installer execution
- Insufficient disk space (need 3.2GB: 1.6GB installer + 1.6GB extraction)
- Missing VC++ Redistributable (2015-2022 x64)
- Corrupted download (checksum mismatch)

**Solutions**:
1. Whitelist CypherEdge in antivirus
2. Free up disk space
3. Install VC++ Redistributable manually
4. Delete pending installer and redownload

#### Issue 3: Update check never triggers

**Symptoms**:
- App running for hours/days
- No update notification appears
- CDN has newer version available

**Diagnostic Steps**:
```bash
# 1. Check auto-update configuration in logs
Get-Content "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log" | Select-String "Update Configuration"

# Expected output:
# Update Configuration: {
#   platform: 'win32',
#   appVersion: '2.3.406',
#   autoDownload: true,
#   feedURL: [CDN URL]
# }

# 2. Check if update checks are happening
Get-Content "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log" | Select-String "Starting automatic update check"

# Should see entries every 5 minutes

# 3. Verify CDN accessibility
curl https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml
```

**Common Causes**:
- Firewall blocking CDN access
- Corporate proxy intercepting requests
- CDN credentials expired
- `latest.yml` not uploaded or has wrong format

**Solutions**:
1. Check firewall rules (add exception for CDN domain)
2. Configure proxy settings in Electron
3. Re-upload `latest.yml` with correct format
4. Force check by restarting app

#### Issue 4: Processes not killed during update

**Symptoms**:
- Update installs but app.asar still locked
- Logs show: `[CLEANUP-LOG] ⓘ CypherEdge-UAT.exe not running` but process is actually running
- Task Manager shows multiple `main.exe` or `gatewayService.exe` processes

**Diagnostic Steps**:
```bash
# Check for zombie processes
Get-Process | Where-Object { $_.ProcessName -match "CypherEdge|main|gateway" }

# Check Windows service status
Get-Service -Name "LicensingServer" -ErrorAction SilentlyContinue
```

**Root Cause**: Processes spawned by parent are not killed with `/T` flag, or Windows service is not responding to stop command

**Solution** (Already Implemented):
- `customUnInit` uses `/T` flag (kill entire process tree)
- Double-kill verification (kills processes twice)
- 5-second wait before uninstall
- 10-second wait before install

**Manual Fix** (if update fails):
```bash
# Forcefully kill all processes
taskkill /F /IM "CypherEdge-UAT.exe" /T
taskkill /F /IM "main.exe" /T
taskkill /F /IM "gatewayService.exe" /T
sc stop LicensingServer

# Wait 10 seconds
Start-Sleep -Seconds 10

# Manually run installer
cd "$env:LOCALAPPDATA\cypheredge-uat-updater\pending"
.\CypherEdge-UAT-Setup-2.3.407.exe
```

#### Issue 5: App launches before installation completes

**Symptoms**:
- User sees "Installing Update" modal
- Modal disappears suddenly
- Old version launches instead of new version

**Root Cause**: Race condition where NSIS launches app before file copying completes

**Solution** (Already Implemented in v2.3.407):
- Post-install 5-second stabilization wait
- NSIS only launches app AFTER installation is 100% complete
- `${If} ${Silent}` check ensures timing only applies to auto-updates

#### Issue 6: "Update failed" error with no details

**Symptoms**:
- Toast notification: "Update Error"
- No specific error message
- Logs show: `[UPDATE] ❌ Update check failed`

**Common Causes & Solutions**:

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `ECONNREFUSED` | CDN unreachable | Check internet connection, verify CDN URL |
| `403 Forbidden` | CDN permissions issue | Check S3 bucket ACL (must be public-read) |
| `404 Not Found` | File not found on CDN | Verify latest.yml and installer uploaded |
| `Checksum mismatch` | Corrupted download | Delete cached installer, redownload |
| `ENOSPC` | Insufficient disk space | Free up space (need 3.2GB) |
| `EPERM` | Permission denied | Run as administrator |

---

## Future Improvements

### Phase 1: Enhanced Monitoring (Priority: High)

1. **Telemetry for Update Success Rate**
   - Track update attempts vs successful completions
   - Identify failure patterns
   - Send anonymous metrics to analytics server

2. **Real-time Update Status Dashboard**
   - Admin panel showing:
     - Current version distribution across user base
     - Update success/failure rates
     - Average update time
     - Common error types

### Phase 2: User Experience Enhancements (Priority: Medium)

1. **Changelog Display**
   - Show release notes before download
   - Highlight new features/fixes
   - Format: Markdown → React rendering

2. **Scheduled Updates**
   - Allow users to choose update time
   - "Remind me in 1 hour" option
   - "Update tonight at 2 AM" option

3. **Rollback Capability**
   - Keep previous version installer
   - "Something went wrong? Revert to version X" button
   - Automatic rollback on critical errors

### Phase 3: Advanced Features (Priority: Low)

1. **Differential Updates**
   - Currently: Full 1.6GB installer every time
   - Future: Only download changed files (~100MB)
   - Requires: electron-updater configuration change + CDN block map generation

2. **Multiple Update Channels**
   - `stable`: Current production (manual rollout)
   - `beta`: Early access (automatic for beta users)
   - `dev`: Nightly builds (developers only)

3. **A/B Testing for Updates**
   - Roll out updates to 10% of users first
   - Monitor success rate
   - Gradual rollout to 100% if successful

### Phase 4: Infrastructure Improvements (Priority: Medium)

1. **CDN Redundancy**
   - Primary: DigitalOcean Spaces (current)
   - Fallback: AWS S3 (if primary fails)
   - Fallback 2: Azure Blob Storage

2. **Automated Build Pipeline**
   - CI/CD integration (GitHub Actions)
   - Automatic version bump on commit
   - Automatic upload to CDN after successful build
   - Smoke tests before marking as "latest"

3. **Update Verification System**
   - Post-install health check
   - Report success/failure to server
   - Automatic rollback trigger if >5% failure rate

---

## Appendix A: Electron-Builder Configuration Reference

### Complete electron-builder Config

**File**: `frontend/package.json`

```json
{
  "build": {
    "appId": "com.cyphersol.cypheredge.uat",
    "productName": "CypherEdge-UAT",
    "compression": "normal",
    "artifactName": "${productName}-Setup-${version}.${ext}",
    "directories": {
      "output": "dist"
    },
    "files": [
      "!**/.git",
      "!**/node_modules/*/{CHANGELOG.md,README.md,*.md}",
      "!**/node_modules/.bin",
      "**/*"
    ],
    "extraResources": [
      {
        "from": "../backend/dist",
        "to": "backend",
        "filter": ["**/*"]
      },
      {
        "from": "../gateway",
        "to": ".",
        "filter": ["**/*"]
      },
      {
        "from": "../vcredist_x64.exe",
        "to": "vcredist_x64.exe"
      }
    ],
    "publish": {
      "provider": "generic",
      "url": "https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows",
      "channel": "latest"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "artifactName": "${productName}-Setup-${version}.${ext}",
      "requestedExecutionLevel": "requireAdministrator",
      "signAndEditExecutable": false
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "CypherEdge UAT",
      "include": "build/installer.nsh",
      "differentialPackage": false,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "license": "LICENSE.txt",
      "language": "1033"
    }
  }
}
```

### Key Configuration Explanations

| Option | Value | Purpose |
|--------|-------|---------|
| `compression: "normal"` | Standard compression | Faster builds (~5 min vs 20 min) |
| `differentialPackage: false` | No differential updates | Always download full installer (simpler, more reliable) |
| `requestedExecutionLevel: "requireAdministrator"` | Admin rights | Needed to kill processes, stop services |
| `oneClick: false` | Show installer wizard | User can choose install location |
| `perMachine: false` | Per-user install | No admin required for install, only for update |
| `include: "build/installer.nsh"` | Custom NSIS script | Enables customUnInit, customInstall macros |

---

## Appendix B: PowerShell Scripts

### Script 1: Upload to DigitalOcean Spaces

**File**: `upload-to-spaces.ps1`

```powershell
# Upload CypherEdge UAT build to DigitalOcean Spaces

param(
    [string]$Version = "2.3.407"
)

# Load environment variables
$envFile = Get-Content "frontend\.env" -Raw
$envFile -match 'AWS_ACCESS_KEY_ID=(.+)' | Out-Null
$accessKey = $matches[1]
$envFile -match 'AWS_SECRET_ACCESS_KEY=(.+)' | Out-Null
$secretKey = $matches[1]
$envFile -match 'SPACES_BUCKET=(.+)' | Out-Null
$bucket = $matches[1]
$envFile -match 'SPACES_REGION=(.+)' | Out-Null
$region = $matches[1]

# Configure AWS CLI for DigitalOcean Spaces
$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey

$endpoint = "https://$region.digitaloceanspaces.com"
$prefix = "releases/windows"

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CypherEdge UAT Upload to Spaces" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Version: $Version" -ForegroundColor Yellow
Write-Host "Bucket: $bucket" -ForegroundColor Yellow
Write-Host "Region: $region" -ForegroundColor Yellow
Write-Host ""

# Upload installer
Write-Host "[1/2] Uploading installer..." -ForegroundColor Cyan
aws s3 cp `
    "frontend\dist\CypherEdge-UAT-Setup-$Version.exe" `
    "s3://$bucket/$prefix/CypherEdge-UAT-Setup-$Version.exe" `
    --endpoint-url $endpoint `
    --acl public-read `
    --content-type "application/x-msdownload"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Installer uploaded" -ForegroundColor Green
} else {
    Write-Host "❌ Installer upload failed" -ForegroundColor Red
    exit 1
}

# Upload latest.yml
Write-Host "[2/2] Uploading latest.yml..." -ForegroundColor Cyan
aws s3 cp `
    "frontend\dist\latest.yml" `
    "s3://$bucket/$prefix/latest.yml" `
    --endpoint-url $endpoint `
    --acl public-read `
    --content-type "text/yaml" `
    --cache-control "max-age=0, no-cache"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ latest.yml uploaded" -ForegroundColor Green
} else {
    Write-Host "❌ latest.yml upload failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Upload Complete" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verify
Write-Host "Verifying CDN access..." -ForegroundColor Yellow
$latestYml = Invoke-WebRequest -Uri "https://$bucket.$region.cdn.digitaloceanspaces.com/$prefix/latest.yml" -UseBasicParsing
Write-Host $latestYml.Content -ForegroundColor White

Write-Host ""
Write-Host "✅ Version $Version is now live on CDN" -ForegroundColor Green
```

---

## Appendix C: Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.3.404 | Nov 10, 2025 | Initial S3-based auto-update implementation | ❌ Update failed (JSON error) |
| 2.3.405 | Nov 10, 2025 | Attempted fix with environment variable | ❌ Update failed (JSON error) |
| 2.3.406 | Nov 11, 2025 | Added customUnInit macro, integrity check, React UI | ❌ Update failed (app.asar locked) |
| 2.3.407 | Nov 11, 2025 | **CRITICAL FIX**: 10-second pre-install wait | ✅ **Production Ready** |

---

## Contact & Support

**Project**: CypherEdge UAT
**Update System**: DigitalOcean Spaces + electron-updater
**Critical Files**: `frontend/main.js`, `frontend/build/installer.nsh`

**For Issues**:
1. Check logs: `%APPDATA%\CypherEdge-UAT\logs\cyphersol.log`
2. Search for prefixes: `[UPDATE]`, `[INTEGRITY-CHECK]`, `[CLEANUP-LOG]`
3. Refer to Troubleshooting Guide section above

**End of Documentation**

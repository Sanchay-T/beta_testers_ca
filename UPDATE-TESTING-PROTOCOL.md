# 🧪 CypherEdge Update System - Comprehensive Testing Protocol

## ✅ IMPLEMENTATION COMPLETE

All fixes have been implemented with comprehensive logging to trace the complete update flow.

---

## 📋 WHAT WAS IMPLEMENTED

### **1. NSIS Installer Enhancements** (installer.nsh)

#### ✅ customUnInit Macro (Lines 129-216)
**Purpose:** Kills ALL processes BEFORE uninstalling old version
**Prevents:** app.asar file locking → corruption → JSON parse errors

**What it does:**
1. Kills Electron app (CypherEdge-UAT.exe, CypherEdge.exe)
2. Kills Python backend (main.exe)
3. Kills Gateway service (gatewayService.exe)
4. Stops Windows service (LicensingServer)
5. Waits 5 seconds for clean shutdown
6. Double-checks all processes are dead

**Logging:** Detailed step-by-step logs with `[CLEANUP-LOG]` prefix

#### ✅ 5-Second Delay Before Launch (Lines 84-91)
**Purpose:** Prevents reading partially-written app.asar
**Prevents:** Race condition between file extraction and app launch

**What it does:**
- Waits 5 seconds after installation completes
- Gives Windows time to finalize NTFS writes
- Ensures app.asar is fully extracted before launch

**Logging:** `[UPDATE-LOG]` prefix showing file system stabilization

### **2. Integrity Check** (main.js Lines 100-179)

**Purpose:** Catches corrupted app.asar EARLY before cryptic errors
**Runs:** Immediately on app startup (before anything else)

**What it checks:**
1. Can read package.json from ASAR?
2. Can parse JSON successfully?
3. Does it have required fields (version, name, main)?

**If corruption detected:**
- Shows user-friendly error dialog
- Provides clear fix instructions
- Logs detailed error information
- Exits gracefully

**Logging:** `[INTEGRITY-CHECK]` prefix with 3-step validation

### **3. Enhanced Update Flow Logging** (main.js Lines 1145-1182)

**Purpose:** Trace EXACT sequence of events during update

**Logs every step:**
1. Pre-cleanup completion
2. Process termination
3. Window closing
4. Database closure
5. autoInstallOnAppQuit setting
6. quitAndInstall() parameters
7. Expected NSIS behavior

**Logging:** `[QUIT-INSTALL]` prefix with complete flow documentation

### **4. User Feedback Modal** (UpdateNotification.js)

**Purpose:** Show user what's happening (no black screen)

**User Experience:**
1. User clicks "Restart Now"
2. Full-screen modal appears (3 seconds)
3. Shows "Installing Update..." with spinning icon
4. Pulsing dots animation
5. Clear message about auto-restart

**Logging:** `[UPDATE-UI]` prefix in console

---

## 🚀 TESTING PROTOCOL - PHASE 1 (BUILD 405)

### **Step 1: Build Version 405**

```powershell
# Navigate to frontend directory
cd C:\Users\sanch\Desktop\beta_testers_ca\frontend

# Verify current version
cat .env | Select-String APP_VERSION
# Should show: APP_VERSION=2.3.405

# Build the application
npm run build

# Verify build output
ls dist\
# Should see:
# - CypherEdge-UAT-Setup-2.3.405.exe
# - latest.yml
# - other build artifacts
```

### **Step 2: Verify Build Integrity**

```powershell
# Check latest.yml content
cat dist\latest.yml
# Should show:
# version: 2.3.405
# files:
#   - url: CypherEdge-UAT-Setup-2.3.405.exe
#     sha512: [hash]
# path: CypherEdge-UAT-Setup-2.3.405.exe
```

### **Step 3: Clean Install of 405**

1. **Uninstall** any existing CypherEdge-UAT
   - Settings → Apps → CypherEdge-UAT → Uninstall

2. **Delete** AppData (fresh start)
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CypherEdge-UAT" -ErrorAction SilentlyContinue
   ```

3. **Install** 405
   - Run `dist\CypherEdge-UAT-Setup-2.3.405.exe`
   - Complete installation
   - Launch app

4. **Verify** 405 is running
   - Check Help → About
   - Should show: Version 2.3.405

5. **Check Integrity Logs**
   ```powershell
   # Open log file
   code "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log"

   # Look for these entries:
   # 🚀 Running startup integrity check...
   # 🔍 ═══ STARTING APP INTEGRITY CHECK ═══
   # [INTEGRITY-CHECK] Test 1/3: Reading package.json from ASAR...
   # [INTEGRITY-CHECK]   ✓ name: CypherEdge-UAT
   # [INTEGRITY-CHECK]   ✓ version: 2.3.405
   # ✅ ═══ APP INTEGRITY CHECK PASSED ═══
   ```

✅ **PHASE 1 CHECKPOINT:** 405 installed and running successfully

---

## 🔄 TESTING PROTOCOL - PHASE 2 (BUILD 406 & UPLOAD)

### **Step 4: Build Version 406**

```powershell
cd C:\Users\sanch\Desktop\beta_testers_ca

# Update version in .env
(Get-Content frontend\.env) -replace 'APP_VERSION=2.3.405', 'APP_VERSION=2.3.406' | Set-Content frontend\.env

# Verify change
cat frontend\.env | Select-String APP_VERSION
# Should show: APP_VERSION=2.3.406

# Build 406
cd frontend
npm run build

# Verify build
ls dist\CypherEdge-UAT-Setup-2.3.406.exe
cat dist\latest.yml  # Should show version: 2.3.406
```

### **Step 5: Upload 406 to S3**

```powershell
# Activate Python venv
cd C:\Users\sanch\Desktop\beta_testers_ca
.venv\Scripts\Activate.ps1

# Upload using your existing script or AWS CLI
python -c "
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
print('[UPLOAD] Uploading CypherEdge-UAT-Setup-2.3.406.exe...')
s3.upload_file(
    'frontend/dist/CypherEdge-UAT-Setup-2.3.406.exe',
    bucket,
    f'{prefix}CypherEdge-UAT-Setup-2.3.406.exe',
    ExtraArgs={'ACL': 'public-read', 'ContentType': 'application/x-msdownload'}
)
print('[UPLOAD] ✅ Installer uploaded')

# Upload latest.yml
print('[UPLOAD] Uploading latest.yml...')
s3.upload_file(
    'frontend/dist/latest.yml',
    bucket,
    f'{prefix}latest.yml',
    ExtraArgs={'ACL': 'public-read', 'ContentType': 'text/yaml', 'CacheControl': 'max-age=0, no-cache'}
)
print('[UPLOAD] ✅ latest.yml uploaded')
print('[UPLOAD] All files uploaded successfully!')
"
```

### **Step 6: Verify S3 Upload**

```powershell
# Check CDN URL
curl https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml

# Should return:
# version: 2.3.406
# files:
#   - url: CypherEdge-UAT-Setup-2.3.406.exe
#     sha512: [hash]
# path: CypherEdge-UAT-Setup-2.3.406.exe
```

✅ **PHASE 2 CHECKPOINT:** 406 built and uploaded to S3

---

## 🎯 TESTING PROTOCOL - PHASE 3 (TRIGGER UPDATE)

### **Step 7: Trigger Update in 405**

**Keep 405 Running! Don't close it!**

#### **Option A: Wait for Automatic Check (3 seconds)**
- App automatically checks for updates 3 seconds after launch
- Wait for toast notification: "Update Available"

#### **Option B: Manual Trigger (if impatient)**
1. Open Developer Tools: `Ctrl + Shift + I`
2. Console tab
3. Run: `window.electron.updates.checkForUpdates()`

### **Step 8: Monitor Update Detection**

**Watch Console Logs (Dev Tools):**
```
[UPDATE-LOG] Update check initiated
[UPDATE-LOG] Version upgrade path: 2.3.405 → 2.3.406
[UPDATE-LOG] Update available, starting download
```

**Watch Toast Notifications:**
1. **"Update Available"** → Shows version 2.3.406
2. **"Downloading Update"** → Progress bar appears (bottom-right)
3. **"Update Ready"** → Shows "Restart Now" button

### **Step 9: Trigger Installation**

1. **Click "Restart Now"** button in toast

2. **Observe Full-Screen Modal** (3 seconds)
   - Spinning gear icon
   - "Installing Update" message
   - Pulsing dots animation
   - "Please do not close this window"

3. **App Quits** (after 3 seconds)

4. **NSIS Installer Window Appears**
   - Should show installation details
   - Look for these logs:
   ```
   ╔════════════════════════════════════════════════════════╗
   ║     PRE-UNINSTALL PROCESS CLEANUP (customUnInit)      ║
   ╚════════════════════════════════════════════════════════╝

   [CLEANUP-LOG] Step 1/6: Killing Electron application...
   [CLEANUP-LOG]   ✓ CypherEdge-UAT.exe terminated

   [CLEANUP-LOG] Step 2/6: Killing Python backend...
   [CLEANUP-LOG]   ✓ Python backend (main.exe) terminated

   [CLEANUP-LOG] Step 3/6: Killing Gateway service...
   [CLEANUP-LOG]   ✓ Gateway service executable terminated

   [CLEANUP-LOG] Step 4/6: Stopping LicensingServer Windows service...
   [CLEANUP-LOG]   ✓ LicensingServer service stopped

   [CLEANUP-LOG] Step 5/6: Waiting 5 seconds for clean shutdown...
   [CLEANUP-LOG]   ✓ Wait complete

   [CLEANUP-LOG] Step 6/6: Verifying all processes terminated...
   [CLEANUP-LOG]   ✓ Verification complete

   ╔════════════════════════════════════════════════════════╗
   ║   CLEANUP COMPLETE - FILES NOW SAFE TO REPLACE        ║
   ╚════════════════════════════════════════════════════════╝
   ```

5. **Installation Proceeds**
   - Uninstalling old version
   - Installing new version
   - Configuring firewall rules

6. **Wait Period**
   ```
   [UPDATE-LOG] Waiting 5 seconds for file system stabilization...
   [UPDATE-LOG] This prevents ASAR corruption and ensures clean start
   [UPDATE-LOG] File system stabilized - safe to launch
   [UPDATE-LOG] Launching CypherEdge-UAT...
   ```

7. **App Auto-Launches**
   - Version 406 should start

---

## ✅ VERIFICATION CHECKLIST

### **After Update Completes:**

#### 1. **Version Check**
- [ ] Help → About shows **2.3.406**
- [ ] No errors during startup
- [ ] App functions normally

#### 2. **Integrity Check Logs**
```powershell
# Open new log file
code "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log"

# Look for (should be at top of file):
# 🚀 Running startup integrity check...
# 🔍 ═══ STARTING APP INTEGRITY CHECK ═══
# [INTEGRITY-CHECK] Test 1/3: Reading package.json from ASAR...
# [INTEGRITY-CHECK] Package.json read successfully
# [INTEGRITY-CHECK] Test 2/3: Parsing package.json...
# [INTEGRITY-CHECK] JSON parsed successfully
# [INTEGRITY-CHECK] Test 3/3: Validating critical fields...
# [INTEGRITY-CHECK]   ✓ name: CypherEdge-UAT
# [INTEGRITY-CHECK]   ✓ version: 2.3.406  ← SHOULD SHOW 406!
# [INTEGRITY-CHECK]   ✓ main: main.js
# ✅ ═══ APP INTEGRITY CHECK PASSED ═══
```

#### 3. **No JSON Parse Errors**
- [ ] No error dialog on startup
- [ ] No "JSON.parse" errors in logs
- [ ] App.asar not corrupted

#### 4. **Complete Update Flow Logs**
```powershell
# Search old log file (before update) for these entries:
# Should find complete sequence:

# 1. Update detection
Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "Version upgrade path: 2.3.405 → 2.3.406"

# 2. Cleanup sequence
Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "\[CLEANUP-LOG\]"

# 3. Quit and install
Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "\[QUIT-INSTALL\]"

# 4. UI feedback
Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "\[UPDATE-UI\]"
```

---

## 🎯 SUCCESS CRITERIA

### ✅ **Test PASSES if:**
1. Update detects 406 > 405
2. Download completes successfully
3. User sees full-screen modal
4. NSIS installer shows customUnInit logs
5. App closes gracefully
6. Installer runs without errors
7. App launches with version 2.3.406
8. Integrity check passes
9. **NO JSON parse errors**
10. App functions normally

### ❌ **Test FAILS if:**
1. Update not detected
2. Download fails
3. JSON parse error on restart
4. "Installation Corrupted" dialog appears
5. App doesn't launch after update
6. Version still shows 2.3.405
7. Integrity check fails

---

## 🐛 TROUBLESHOOTING

### **Issue: Update not detected**

**Check:**
```powershell
# Verify S3 latest.yml
curl https://cypheredge-exe-uat.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml

# Check update configuration in logs
Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log" -Pattern "Update Configuration"
```

### **Issue: JSON parse error after update**

**This means our fix DIDN'T work. Check:**
1. Did NSIS installer show customUnInit logs?
2. Was there a 5-second wait before launch?
3. Check logs for `[CLEANUP-LOG]` and `[UPDATE-LOG]` entries

**Collect logs:**
```powershell
# Archive all logs for analysis
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Compress-Archive -Path "$env:APPDATA\CypherEdge-UAT\logs\*" -DestinationPath "C:\Users\sanch\Desktop\update-failure-logs-$timestamp.zip"
```

### **Issue: Integrity check fails**

**This means app.asar IS corrupted. To fix:**
1. Uninstall CypherEdge-UAT
2. Delete `$env:LOCALAPPDATA\CypherEdge-UAT`
3. Reinstall from fresh installer
4. Report logs to developer

---

## 📊 LOG COLLECTION SCRIPT

**Run this AFTER update completes to collect all relevant logs:**

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = "C:\Users\sanch\Desktop\update-test-results-$timestamp"

New-Item -ItemType Directory -Path $outputDir -Force

# Copy logs
Copy-Item "$env:APPDATA\CypherEdge-UAT\logs\*" $outputDir -Recurse -ErrorAction SilentlyContinue

# Extract key log entries
@"
=== UPDATE DETECTION ===
$(Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "Version upgrade path" | Out-String)

=== CLEANUP LOGS ===
$(Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "\[CLEANUP-LOG\]" | Out-String)

=== QUIT-INSTALL LOGS ===
$(Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "\[QUIT-INSTALL\]" | Out-String)

=== INTEGRITY CHECK (NEW VERSION) ===
$(Get-Content "$env:APPDATA\CypherEdge-UAT\logs\cyphersol.log" | Select-String -Pattern "INTEGRITY" | Out-String)

=== ANY ERRORS ===
$(Select-String -Path "$env:APPDATA\CypherEdge-UAT\logs\*.log" -Pattern "ERROR|FAIL|corruption" -Context 2 | Out-String)
"@ | Out-File "$outputDir\summary.txt"

Write-Host "✅ Logs collected to: $outputDir"
Write-Host "📋 Review summary.txt for key entries"
```

---

## 🎉 EXPECTED OUTCOME

**If everything works correctly:**

1. ✅ 405 detects 406 update
2. ✅ Downloads silently in background
3. ✅ User sees clear "Restart Now" button
4. ✅ Full-screen modal shows during transition
5. ✅ NSIS kills all processes cleanly
6. ✅ Old version uninstalled without file locks
7. ✅ New version installed successfully
8. ✅ 5-second wait ensures file system stability
9. ✅ App launches with 406
10. ✅ Integrity check passes
11. ✅ **NO JSON PARSE ERRORS** ← KEY SUCCESS METRIC
12. ✅ App works normally

---

## 📞 NEXT STEPS AFTER TESTING

### **If Test PASSES:**
1. Share success logs
2. Test multiple sequential updates (406 → 407 → 408)
3. Roll out to beta testers
4. Monitor first 10 production updates

### **If Test FAILS:**
1. Collect logs using script above
2. Share logs with detailed error description
3. We'll analyze and identify root cause
4. Apply additional fixes if needed

---

**Good luck with testing! The comprehensive logging will tell us EXACTLY what happens at every step.**

# CypherSol Debug Guide

## Overview

We've added comprehensive debugging to help identify why the app fails to launch on specific PCs. The debugging tracks every initialization phase with detailed timing and error information.

## What We've Added

### 1. SystemInformation.js
- Added `[SYSINFO DEBUG]` logging for all system information collection
- Added `[MAC DEBUG]` logging for MAC address retrieval methods
- Added `[UUID DEBUG]` logging for UUID generation methods
- Added `[SID DEBUG]` logging for Windows SID retrieval
- Each operation logs timing and success/failure status

### 2. InitiateGatewayServer.js
- Added `[GATEWAY DEBUG]` logging for overall initialization
- Added `[SERVICE DEBUG]` logging for Windows service operations
- Added `[HEALTH DEBUG]` logging for gateway health checks
- Detailed timing for each operation

### 3. main.js
- Added `[INIT DEBUG]` logging for all initialization phases
- Tracks total elapsed time from app start
- Logs success/failure for each phase with timing

## Running in Debug Mode

### Method 1: Using the Debug Batch File (Windows)
```batch
run-debug.bat
```

### Method 2: Manual Debug Run
```batch
set CYPHERSOL_DIAGNOSTIC=true
set FORCE_DEBUG_LOGS=true
npm start
```

### Method 3: Skip Specific Components (For Testing)
```batch
set CYPHERSOL_DIAGNOSTIC=true
set SKIP_GATEWAY=true         # Skip gateway server
set SKIP_SYSTEM_INFO=true     # Skip system info collection
set SKIP_LICENSE=true         # Skip license validation
set SKIP_MIGRATION=true       # Skip user data migration
npm start
```

## Analyzing Debug Logs

### Location of Logs
- Windows: `%APPDATA%\ca-offline-suite\cyphersol.log`
- macOS: `~/Library/Application Support/ca-offline-suite/cyphersol.log`
- Linux: `~/.config/ca-offline-suite/cyphersol.log`

### Using the Log Analyzer
```bash
node analyze-debug-logs.js
# or specify a custom log path
node analyze-debug-logs.js "C:\path\to\cyphersol.log"
```

## What to Look For

### 1. Stuck Phases
Look for phases that start but never complete:
```
[INIT DEBUG] GATEWAY_SERVER - INITIALIZING | Total Elapsed: 1234ms |
# ... no SUCCESS or FAILED after this
```

### 2. Timeout Errors
Watch for operations that timeout:
```
[UUID DEBUG] WMI_UUID - FAILED | Elapsed: 5002ms | { error: "Command timed out" }
```

### 3. Service Errors
Gateway service issues:
```
[SERVICE DEBUG] startService - ERROR | { error: "1053" }
```

### 4. Critical Failure Points
The last logged operation before the app stops responding is likely the culprit.

## Common Issues and Solutions

### Issue 1: WMI Commands Hanging
**Symptoms:**
- `[UUID DEBUG]` or `[MAC DEBUG]` show timeouts
- App hangs during system info collection

**Solutions:**
1. Run with `SKIP_SYSTEM_INFO=true` to confirm
2. Check WMI service: `sc query winmgmt`
3. Repair WMI: `winmgmt /resetrepository`

### Issue 2: Gateway Service Won't Start
**Symptoms:**
- `[SERVICE DEBUG]` shows error 1053
- `[GATEWAY DEBUG]` stuck at "Attempting Windows Service approach"

**Solutions:**
1. Run with `SKIP_GATEWAY=true` to confirm
2. Check Windows Event Viewer for service errors
3. Try running as administrator
4. Check if antivirus is blocking service creation

### Issue 3: License Validation Fails
**Symptoms:**
- 400 Bad Request errors
- App proceeds but license invalid

**Solutions:**
1. Ensure gateway is running first
2. Check network connectivity to license server
3. Verify license file exists

## Providing Debug Information

When reporting issues, please:

1. Run with debug mode enabled
2. Let the app run until it hangs (wait at least 60 seconds)
3. Run the analyzer: `node analyze-debug-logs.js`
4. Share:
   - The full log file
   - The analyzer output
   - Which phase the app got stuck at
   - Any error messages shown

## Building and Distributing Debug Version

1. Ensure all debug code is included
2. Build the app: `npm run build`
3. Test the build with debug flags
4. Share the build with affected users
5. Have them run with debug mode and collect logs

## Next Steps

Based on the debug logs, we can:
1. Add more specific error handling
2. Implement better fallbacks
3. Add retry logic for failing operations
4. Create workarounds for specific system configurations

The debug information will clearly show which initialization step is failing and why, allowing us to implement targeted fixes.
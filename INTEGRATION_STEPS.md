# CypherEdge Compatibility Checker - Integration Steps

## 📁 JSON Output Storage Paths

### Production & Development Storage Locations

```javascript
// Mode Detection JSON Storage
const storageDir = path.join(app.getPath('userData'), 'appMode');
// Windows: C:\Users\[username]\AppData\Roaming\CypherEdge\appMode\
// macOS: ~/Library/Application Support/CypherEdge/appMode/
// Linux: ~/.config/CypherEdge/appMode/

// JSON Files Created:
├── appModeDecision.json     // Main decision file for other devs
├── modeDecisionLog.json     // Detailed log with timestamps
├── decisionHistory.json     // Historical records
└── backup_[timestamp].json  // Timestamped backups
```

## 🔧 Key Function to Get Final Results

The main function that returns the complete compatibility check result is in `SystemCompatibilityChecker.js`:

### Primary Function: `runFullCheck()`
**Location**: `frontend/SystemCompatibilityChecker.js:48-396`

```javascript
async runFullCheck() {
  // ... compatibility checks and mode detection ...
  
  // FINAL RESULT OBJECT (Line 328-365)
  const result = { 
    canProceed: this.results.canProceed,     // boolean: true/false
    results: this.results,                   // Full test results
    sessionSummary,                          // Session summary data
    logPaths: this.logger.getLogPaths(),     // Log file locations
    reportPath,                              // Report file path
    modeDetection: modeDetectionResult       // Mode detection result
  };
  
  return result;  // THIS IS WHAT OTHER DEVS NEED
}
```

## 📊 Result Object Structure

```javascript
{
  canProceed: true,  // Whether app can launch
  
  results: {
    startTime: 1693305600000,
    endTime: 1693305700000,
    duration: 100000,
    canProceed: true,
    issues: [],        // Failed tests
    warnings: [],      // Warning tests
    successes: [],     // Passed tests
    systemInfo: {},    // System details
    appMode: {         // Mode detection result
      determinedMode: 'SCAN',  // or 'UNSCAN' or 'HYBRID'
      canProceed: true,
      confidence: 'high',
      userMessage: 'Full offline processing enabled'
    }
  },
  
  modeDetection: {
    determinedMode: 'SCAN',    // SCAN/UNSCAN/HYBRID
    confidence: 'high',
    canProceed: true,
    reason: 'Hardware exceeds requirements',
    analysis: {
      hardware: {
        ram: { actual: 16, required: 16, passed: true },
        cpu: { actual: 'i7', required: 'i7', passed: true }
      }
    }
  },
  
  logPaths: {
    console: 'path/to/console.log',
    file: 'path/to/file.log'
  },
  
  reportPath: 'path/to/report.html'
}
```

## 🎯 How Other Developers Can Use This

### Option 1: Read from JSON Files
```javascript
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Get the stored mode decision
const storageDir = path.join(app.getPath('userData'), 'appMode');
const decisionPath = path.join(storageDir, 'appModeDecision.json');

const modeDecision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
console.log('Mode:', modeDecision.mode);  // SCAN/UNSCAN/HYBRID
console.log('Can Proceed:', modeDecision.canProceed);
```

### Option 2: Access from Main Process
```javascript
// In main.js after compatibility check completes
const { SystemCompatibilityChecker } = require("./SystemCompatibilityChecker");
const compatChecker = new SystemCompatibilityChecker();
const compatResult = await compatChecker.runFullCheck();

// Pass result to other modules
if (compatResult.canProceed) {
  // Other dev's logic here
  const mode = compatResult.modeDetection.determinedMode;
  
  if (mode === 'SCAN') {
    // Enable full features
  } else if (mode === 'UNSCAN') {
    // Limited features
  } else if (mode === 'HYBRID') {
    // Cloud processing mode
  }
}
```

### Option 3: IPC from Renderer Process
```javascript
// In renderer process
const result = await window.electronAPI.runCompatibilityCheck();
console.log('Compatibility Result:', result);
console.log('Mode Detected:', result.modeDetection.determinedMode);
```

## 📍 Key Integration Points

### 1. After Compatibility Check (main.js:2383-2420)
- Result available in `compatResult` variable
- Check `compatResult.canProceed` before continuing

### 2. Mode Detection Result Storage Locations
- **JSON File**: `appModeDecision.json` in userData/appMode directory
- **Memory**: `this.results.appMode` in SystemCompatibilityChecker instance
- **Return Object**: `modeDetectionResult` in the runFullCheck() return value

### 3. Email Audit Data (Comprehensive Report)
The email audit includes everything:
- Complete system information
- Mode detection results
- Performance metrics
- User journey timeline
- Compatibility test results

## 🔌 API Reference

### SystemCompatibilityChecker Methods

#### `runFullCheck()`
**Returns**: Promise<Object>  
**Description**: Runs complete compatibility check and mode detection

```javascript
const result = await compatChecker.runFullCheck();
```

#### `getModeDetectionResult()`
**Returns**: Object | null  
**Description**: Gets the latest mode detection result

```javascript
const modeResult = await compatChecker.getModeDetectionResult();
```

#### `sendEmailAuditReport(finalDecision)`
**Parameters**: 
- `finalDecision` (string): 'proceed', 'cancel', or 'test-completion-fallback'
**Returns**: Promise<Object>  
**Description**: Sends comprehensive audit email

```javascript
const emailResult = await compatChecker.sendEmailAuditReport('proceed');
```

## 📂 File Structure Reference

```
frontend/
├── SystemCompatibilityChecker.js     // Main compatibility checker
├── compatibility/
│   ├── AppModeManager.js            // Mode detection orchestrator
│   ├── modules/
│   │   ├── ModeDecisionEngine.js    // Decision logic
│   │   ├── ModeStorageManager.js    // JSON storage handler
│   │   └── HardwareDetector.js      // Hardware detection
│   └── config/
│       └── appModeConfig.json       // Configuration
├── services/
│   └── EmailAuditService.js         // Email audit service
└── react-app/
    └── compatibility.html            // UI implementation
```

## 🚀 Quick Start Guide

### For Backend Integration
1. Import SystemCompatibilityChecker
2. Call `runFullCheck()` method
3. Access `result.modeDetection.determinedMode`
4. Implement mode-specific logic

### For Frontend Integration
1. Use IPC via `window.electronAPI`
2. Get compatibility result
3. Check mode detection
4. Update UI accordingly

### For Data Persistence
1. Read from `appModeDecision.json`
2. Parse JSON data
3. Access `mode` field
4. Use for decision making

## 📝 Mode Types Reference

### SCAN Mode
- **Hardware**: High-end PC (16GB+ RAM, i7+ CPU)
- **Features**: Full offline processing with scanning
- **User Flow**: Direct application launch

### UNSCAN Mode
- **Hardware**: Mid-range PC (8GB+ RAM, i5+ CPU)
- **Features**: Limited scanning capabilities
- **User Flow**: Notification modal → 5s countdown → Auto-launch

### HYBRID Mode
- **Hardware**: Low-end PC (<8GB RAM, <i5 CPU)
- **Features**: Cloud-based processing required
- **User Flow**: Payment flow → Team verification → Remote activation

## 🔍 Debugging

### Log File Locations
- Console logs: Available in DevTools console
- File logs: Check `result.logPaths.file` for location

### Common Integration Issues

#### Issue: Mode detection returns null
**Solution**: Ensure compatibility check completed successfully before accessing mode

#### Issue: JSON file not found
**Solution**: Check if compatibility check has run at least once

#### Issue: IPC not responding
**Solution**: Verify IPC handlers are registered in main.js

## 📧 Support

For integration support, check the comprehensive audit emails sent to:
- Primary: User's email address
- CC: thalnerkarsanchay17@gmail.com

The audit email contains complete session data including mode detection results and system information.
# Compatibility Cache Usage Guide

## Overview

The **Compatibility Cache** is a simple but secure mechanism that stores the results of system compatibility checks to avoid running the full compatibility flow repeatedly. Once a system has been analyzed and a mode determined, the results are cached for up to 30 days.

## How It Works

### First Run (No Cache)
```
User starts CypherEdge
    ↓
main.js checks cache → No cache found
    ↓
Full compatibility check runs (3-step UI)
    ↓
Mode determined (SCAN/UNSCAN/HYBRID)  
    ↓
Results cached with system fingerprint
    ↓
App continues with determined mode
```

### Subsequent Runs (With Valid Cache)
```
User starts CypherEdge  
    ↓
main.js checks cache → Valid cache found
    ↓
System fingerprint verified → Matches
    ↓
Cache age checked → Still valid (< 30 days)
    ↓
Skip compatibility flow, use cached mode
    ↓
App continues directly (much faster startup)
```

## Cache Storage Locations

- **Development**: `frontend/compatibility/cache/compatibility-result.json`
- **Production**: `{userData}/CypherEdge/compatibility-result.json`

## Cache Structure

```json
{
  "version": "1.0.0",
  "timestamp": 1693123456789,
  "systemFingerprint": {
    "platform": "win32",
    "arch": "x64", 
    "totalMemoryGB": 16,
    "cpuCount": 8,
    "cpuModel": "Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz",
    "nodeVersion": "v18.17.0",
    "electronVersion": "25.3.1"
  },
  "compatibilityResult": {
    "determinedMode": "SCAN",
    "confidence": "high", 
    "canProceed": true,
    "userMessage": "✅ Full offline processing with scanning enabled",
    "duration": 45231,
    "technical": {
      "configVersion": "1.0.0",
      "testMode": false
    }
  },
  "metadata": {
    "nodeEnv": "production",
    "appVersion": "1.0.0",
    "createdAt": "2025-08-30T10:30:45.123Z"
  }
}
```

## Cache Validation Rules

The cache is considered **VALID** only if ALL conditions are met:

1. **File exists** and is readable
2. **Age < 30 days** (configurable via `maxCacheAge`)
3. **System fingerprint matches**:
   - Same platform (win32, darwin, linux)
   - Same architecture (x64, arm64)
   - Same RAM amount (in GB)
   - Same CPU model
4. **Valid structure** with required fields
5. **Valid mode** (SCAN/UNSCAN/HYBRID)

## Cache Invalidation

Cache is automatically invalidated when:

- **System hardware changes** (RAM upgrade, CPU change)
- **Cache expires** (> 30 days old)
- **File is corrupted** or has invalid structure
- **Manual clearing** via IPC handlers

## IPC Commands

### Check Cache Status
```javascript
const result = await window.electron.ipcRenderer.invoke('compatibility-cache:get-status');
console.log('Cache Status:', result.status);
```

### Clear Cache (Force Re-run)
```javascript
const result = await window.electron.ipcRenderer.invoke('compatibility-cache:clear');
console.log('Cache cleared:', result.success);
```

### Check Cache Validity
```javascript
const result = await window.electron.ipcRenderer.invoke('compatibility-cache:is-valid');
console.log('Cache valid:', result.isValid);
```

## Testing the Cache

### Test Scenario 1: First Run
1. Delete cache file (if exists)
2. Start CypherEdge
3. **Expected**: Full compatibility flow runs
4. **Result**: Cache file created with results

### Test Scenario 2: Second Run (Valid Cache)
1. Start CypherEdge again (within 30 days)
2. **Expected**: No compatibility flow, direct startup
3. **Result**: Logs show "Using cached compatibility result"

### Test Scenario 3: Cache Expiry
1. Manually edit cache timestamp to be > 30 days old
2. Start CypherEdge
3. **Expected**: Full compatibility flow runs (cache expired)
4. **Result**: New cache file with current timestamp

### Test Scenario 4: System Change
1. Manually edit cache `totalMemoryGB` to different value
2. Start CypherEdge  
3. **Expected**: Full compatibility flow runs (system changed)
4. **Result**: New cache with correct system specs

## Development vs Production

- **Development** (`NODE_ENV=development`): Cache stored in project directory
- **Production** (`NODE_ENV=production`): Cache stored in user data directory

## Security Features

1. **System fingerprinting** prevents cache reuse on different machines
2. **Time-based expiry** ensures periodic re-validation
3. **Structure validation** prevents corrupted cache usage
4. **Read-only cache usage** - cache never modifies system behavior beyond skipping UI

## Performance Benefits

- **Startup time**: Reduces from ~45 seconds to ~3 seconds on subsequent runs
- **User experience**: No repeated compatibility flows
- **Network usage**: No repeated system analysis
- **Resource usage**: Lower CPU/memory during cached startups

## Debugging

### Common Log Messages

```bash
# Cache found and valid
📂 Checking compatibility cache...
⚡ Using cached compatibility result { mode: 'SCAN', age: '2 hours ago', confidence: 'high' }

# No cache or invalid
📂 Checking compatibility cache...
🔍 No valid cache found, running full system compatibility check...

# Cache saved after successful check
💾 Compatibility result cached for future startups
```

### Troubleshooting

- **Cache not working**: Check file permissions in cache directory
- **Always running full check**: Verify system fingerprint hasn't changed
- **Cache too old**: Default 30-day expiry may be too short for some use cases
- **Development issues**: Ensure cache directory exists and is writable

## Configuration

Modify cache behavior in `CompatibilityCache.js`:

```javascript
class CompatibilityCache {
  constructor(logger = null) {
    this.maxCacheAge = 30 * 24 * 60 * 60 * 1000; // Change expiry time
    this.cacheFileName = 'compatibility-result.json'; // Change filename
  }
}
```

This caching mechanism provides a simple, secure, and effective way to improve user experience by avoiding repetitive compatibility checks while maintaining system validation integrity.
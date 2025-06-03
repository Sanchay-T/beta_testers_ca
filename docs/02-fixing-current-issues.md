# Fixing Current Issues - Step by Step Guide

## Table of Contents
1. [The isDev Error Fix](#the-isdev-error-fix)
2. [Python Backend Reliability](#python-backend-reliability)
3. [Build Process Automation](#build-process-automation)
4. [Update Mechanism Improvements](#update-mechanism-improvements)
5. [Database Initialization](#database-initialization)

## The isDev Error Fix

### Understanding the Problem

When your app starts, modules load in this order:
1. `main.js` starts loading
2. Line 30: `require("./db/db")` executes
3. `db.js` tries to access `global.AppConfig.isDev`
4. BUT `global.AppConfig` isn't created until line 57!

### The Fix (Already Applied)

We moved the database require to AFTER AppConfig creation:

```javascript
// main.js - BEFORE (line 30)
const databaseManager = require("./db/db"); // ❌ Too early!

// main.js - AFTER (line 80)
// AppConfig is created on line 57
global.AppConfig = { ... };

// NOW it's safe to require database
const databaseManager = require("./db/db"); // ✅ Perfect timing!
```

### Why This Works

- `global.AppConfig` exists when `db.js` loads
- The fallback logic in `db.js` now has the primary source available
- No more "isDev is not defined" errors

### Testing the Fix

1. Build your app normally:
   ```bash
   pyinstaller --onefile backend/main.py
   python postbuild.py
   cd frontend && npm run build
   ```

2. Install and run - the error should be gone!

## Python Backend Reliability

### Current Issues
- No health checks
- No automatic restart
- Fixed port (7500)
- No retry logic

### Implementing Health Checks

Add this to your `main.js`:

```javascript
// Add after line 700 (after pythonProcess is started)
async function checkPythonHealth() {
  try {
    const response = await axios.get('http://localhost:7500/health', {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    console.error('Python backend health check failed:', error.message);
    return false;
  }
}

// Health check interval
let healthCheckInterval = null;

function startHealthCheck() {
  healthCheckInterval = setInterval(async () => {
    const isHealthy = await checkPythonHealth();
    if (!isHealthy) {
      console.error('Python backend is not responding! Attempting restart...');
      await restartPythonBackend();
    }
  }, 30000); // Check every 30 seconds
}

// Start health check after Python process starts
if (pythonProcess) {
  setTimeout(() => {
    startHealthCheck();
  }, 5000); // Wait 5 seconds before first check
}
```

### Add Health Endpoint to Python

In `backend/main.py`, add:

```python
@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
```

### Implementing Dynamic Port Allocation

Replace the fixed port with dynamic allocation:

```javascript
// main.js - Add this function
async function findAvailablePort(startPort = 7500, endPort = 7600) {
  const portscanner = require('portscanner');
  return await portscanner.findAPortNotInUse(startPort, endPort, '127.0.0.1');
}

// Modify the Python startup
async function startPythonBackend() {
  const port = await findAvailablePort();
  console.log(`Starting Python backend on port ${port}`);
  
  // Pass port to Python process
  const args = isDev ? 
    [scriptPath, '--port', port] : 
    ['--prod', '--port', port];
    
  pythonProcess = spawn(command, args, options);
  
  // Store port globally
  global.PYTHON_PORT = port;
  
  // Update all axios calls to use dynamic port
  // Replace 'http://localhost:7500' with `http://localhost:${global.PYTHON_PORT}`
}
```

## Build Process Automation

### Current Manual Process
1. `pyinstaller --onefile backend/main.py`
2. `python postbuild.py`
3. `cd frontend && npm run build`

### Automated Build Script

Create `build-automated.bat`:

```batch
@echo off
echo ========================================
echo CypherSol Automated Build Process
echo ========================================

REM Set build timestamp
set BUILD_TIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BUILD_TIME=%BUILD_TIME: =0%
echo Build started at: %BUILD_TIME%

REM Step 1: Environment Setup
echo.
echo [1/6] Setting up environment...
set NODE_ENV=production
set ELECTRON_IS_DEV=false
set GENERATE_SOURCEMAP=false

REM Create .env file for production
echo NODE_ENV=production > frontend\.env
echo ELECTRON_IS_DEV=false >> frontend\.env

REM Step 2: Clean previous builds
echo.
echo [2/6] Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist frontend\dist rmdir /s /q frontend\dist

REM Step 3: Build Python Backend
echo.
echo [3/6] Building Python backend...
call pyinstaller --onefile --windowed ^
  --name ca-backend ^
  --distpath dist ^
  --hidden-import pandas ^
  --hidden-import numpy ^
  --hidden-import sklearn ^
  backend/main.py

if errorlevel 1 (
  echo ERROR: Python build failed!
  exit /b 1
)

REM Step 4: Run postbuild
echo.
echo [4/6] Running postbuild process...
python postbuild.py
if errorlevel 1 (
  echo ERROR: Postbuild failed!
  exit /b 1
)

REM Step 5: Build Electron App
echo.
echo [5/6] Building Electron app...
cd frontend
call npm run build
if errorlevel 1 (
  echo ERROR: Electron build failed!
  cd ..
  exit /b 1
)
cd ..

REM Step 6: Verification
echo.
echo [6/6] Verifying build...
if not exist "frontend\dist\Cyphersol Setup*.exe" (
  echo ERROR: Installer not found!
  exit /b 1
)

echo.
echo ========================================
echo BUILD SUCCESSFUL!
echo Installer location: frontend\dist\
echo ========================================
```

### Make it Even Better

Add pre-build checks:

```batch
REM Add before Step 3
echo Checking prerequisites...

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found!
  exit /b 1
)

REM Check Node
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found!
  exit /b 1
)

REM Check if backend/main.py exists
if not exist backend\main.py (
  echo ERROR: backend/main.py not found!
  exit /b 1
)
```

## Update Mechanism Improvements

### Current Issues
- No rollback mechanism
- Updates every 4 hours (too frequent)
- All users get updates simultaneously

### Implementing Staged Rollouts

```javascript
// main.js - Modify autoUpdater configuration

// Add user grouping logic
function getUserGroup() {
  // Use last digit of user ID or random assignment
  const userId = global.currentUser?.id || '0';
  const lastDigit = parseInt(userId.slice(-1));
  
  if (lastDigit < 2) return 'canary';      // 20% of users
  if (lastDigit < 5) return 'beta';        // 30% of users
  return 'stable';                         // 50% of users
}

// Configure updater with channels
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.channel = getUserGroup();

// Reduce update frequency
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Once per day

// Add exponential backoff for failed updates
let updateCheckFailures = 0;

function scheduleUpdateCheck() {
  const baseDelay = UPDATE_CHECK_INTERVAL;
  const delay = baseDelay * Math.pow(2, updateCheckFailures);
  
  setTimeout(() => {
    checkForUpdates();
  }, Math.min(delay, baseDelay * 7)); // Max 1 week
}
```

### Implementing Rollback

```javascript
// Before installing update, backup current version
async function backupCurrentVersion() {
  const backupDir = path.join(app.getPath('userData'), 'backups', app.getVersion());
  
  await fs.ensureDir(backupDir);
  
  // Backup critical files
  const filesToBackup = [
    'resources/app.asar',
    'resources/backend/main.exe',
    // Add other critical files
  ];
  
  for (const file of filesToBackup) {
    const src = path.join(process.resourcesPath, '..', file);
    const dest = path.join(backupDir, file);
    
    if (fs.existsSync(src)) {
      await fs.copy(src, dest);
    }
  }
  
  // Save rollback info
  await fs.writeJson(path.join(backupDir, 'rollback.json'), {
    version: app.getVersion(),
    date: new Date().toISOString(),
    files: filesToBackup
  });
}
```

## Database Initialization

### Current Issues
- Complex path logic
- Migrations run on every startup
- No connection pooling

### Simplified Database Manager

Create a new `DatabaseService.js`:

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const dbPath = this.getDatabasePath();
      console.log('Initializing database at:', dbPath);

      // Ensure directory exists
      const dbDir = path.dirname(dbPath);
      await fs.ensureDir(dbDir);

      // Open database
      this.db = new Database(dbPath);
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Run migrations only if needed
      await this.runMigrationsIfNeeded();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  getDatabasePath() {
    const userDataPath = app.getPath('userData');
    const dbName = process.env.DB_FILE_NAME || 'ca_offline.db';
    
    return global.AppConfig.isDev
      ? path.join(__dirname, '..', dbName)
      : path.join(userDataPath, dbName);
  }

  async runMigrationsIfNeeded() {
    // Check current version
    const currentVersion = this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    
    if (currentVersion < latestVersion) {
      console.log(`Running migrations: ${currentVersion} -> ${latestVersion}`);
      // Run only necessary migrations
      await this.runMigrations(currentVersion, latestVersion);
    }
  }

  getCurrentVersion() {
    try {
      const result = this.db.prepare(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
      ).get();
      return result ? result.version : 0;
    } catch {
      // Table doesn't exist yet
      return 0;
    }
  }

  // ... more methods
}

module.exports = new DatabaseService();
```

## Testing Your Fixes

### 1. Test Module Load Order Fix
```bash
# Build and run
npm run build

# Check logs for:
# - "AppConfig Initialization" before "Database module loaded"
# - No isDev errors
```

### 2. Test Python Health Checks
```bash
# Start app
# Kill Python process manually
taskkill /F /IM ca-backend.exe

# App should detect and restart Python
```

### 3. Test Automated Build
```bash
# Run new build script
build-automated.bat

# Should complete without manual intervention
```

### 4. Test Update Mechanism
```javascript
// Temporarily set short interval for testing
const UPDATE_CHECK_INTERVAL = 60 * 1000; // 1 minute

// Check logs for update channel assignment
```

## What Success Looks Like

When all fixes are implemented correctly:

1. **No isDev Errors**: App starts without module loading errors
2. **Reliable Backend**: Python crashes are detected and recovered
3. **One-Click Build**: `build-automated.bat` handles everything
4. **Smart Updates**: Staged rollouts, less frequent checks
5. **Clean Database**: Fast startup, proper migrations

## Common Pitfalls to Avoid

1. **Don't skip the environment setup** in build scripts
2. **Always test in production mode** after building
3. **Monitor logs** - they tell you what's happening
4. **Keep backups** before major changes
5. **Test on clean machine** - not just your dev environment

## Next Steps

Once these fixes are working:
1. Move to `03-build-process-guide.md` for complete automation
2. Set up CI/CD with `04-implementing-cicd.md`
3. Implement best practices from `05-best-practices.md`
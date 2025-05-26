# CypherSol Architecture Overview

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Component Communication](#component-communication)
4. [Current Implementation](#current-implementation)
5. [Known Issues](#known-issues)
6. [Quick Reference](#quick-reference)

## Introduction

CypherSol is a desktop application for processing bank statements and financial documents. It combines:
- **Electron** for the desktop UI
- **React** for the frontend
- **Python/FastAPI** for ML/PDF processing
- **SQLite** for local data storage
- **.NET Gateway Service** for licensing

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                     │
│  (main.js)                                                       │
│  - Window Management                                             │
│  - IPC Communication Hub                                         │
│  - Python Process Management                                     │
│  - Auto-Update Management                                        │
│  - Session & License Management                                  │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
                   │ IPC                      │ HTTP
                   │                          │ :7500
┌──────────────────▼──────────────┐  ┌───────▼───────────────────┐
│      ELECTRON RENDERER          │  │    PYTHON BACKEND         │
│  (React App)                    │  │  (FastAPI)                │
│  - UI Components                │  │  - PDF Processing         │
│  - State Management             │  │  - ML/NER Extraction      │
│  - Dashboard Views              │  │  - Bank Statement Analysis│
└─────────────────────────────────┘  └───────────────────────────┘
                   │                          │
                   │                          │
┌──────────────────▼──────────────────────────▼───────────────────┐
│                        SQLITE DATABASE                           │
│  - Users, Sessions, Transactions                                │
│  - Cases, Categories, Statements                                │
│  - EOD Balances, Summaries                                      │
└──────────────────────────────────────────────────────────────────┘
```

## Component Communication

### 1. Frontend → Backend Flow
```
User Action in React
    ↓
IPC Call to Main Process
    ↓
Main Process Handler
    ↓
HTTP Request to Python Backend (localhost:7500)
    ↓
FastAPI Process Request
    ↓
Return Response
```

### 2. Python Backend Communication

The Python backend runs as a separate process:

**Development Mode:**
```javascript
// main.js - Line 535
pythonProcess = spawn("python", [scriptPath], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env }
});
```

**Production Mode:**
```javascript
// main.js - Line 621
pythonProcess = spawn(pythonExecutablePath, ["--prod"], {
  cwd: distMainPath,
  detached: false,
  env: { ...process.env }
});
```

### 3. IPC Channel Structure

All IPC handlers are organized in `/frontend/ipc/`:
- `authHandlers.js` - Login, logout, session management
- `mainDashboard.js` - Main dashboard data
- `caseDashboard.js` - Case management
- `reportHandlers.js` - Report generation
- `tallyHandlers.js` - Tally integration
- `fileHandler.js` - File operations

## Current Implementation

### Key Files and Their Roles

1. **frontend/main.js** (1350+ lines)
   - Entry point for Electron app
   - Manages all windows and processes
   - Handles auto-updates
   - Spawns Python backend

2. **frontend/db/db.js**
   - SQLite database management
   - Singleton pattern implementation
   - Migration handling

3. **backend/main.py**
   - FastAPI server (port 7500)
   - PDF processing endpoints
   - ML/NER extraction logic

4. **frontend/SessionManager.js**
   - License countdown management
   - Session state tracking
   - EventEmitter for updates

5. **frontend/LicenseManager.js**
   - License validation
   - Gateway service communication
   - Activation/deactivation flow

### Environment Variables

```bash
# Development
NODE_ENV=development
DB_FILE_NAME=ca_offline.db

# Production (set by build process)
NODE_ENV=production
ELECTRON_IS_DEV=false
```

### Port Configuration

- **7500**: Python FastAPI backend
- **7890**: Gateway license service
- **3000**: React dev server (development only)

## Known Issues

### 1. Module Load Order Problem
**Issue**: `db.js` tries to access `global.AppConfig` before it's initialized.

**Current Fix**: Move database require after AppConfig initialization.

### 2. Python Process Management
**Issue**: No health checks or automatic restart if Python crashes.

**Impact**: App becomes unresponsive if backend fails.

### 3. Fixed Port Usage
**Issue**: Port 7500 is hardcoded, causes conflicts if already in use.

**Solution Needed**: Dynamic port allocation.

### 4. Build Process Complexity
**Issue**: Manual steps prone to errors:
1. Run PyInstaller
2. Run postbuild.py
3. Run npm build

**Solution Needed**: Automated build script with validation.

## Quick Reference

### Starting the App (Development)
```bash
# Terminal 1: Start Python backend
cd backend
python main.py

# Terminal 2: Start Electron
cd frontend
npm run dev
```

### Building for Production
```bash
# Step 1: Build Python executable
pyinstaller --onefile backend/main.py

# Step 2: Copy resources
python postbuild.py

# Step 3: Build Electron app
cd frontend
npm run build
```

### Key Global Variables
```javascript
// Available globally after initialization
global.AppConfig = {
  isDev: boolean,          // true in dev, false in production
  baseDir: string,         // Base directory for resources
  userDataDir: string      // User data directory
}
```

### Common IPC Channels
```javascript
// Authentication
'login', 'logout', 'check-license'

// Dashboard
'get-stats', 'get-recent-reports', 'get-cases'

// File Operations
'open-file-dialog', 'process-pdfs'

// Reports
'generate-report', 'export-excel'
```

## Next Steps

See the following documents for detailed improvements:
- `02-fixing-current-issues.md` - How to fix immediate problems
- `03-build-process-guide.md` - Automated build setup
- `04-implementing-cicd.md` - GitHub Actions setup
- `05-best-practices.md` - Code standards and patterns
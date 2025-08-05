# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Backend (Python/FastAPI)
```bash
# Start Python backend server (port 7500)
cd backend
uvicorn main:app --reload --port 7500

# Install Python dependencies
pip install -r requirements.txt

# Build Python executable for production
pyinstaller --onefile backend/main.py
python postbuild.py  # Copy resources after PyInstaller
```

### Frontend (Electron + React)
```bash
# Development mode - start all services
cd frontend
npm run start-all    # Starts FastAPI + React + Electron

# Individual services
npm run start:fastapi  # Python backend only
npm run start:react    # React dev server only  
npm run start         # Electron app only

# Build commands
npm run build         # Full production build
npm run build:fast    # Fast build without compression
npm run sync-version  # Sync version across all package.json files

# Testing
npm test             # Run Mocha tests
```

### Version Management
The app uses synchronized versioning across multiple package.json files. Always use:
```bash
npm run sync-version  # Updates frontend/package.json, react-app/package.json, and splash.html
```

## Architecture Overview

**CypherEdge** is a desktop CA (Chartered Accountant) application for processing bank statements and financial documents.

### Core Components
- **Electron Main Process** (`frontend/main.js`) - Window management, IPC hub, process orchestration
- **React Frontend** (`frontend/react-app/`) - UI components and dashboard views  
- **Python Backend** (`backend/main.py`) - FastAPI server for PDF processing and ML extraction
- **SQLite Database** - Local data storage with Drizzle ORM
- **.NET Gateway Service** - License management and validation

### Communication Flow
```
React UI → IPC → Electron Main → HTTP (port 7500) → Python FastAPI → SQLite
```

### Key Directories
- `frontend/ipc/` - All IPC message handlers organized by feature
- `frontend/db/schema/` - Database schemas using Drizzle ORM
- `frontend/react-app/src/components/` - React components organized by dashboard type
- `backend/tax_professional/banks/` - Bank statement processing logic
- `docs/` - Architecture documentation and implementation guides

### Database Architecture
Uses Drizzle ORM with SQLite for:
- User authentication and sessions
- Case management and categorization  
- Transaction analysis and reporting
- EOD balances and financial summaries

### Environment Configuration
- **Development**: NODE_ENV=development, Python runs via spawn, React dev server on port 3000
- **Production**: NODE_ENV=production, Python executable from PyInstaller bundle

### Port Usage
- **7500**: Python FastAPI backend
- **7890**: .NET Gateway license service  
- **3000**: React dev server (development only)

## Build Process Requirements

### Prerequisites
1. Python 3.x with PyInstaller
2. Node.js with npm
3. .NET Runtime for gateway service

### Production Build Steps
1. Build Python backend: `pyinstaller --onefile backend/main.py`
2. Run post-build script: `python postbuild.py`
3. Build Electron app: `cd frontend && npm run build`

The build process creates distributable packages for Windows (.exe), macOS (.dmg), and Linux (.AppImage).

## Key Implementation Notes

### IPC Architecture
All Electron IPC handlers are modularized in `frontend/ipc/`:
- `authHandlers.js` - Authentication and license management
- `mainDashboard.js` - Dashboard statistics and recent reports
- `caseDashboard.js` - Case management operations
- `tallyHandlers.js` - Tally ERP integration
- `reportHandlers.js` - Report generation and export

### Database Migrations
Database schema changes are handled through Drizzle migrations in `frontend/drizzle/`. The app automatically runs pending migrations on startup.

### License Management
The app requires online license validation through a .NET gateway service. Session management tracks license countdown and handles automatic logout.

### File Processing Pipeline
1. PDF upload via file dialog
2. Python backend extracts text and entities using NLP
3. Bank statement analysis categorizes transactions
4. Results stored in SQLite for dashboard display
5. Export capabilities to Excel and Tally formats
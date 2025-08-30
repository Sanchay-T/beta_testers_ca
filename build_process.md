# CypherEdge Build Process

## Overview
The build process for the CypherEdge application creates a Windows installer (NSIS) with the following workflow.

## Package Configuration
- **App Name**: CypherEdge (version 2.0.0)
- **Main Entry**: main.js
- **Uses**: electron-builder for packaging
- **Targets**: 
  - Windows: NSIS installer
  - Mac: DMG/ZIP
  - Linux: AppImage

## Build Commands

### Main Commands
- `npm run build`: Full production build (React + Electron)
- `npm run build:fast`: Fast build with no compression
- `npm run build:react`: Builds React app only
- `npm run build:electron`: Packages with electron-builder

## Build Steps (from build-with-logging.bat)

1. **Environment Setup**
   - Sets NODE_ENV=production
   - Sets ELECTRON_IS_DEV=false
   - Checks system requirements (Node.js, npm, Python)

2. **Clean Previous Builds**
   - Removes `dist` directory
   - Removes `frontend/dist` directory

3. **Build Python Backend**
   - Creates/activates virtual environment
   - Installs Python dependencies
   - Runs PyInstaller: `pyinstaller --clean backend/main.py --distpath dist --workpath build --specpath . --onedir --name main`
   - Creates: `dist/main/main.exe`

4. **Post-Build Python Script**
   - Runs `postbuild.py`
   - Copies additional files to `dist/main/_internal`:
     - `backend/models` folder
     - `Final_Category.xlsx`
     - `Customer_category.xlsx`

5. **Build React Frontend**
   - Navigates to `frontend/react-app`
   - Runs `npm run build`
   - Creates: `react-app/build/` directory

6. **Package with Electron**
   - Runs `npm run build:electron` (electron-builder)
   - Uses configuration from package.json

## Output Structure

### Windows Installer
- **File**: `CypherEdge-Setup-2.0.0.exe` (NSIS installer)
- **Location**: `frontend/dist/`
- **Size**: Typically 100+ MB
- **Type**: NSIS installer with custom script

### Installer Features
- Requires administrator privileges
- Custom installer script (`build/installer.nsh`)
- Adds Windows Firewall rules for Gateway Server
- Creates desktop and Start Menu shortcuts
- Shows installation details during process
- Auto-runs application after installation

## Included Resources

### Files Included (from package.json build.files)
- All app files (`**/*`)
- React build output (`react-app/build/**/*`)
- Environment files (`env/**/*`)
- Media files (`media/**/*`)
- Excludes:
  - Source maps (`*.map`)
  - Node modules from React app
  - Python cache files
  - Backend source files

### Extra Resources (build.extraResources)
- Python backend executable: `../dist/main` → `backend/main`
- Media folder with Excel templates
- Drizzle config: `drizzle.config.js`
- Gateway server settings: `appsettings.json`
- Gateway server executable: `gatewayService.exe`

## Platform-Specific Configuration

### Windows (NSIS)
- One-click: false (shows installation options)
- Installation directory: Not changeable
- Desktop shortcut: Created
- Start menu shortcut: Created
- Uninstall data: Keeps app data on uninstall
- Per-machine: false (per-user installation)
- Elevation: Not allowed (uses requestedExecutionLevel instead)
- Run after finish: true

### Mac
- Formats: DMG and ZIP
- Code signing: Disabled
- Gatekeeper: Disabled
- Dark mode: Supported

## Build Process Flow
```
1. Clean directories
2. Build Python backend → dist/main/main.exe
3. Run postbuild.py → Copy additional files
4. Build React frontend → react-app/build/
5. Package with Electron → CypherEdge-Setup-{version}.exe
6. Generate build report
```

## Key Directories
- **Source**: `/ca-offline-suite/`
- **Python Output**: `/dist/main/`
- **React Output**: `/frontend/react-app/build/`
- **Final Installer**: `/frontend/dist/`
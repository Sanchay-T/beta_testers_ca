# Electron App - Offline CA Variant

An Electron-based application with React frontend, configured for macOS and Windows.

## Features

* Cross-platform application built with Electron and React
* Built using electron-builder for macOS and Windows
* Packaged for macOS (DMG, ZIP) and Windows (EXE, ZIP)
* Includes shadcn/ui components and styling

## Prerequisites

### Common Prerequisites
1. Node.js (v14 or higher)
2. npm
3. Git

### Platform-Specific Tools

**macOS:**
```bash
xcode-select --install
```

**Windows:**
* Visual Studio Build Tools for Node.js
* Git in PATH environment variable

## Installation

```bash
git clone https://github.com/Sanchay-T/electron-build-ca.git
cd electron-build-ca
npm install
```

## Building

### macOS
```bash
npm run build
npm run build:electron -- --mac
```

### Windows
```bash
npm run build
npm run build:electron -- --win
```

## Troubleshooting

```bash
# macOS/Linux
rm -rf node_modules
# Windows
del /s /q node_modules

npm install
npm run build:electron -- --[mac|win]
```

## Output Files

* macOS:
  * `dist/Electron App-1.0.0-arm64.dmg` (Installer)
  * `dist/Electron App-1.0.0-arm64-mac.zip` (Standalone)
* Windows:
  * `dist/Electron App Setup 1.0.0.exe` (Installer)
  * `dist/Electron App 1.0.0-win.zip` (Standalone)

## Running the Application

### macOS

**DMG Installation:**
```bash
open "dist/Electron App-1.0.0-arm64.dmg"
# Drag to Applications folder
```

**ZIP Installation:**
```bash
unzip "dist/Electron App-1.0.0-arm64-mac.zip" -d ./output/
```

### Windows

**EXE Installation:**
* Run `dist\Electron App Setup 1.0.0.exe`
* Follow installation prompts

**ZIP Installation:**
```powershell
Expand-Archive -Path "dist\Electron App 1.0.0-win.zip" -DestinationPath .\output\
```

## Notes

* macOS: Built for Apple Silicon (arm64). Not code-signed - use right-click > "Open" to bypass warning
* Windows: Not code-signed - use "More info" > "Run anyway"
* ESLint warnings about unused variables don't affect functionality

## Contributing

Submit issues or pull requests following project code standards.

## License

MIT License

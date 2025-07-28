# CypherSol CI/CD Implementation Guide

**ULTRA COMPREHENSIVE GUIDE FOR IMPLEMENTATION**

This document provides complete instructions for implementing CI/CD for the CypherSol Electron application. This guide is designed for an agent or developer who needs to understand and implement the entire workflow from scratch.

## Table of Contents
1. [Project Context & Understanding](#project-context--understanding)
2. [Team Structure & Workflow](#team-structure--workflow)
3. [Current Build Process Analysis](#current-build-process-analysis)
4. [GitHub Repository Setup](#github-repository-setup)
5. [CI/CD Implementation](#cicd-implementation)
6. [Team Workflow Documentation](#team-workflow-documentation)
7. [Troubleshooting & Maintenance](#troubleshooting--maintenance)

---

## 1. Project Context & Understanding

### Application Architecture
**CypherSol/CypherEdge** is an Electron-based desktop application for processing CA/financial documents with the following stack:

- **Frontend**: Electron + React (desktop application)
- **Backend**: Python FastAPI server (PDF processing, ML extraction)
- **Database**: SQLite with Drizzle ORM
- **Gateway Service**: .NET service for licensing (separate build)
- **Target Platform**: Windows (primary), with macOS/Linux support

### Team Structure (3 Active Members)
- **Sanchay (@Sanchay-T)**: Founding engineer, architecture, .NET gateway, final builds, code signing, releases
- **Aiyaz (@Aiyaz17)**: Frontend development (React/Electron UI)
- **Poojan (@poojanvig)**: Backend (Python FastAPI) + Tally integration (Electron IPC)

### Critical Understanding Points
1. **Two departing team members**: @Manya009 and @Rajaa786 leaving end of week
2. **Code signing**: Done locally on separate Windows PC with USB drive
3. **No automated tests**: Currently no test suite in place
4. **Complex build process**: Multi-step build involving Python, Node.js, and .NET components
5. **Startup environment**: Need practical, not over-engineered solutions

---

## 2. Team Structure & Workflow

### Responsibility Matrix

| Component | Primary Owner | Reviewer | Critical Level |
|-----------|---------------|----------|----------------|
| Architecture/Main Process | Sanchay | - | ULTRA CRITICAL |
| Version Management | Sanchay | - | ULTRA CRITICAL |
| Build Scripts | Sanchay | - | ULTRA CRITICAL |
| React Components | Aiyaz | Poojan | SAFE |
| Python Backend | Poojan | Aiyaz | HIGH RISK |
| Tally Integration | Poojan | Sanchay | HIGH RISK |
| IPC Handlers | Both | Sanchay | HIGH RISK |
| Database Schema | Sanchay + Poojan | - | ULTRA CRITICAL |

### File Risk Classification

**🔴 ULTRA CRITICAL (Only Sanchay)**
- `/frontend/package.json` - Complex version sync script
- `/frontend/main.js` - Main Electron process (1795 lines)
- `/postbuild.py` - Resource copying and build finalization
- `/frontend/scripts/beforePack.js` - Pre-build processing
- `/.github/` - CI/CD configuration

**🟡 HIGH RISK (Requires Review)**
- `/frontend/ipc/` - All IPC handlers
- `/frontend/db/` - Database schemas and migrations
- `/backend/main.py` - FastAPI main entry point
- `/frontend/drizzle.config.js` - Database configuration

**🟢 SAFE (Team Independence)**
- `/frontend/react-app/src/components/` - React UI components
- `/frontend/react-app/src/Pages/` - Application pages
- `/backend/*.py` (except main.py) - Individual Python modules
- Static assets, documentation, styling

---

## 3. Current Build Process Analysis

### Complete Build Process Flow

**Step 1: Python Backend Build**
```bash
# Create virtual environment
python -m venv .venv

# Activate environment (Windows)
.venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Build Python executable
pyinstaller --onedir backend.main

# This creates: dist/main/main.exe + dependencies folder
```

**Step 2: Post-Build Processing**
```bash
# Run post-build script (copies resources, configures paths)
python postbuild.py

# This script:
# - Copies customer data files to dist/
# - Configures production paths
# - Sets up resource directories
```

**Step 3: Frontend Dependencies**
```bash
# Install Electron dependencies
cd frontend
npm install

# Install React dependencies  
cd react-app
npm install
```

**Step 4: Gateway Service**
```bash
# Manual step: Ensure gatewayserver.exe exists in correct location
# This .exe is built separately from .NET project
# Must be present in: frontend/gatewayServer/gatewayserver.exe
```

**Step 5: Final Build & Package**
```bash
# Return to frontend directory
cd frontend

# Build application (includes version sync, React build, Electron package)
npm run build

# For release (requires GITHUB_TOKEN in environment)
npm run release
```

### Critical Build Dependencies

**Environment Variables Required:**
- `APP_VERSION` - Version number in .env file
- `GITHUB_TOKEN` - For GitHub releases
- `NODE_ENV` - development/production
- `ELECTRON_IS_DEV` - Boolean for dev mode

**Required Files for Build:**
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Electron configuration
- `frontend/react-app/package.json` - React dependencies  
- `postbuild.py` - Post-processing script
- `frontend/gatewayServer/gatewayserver.exe` - .NET license service

**Build Outputs:**
- `dist/` - Python backend executable + dependencies
- `frontend/react-app/build/` - Compiled React application
- `frontend/dist/` - Final Electron application packages

### Version Synchronization Process

The build process includes a complex version synchronization script in `frontend/package.json` that:
1. Reads `APP_VERSION` from `.env` file
2. Updates `frontend/package.json` version
3. Updates `frontend/react-app/package.json` version  
4. Updates version display in `frontend/react-app/splash.html`
5. Updates version display in MainDashboard component

**⚠️ WARNING**: This script is extremely fragile and must not be modified without deep understanding.

---

## 4. GitHub Repository Setup

### Repository Settings Configuration

#### 1. Branch Protection Rules

**For `main` branch:**
```yaml
Protection Rules:
  - Require pull request reviews before merging: ✅
  - Required number of reviews: 1
  - Dismiss stale reviews: ✅
  - Require review from code owners: ✅
  - Restrict pushes that create files: ❌
  - Require status checks to pass: ✅
  - Required status checks: ["validate", "integration-test"]
  - Require branches to be up to date: ✅
  - Require signed commits: ❌
  - Include administrators: ❌ (Sanchay can override)
  - Allow force pushes: ❌
  - Allow deletions: ❌
```

**For `dev` branch:**
```yaml
Protection Rules:
  - Require pull request reviews before merging: ✅
  - Required number of reviews: 1
  - Dismiss stale reviews: ✅
  - Require review from code owners: ✅ 
  - Restrict pushes that create files: ❌
  - Require status checks to pass: ✅
  - Required status checks: ["validate"]
  - Require branches to be up to date: ✅
  - Include administrators: ❌
  - Allow force pushes: ✅ (Sanchay only)
  - Allow deletions: ❌
```

#### 2. Repository Secrets

Navigate to Settings → Secrets and Variables → Actions

**Required Secrets:**
```
GITHUB_TOKEN
Description: GitHub token for releases and package access
Value: [Copy from existing .env file]

Code Signing Secrets (Future):
WINDOWS_CERTIFICATE (when ready to automate signing)
CERTIFICATE_PASSWORD
```

#### 3. Collaborator Permissions

```
@Sanchay-T: Admin (can override all protections)
@Aiyaz17: Write (can create PRs, cannot bypass protections)
@poojanvig: Write (can create PRs, cannot bypass protections)
```

---

## 5. CI/CD Implementation

### Directory Structure Creation

Create the following directory structure:
```
.github/
├── workflows/
│   ├── pr-validation.yml
│   ├── dev-integration.yml
│   └── release.yml
├── CODEOWNERS
└── dependabot.yml (optional)
```

### 5.1 CODEOWNERS File

Create `.github/CODEOWNERS`:
```bash
# CypherSol Code Ownership Rules
# This file determines who must review changes to specific files/directories

# ========================================
# ULTRA CRITICAL - Only Sanchay
# ========================================
# Core build and architecture files that can break everything
/frontend/package.json @Sanchay-T
/frontend/main.js @Sanchay-T
/postbuild.py @Sanchay-T
/frontend/scripts/ @Sanchay-T
/.github/ @Sanchay-T
/CLAUDE.md @Sanchay-T
/.env @Sanchay-T

# ========================================
# HIGH RISK - Requires Cross-Team Review
# ========================================
# Files that affect multiple systems and can cause integration issues
/frontend/ipc/ @poojanvig @Aiyaz17
/frontend/db/ @poojanvig @Sanchay-T
/backend/main.py @poojanvig @Sanchay-T
/frontend/drizzle.config.js @poojanvig @Sanchay-T

# ========================================  
# MODERATE RISK - Domain Expert + One Review
# ========================================
# Files that require domain knowledge but are less likely to break builds
/backend/ @poojanvig
/frontend/react-app/src/ @Aiyaz17

# ========================================
# TALLY INTEGRATION - Poojan's Domain
# ========================================
# Tally-specific functionality that Poojan owns
/frontend/ipc/tallyHandlers.js @poojanvig
/frontend/ipc/VoucherHandlers.js @poojanvig
/frontend/media/vouchers/ @poojanvig

# ========================================
# SAFE ZONES - Single Review Required
# ========================================
# Files that can be modified with minimal risk
/frontend/react-app/src/components/ @Aiyaz17
/frontend/react-app/src/Pages/ @Aiyaz17
/frontend/react-app/src/contexts/ @Aiyaz17
/docs/ @Sanchay-T

# ========================================
# DOCUMENTATION - Anyone Can Contribute
# ========================================
*.md @Sanchay-T
/README.md
```

### 5.2 PR Validation Workflow

Create `.github/workflows/pr-validation.yml`:
```yaml
name: PR Validation
on:
  pull_request:
    branches: [dev]
    types: [opened, synchronize, reopened]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  validate:
    name: Validate Build Process
    runs-on: windows-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python ${{ env.PYTHON_VERSION }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            frontend/package-lock.json
            frontend/react-app/package-lock.json

      - name: Validate Python Backend Setup
        run: |
          Write-Host "🐍 Setting up Python backend..." -ForegroundColor Yellow
          python -m venv .venv
          .\.venv\Scripts\Activate.ps1
          
          Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
          pip install --upgrade pip
          pip install -r backend/requirements.txt
          
          Write-Host "🔍 Validating backend imports..." -ForegroundColor Yellow
          python -c "
          try:
              import backend.main
              print('✅ Backend imports successful')
          except Exception as e:
              print(f'❌ Backend import failed: {e}')
              exit(1)
          "
          
          Write-Host "✅ Python backend validation complete" -ForegroundColor Green
        shell: pwsh

      - name: Validate Frontend Dependencies
        run: |
          Write-Host "⚛️ Setting up frontend dependencies..." -ForegroundColor Yellow
          
          cd frontend
          npm ci
          
          Write-Host "📱 Setting up React app dependencies..." -ForegroundColor Yellow
          cd react-app
          npm ci
          
          Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
        shell: pwsh

      - name: Validate React Build Process
        run: |
          Write-Host "🏗️ Testing React build process..." -ForegroundColor Yellow
          
          cd frontend/react-app
          npm run build
          
          Write-Host "🔍 Validating build outputs..." -ForegroundColor Yellow
          if (Test-Path "build/index.html") {
            Write-Host "✅ React build successful - index.html found" -ForegroundColor Green
          } else {
            Write-Host "❌ React build failed - index.html missing" -ForegroundColor Red
            exit 1
          }
          
          if (Test-Path "build/static") {
            Write-Host "✅ Static assets generated successfully" -ForegroundColor Green
          } else {
            Write-Host "❌ Static assets missing" -ForegroundColor Red
            exit 1
          }
        shell: pwsh

      - name: Validate Electron Build Configuration
        run: |
          Write-Host "⚡ Validating Electron build configuration..." -ForegroundColor Yellow
          
          cd frontend
          
          Write-Host "🔍 Checking package.json scripts..." -ForegroundColor Yellow
          $packageJson = Get-Content package.json | ConvertFrom-Json
          
          $requiredScripts = @('build', 'build:react', 'build:electron', 'sync-version')
          foreach ($script in $requiredScripts) {
            if ($packageJson.scripts.$script) {
              Write-Host "✅ Script '$script' found" -ForegroundColor Green
            } else {
              Write-Host "❌ Required script '$script' missing" -ForegroundColor Red
              exit 1
            }
          }
          
          Write-Host "🔍 Testing Electron build preparation..." -ForegroundColor Yellow
          npm run build:react
          
          Write-Host "✅ Electron build validation complete" -ForegroundColor Green
        shell: pwsh

      - name: Check Critical Files
        run: |
          Write-Host "📋 Checking for critical files..." -ForegroundColor Yellow
          
          $criticalFiles = @(
            'backend/main.py',
            'backend/requirements.txt', 
            'frontend/main.js',
            'frontend/package.json',
            'postbuild.py'
          )
          
          foreach ($file in $criticalFiles) {
            if (Test-Path $file) {
              Write-Host "✅ Critical file '$file' exists" -ForegroundColor Green
            } else {
              Write-Host "❌ Critical file '$file' missing" -ForegroundColor Red
              exit 1
            }
          }
          
          Write-Host "✅ All critical files present" -ForegroundColor Green
        shell: pwsh

      - name: Validation Summary
        run: |
          Write-Host "🎉 PR Validation Complete!" -ForegroundColor Green
          Write-Host "✅ Python backend setup validated" -ForegroundColor Green
          Write-Host "✅ Frontend dependencies validated" -ForegroundColor Green  
          Write-Host "✅ React build process validated" -ForegroundColor Green
          Write-Host "✅ Electron configuration validated" -ForegroundColor Green
          Write-Host "✅ Critical files verified" -ForegroundColor Green
          Write-Host "" 
          Write-Host "🚀 Ready for review and merge to dev!" -ForegroundColor Cyan
        shell: pwsh
```

### 5.3 Dev Integration Workflow

Create `.github/workflows/dev-integration.yml`:
```yaml
name: Dev Integration Test
on:
  push:
    branches: [dev]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  integration-test:
    name: Full Integration Build Test
    runs-on: windows-latest
    timeout-minutes: 45
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python ${{ env.PYTHON_VERSION }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Full Python Backend Build
        run: |
          Write-Host "🐍 Building Python backend..." -ForegroundColor Yellow
          
          # Create virtual environment
          python -m venv .venv
          .\.venv\Scripts\Activate.ps1
          
          # Upgrade pip and install dependencies
          pip install --upgrade pip
          pip install -r backend/requirements.txt
          
          Write-Host "📦 Installing PyInstaller..." -ForegroundColor Yellow
          pip install pyinstaller
          
          Write-Host "🔨 Building Python executable..." -ForegroundColor Yellow
          pyinstaller --onedir backend.main
          
          # Verify executable was created
          if (Test-Path "dist/main/main.exe") {
            Write-Host "✅ Python executable built successfully" -ForegroundColor Green
          } else {
            Write-Host "❌ Python executable build failed" -ForegroundColor Red
            exit 1
          }
        shell: pwsh

      - name: Run Post-Build Processing
        run: |
          Write-Host "⚙️ Running post-build processing..." -ForegroundColor Yellow
          
          .\.venv\Scripts\Activate.ps1
          python postbuild.py
          
          Write-Host "✅ Post-build processing complete" -ForegroundColor Green
        shell: pwsh

      - name: Frontend Integration Build
        run: |
          Write-Host "⚛️ Building frontend components..." -ForegroundColor Yellow
          
          # Install frontend dependencies
          cd frontend
          npm ci
          
          # Install React dependencies
          cd react-app
          npm ci
          cd ..
          
          Write-Host "🏗️ Building React application..." -ForegroundColor Yellow
          npm run build:react
          
          Write-Host "📱 Testing Electron build process..." -ForegroundColor Yellow
          npm run build:electron
          
          Write-Host "✅ Frontend integration build complete" -ForegroundColor Green
        shell: pwsh

      - name: Verify Gateway Server Requirement
        run: |
          Write-Host "🔍 Checking for Gateway Server..." -ForegroundColor Yellow
          
          $gatewayPath = "frontend/gatewayServer/gatewayserver.exe"
          if (Test-Path $gatewayPath) {
            Write-Host "✅ Gateway server found at $gatewayPath" -ForegroundColor Green
          } else {
            Write-Host "⚠️ Gateway server not found - this is expected in CI" -ForegroundColor Yellow
            Write-Host "📝 Note: Gateway server is added manually before final release" -ForegroundColor Yellow
          }
        shell: pwsh

      - name: Build Artifacts Summary
        run: |
          Write-Host "📊 Build Artifacts Summary:" -ForegroundColor Cyan
          Write-Host "=================================" -ForegroundColor Cyan
          
          if (Test-Path "dist/main") {
            Write-Host "✅ Python backend: dist/main/" -ForegroundColor Green
          }
          
          if (Test-Path "frontend/react-app/build") {
            Write-Host "✅ React build: frontend/react-app/build/" -ForegroundColor Green
          }
          
          if (Test-Path "frontend/dist") {
            Write-Host "✅ Electron dist: frontend/dist/" -ForegroundColor Green
          }
          
          Write-Host "=================================" -ForegroundColor Cyan
          Write-Host "🎉 Integration test completed successfully!" -ForegroundColor Green
          Write-Host "🚀 Ready for production release when merged to main" -ForegroundColor Cyan
        shell: pwsh

      - name: Upload Build Artifacts (For Debugging)
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: failed-build-logs
          path: |
            **/*.log
            **/build/
          retention-days: 7
```

### 5.4 Production Release Workflow

Create `.github/workflows/release.yml`:
```yaml
name: Production Release Build
on:
  push:
    branches: [main]
    tags: ['v*']

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  release:
    name: Build Production Release
    runs-on: windows-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Extract version from tag/branch
        id: version
        run: |
          if ($env:GITHUB_REF -match 'refs/tags/(.*)') {
            $version = $matches[1]
            Write-Host "🏷️ Tagged version: $version"
          } else {
            $version = "dev-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Write-Host "🔄 Development version: $version"
          }
          
          echo "version=$version" >> $env:GITHUB_OUTPUT
          echo "VERSION=$version" >> $env:GITHUB_ENV
        shell: pwsh

      - name: Setup Python ${{ env.PYTHON_VERSION }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Build Python Backend
        run: |
          Write-Host "🐍 Building Python backend for production..." -ForegroundColor Yellow
          
          python -m venv .venv
          .\.venv\Scripts\Activate.ps1
          
          pip install --upgrade pip
          pip install -r backend/requirements.txt
          pip install pyinstaller
          
          Write-Host "🔨 Creating production Python executable..." -ForegroundColor Yellow
          pyinstaller --onedir backend.main
          
          Write-Host "⚙️ Running post-build processing..." -ForegroundColor Yellow
          python postbuild.py
          
          Write-Host "✅ Python backend build complete" -ForegroundColor Green
        shell: pwsh

      - name: Build Frontend for Production
        run: |
          Write-Host "⚛️ Building frontend for production..." -ForegroundColor Yellow
          
          cd frontend
          npm ci --production=false
          
          cd react-app  
          npm ci --production=false
          cd ..
          
          Write-Host "🔧 Running production build..." -ForegroundColor Yellow
          npm run build
          
          Write-Host "✅ Frontend production build complete" -ForegroundColor Green
        shell: pwsh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Prepare Release Artifacts
        run: |
          Write-Host "📦 Preparing release artifacts..." -ForegroundColor Yellow
          
          # Create release directory
          New-Item -ItemType Directory -Force -Path "release-artifacts"
          
          # Copy Windows installer if it exists
          $windowsInstaller = Get-ChildItem -Path "frontend/dist" -Filter "*.exe" | Select-Object -First 1
          if ($windowsInstaller) {
            Copy-Item $windowsInstaller.FullName "release-artifacts/CypherEdge-Setup-$env:VERSION.exe"
            Write-Host "✅ Windows installer: CypherEdge-Setup-$env:VERSION.exe" -ForegroundColor Green
          }
          
          # Copy other build artifacts
          $artifacts = @("*.dmg", "*.zip", "*.AppImage")
          foreach ($pattern in $artifacts) {
            $files = Get-ChildItem -Path "frontend/dist" -Filter $pattern -ErrorAction SilentlyContinue
            foreach ($file in $files) {
              Copy-Item $file.FullName "release-artifacts/"
              Write-Host "✅ Artifact: $($file.Name)" -ForegroundColor Green
            }
          }
          
          Write-Host "📋 Release artifacts prepared" -ForegroundColor Green
        shell: pwsh

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          draft: true
          prerelease: contains(github.ref, 'beta')
          files: release-artifacts/*
          body: |
            ## CypherEdge Release ${{ steps.version.outputs.version }}
            
            ### 🔄 Build Information
            - **Version**: ${{ steps.version.outputs.version }}
            - **Build Date**: ${{ github.event.head_commit.timestamp }}
            - **Commit**: ${{ github.sha }}
            
            ### 📦 Installation
            
            **Windows:**
            1. Download `CypherEdge-Setup-${{ steps.version.outputs.version }}.exe`
            2. Run as administrator
            3. Follow installation prompts
            
            **Important Notes:**
            - ⚠️ These binaries are **UNSIGNED** 
            - 🔐 Final signed release will be published separately
            - 🧪 Use for testing and validation only
            
            ### 🛠️ For Release Manager (Sanchay)
            1. Download the unsigned installer
            2. Add `gatewayserver.exe` to the installation package
            3. Code sign on the dedicated Windows PC
            4. Update this release with the signed binary
            5. Mark as published (remove draft status)
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Build Artifacts  
        uses: actions/upload-artifact@v4
        with:
          name: production-build-${{ steps.version.outputs.version }}
          path: |
            release-artifacts/
            frontend/dist/
          retention-days: 30

      - name: Release Summary
        run: |
          Write-Host "🎉 Production Release Build Complete!" -ForegroundColor Green
          Write-Host "=================================" -ForegroundColor Cyan
          Write-Host "📋 Version: $env:VERSION" -ForegroundColor White
          Write-Host "📋 Commit: $env:GITHUB_SHA" -ForegroundColor White
          Write-Host "📋 Build Status: Success" -ForegroundColor Green
          Write-Host "=================================" -ForegroundColor Cyan
          Write-Host "" 
          Write-Host "📝 Next Steps for Release Manager:" -ForegroundColor Yellow
          Write-Host "1. Download unsigned artifacts from this build" -ForegroundColor White
          Write-Host "2. Add gatewayserver.exe to the package" -ForegroundColor White  
          Write-Host "3. Code sign on dedicated Windows PC" -ForegroundColor White
          Write-Host "4. Upload signed version to GitHub Release" -ForegroundColor White
          Write-Host "5. Publish release to customers" -ForegroundColor White
        shell: pwsh
```

### 5.5 Optional: Dependabot Configuration

Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  # Frontend npm dependencies
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "Sanchay-T"
    assignees:
      - "Aiyaz17"

  # React app dependencies  
  - package-ecosystem: "npm"
    directory: "/frontend/react-app"
    schedule:
      interval: "weekly"  
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "Sanchay-T"
    assignees:
      - "Aiyaz17"

  # Python dependencies
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday" 
      time: "09:00"
    open-pull-requests-limit: 3
    reviewers:
      - "Sanchay-T"
    assignees:
      - "poojanvig"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00" 
    reviewers:
      - "Sanchay-T"
```

---

## 6. Team Workflow Documentation

### 6.1 Daily Development Workflow

#### For Frontend Developer (Aiyaz)

**Starting a new feature:**
```bash
# 1. Sync with latest dev branch
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b frontend/new-dashboard-feature

# 3. Work on feature
# Edit files in /frontend/react-app/src/

# 4. Test locally
cd frontend/react-app
npm start    # Test React app
cd ..
npm run electron  # Test in Electron

# 5. Commit and push
git add .
git commit -m "feat: add new dashboard feature

- Added new dashboard components
- Implemented user preferences
- Updated navigation flow"

git push origin frontend/new-dashboard-feature

# 6. Create PR via GitHub UI
# Target: dev branch
# Reviewer: Poojan will auto-review
```

**Code Review Checklist for Aiyaz:**
- [ ] React components follow existing patterns
- [ ] No hardcoded styles (use Tailwind classes)
- [ ] IPC calls use proper error handling
- [ ] UI components are accessible
- [ ] No console.log statements in production code

#### For Backend/Tally Developer (Poojan)

**Starting backend work:**
```bash
# 1. Sync with dev
git checkout dev
git pull origin dev

# 2. Create feature branch  
git checkout -b backend/improve-pdf-processing
# or
git checkout -b tally/fix-voucher-upload

# 3. Set up development environment
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r backend/requirements.txt

# 4. Work on feature
# Edit backend files or tally handlers

# 5. Test locally
cd backend
python main.py    # Start FastAPI server
# Test endpoints with frontend

# 6. Commit and push
git add .
git commit -m "fix: improve PDF extraction accuracy

- Updated ML model parameters
- Added better error handling for corrupted PDFs  
- Improved text extraction for scanned documents"

git push origin backend/improve-pdf-processing

# 7. Create PR to dev branch
# Reviewer: Aiyaz will review
```

**Code Review Checklist for Poojan:**
- [ ] FastAPI endpoints follow existing patterns
- [ ] Database queries are optimized
- [ ] Error handling includes proper logging
- [ ] IPC handlers maintain backward compatibility
- [ ] Tally XML generation follows schema requirements

#### For Release Manager (Sanchay)

**Weekly release process:**
```bash
# Monday morning - Check what's ready for release

# 1. Review dev branch status
git checkout dev
git pull origin dev
git log --oneline main..dev    # See what's new

# 2. Test dev branch locally (optional but recommended)
# Run full build process to verify

# 3. If dev is stable, merge to main
git checkout main
git pull origin main
git merge dev

# 4. Create release tag
git tag v2.0.3
git push origin main --tags

# 5. Monitor GitHub Actions
# - Release workflow will run automatically
# - Download unsigned artifacts when complete

# 6. Final release process (local machine)
# - Download artifacts from GitHub
# - Add gatewayserver.exe 
# - Code sign on Windows PC
# - Upload signed version to GitHub Release
# - Mark release as published
```

### 6.2 Code Review Guidelines

#### What Requires Immediate Review (High Priority)

**Backend Changes (Poojan → Aiyaz/Sanchay review):**
- Any changes to `/backend/main.py`
- Database schema modifications
- New IPC handler implementations
- Tally integration changes
- API endpoint modifications

**Frontend Architecture (Aiyaz → Poojan/Sanchay review):**
- Changes to `/frontend/main.js`
- New IPC channel implementations  
- Electron configuration updates
- Build process modifications

**Critical Infrastructure (Anyone → Sanchay review):**
- Package.json script changes
- Database migration files
- CI/CD workflow updates
- Version management changes

#### Review Standards

**Code Quality Checklist:**
- [ ] Follows existing code patterns and style
- [ ] Includes appropriate error handling
- [ ] No hardcoded values (use configuration)
- [ ] Backward compatibility maintained
- [ ] Performance implications considered
- [ ] Security implications reviewed

**Testing Checklist:**
- [ ] Changes tested locally
- [ ] No breaking changes to existing functionality
- [ ] Database migrations tested (if applicable)
- [ ] Cross-platform compatibility considered (Windows primary)

**Documentation Checklist:**
- [ ] Complex logic includes comments
- [ ] API changes documented
- [ ] Breaking changes clearly noted
- [ ] CLAUDE.md updated if needed

### 6.3 Branch Management Strategy

#### Branch Types and Purposes

```
main
├── dev (integration)
│   ├── frontend/feature-name (Aiyaz)
│   ├── backend/feature-name (Poojan)
│   ├── tally/feature-name (Poojan)
│   └── hotfix/urgent-fix (Anyone)
└── release/v2.0.3 (optional for complex releases)
```

**Branch Naming Convention:**
- `frontend/description` - React/Electron UI changes
- `backend/description` - Python FastAPI changes  
- `tally/description` - Tally integration features
- `hotfix/description` - Critical bug fixes
- `docs/description` - Documentation updates

**Merge Strategy:**
- Feature branches → `dev` (via PR with review)
- `dev` → `main` (Sanchay only, weekly/bi-weekly)
- `hotfix/*` → `main` (emergency only, with immediate follow-up to dev)

#### Branch Cleanup

**Automated cleanup:** GitHub will automatically delete merged feature branches

**Manual cleanup (monthly):**
```bash
# Delete old local branches
git branch --merged | grep -v "main\|dev" | xargs git branch -d

# Sync with remote deletions
git remote prune origin
```

---

## 7. Troubleshooting & Maintenance

### 7.1 Common CI/CD Issues

#### Build Failures

**Python Backend Issues:**
```yaml
# Problem: pip install fails
# Solution: Clear cache and retry
- name: Clear pip cache and retry
  run: |
    pip cache purge
    pip install --no-cache-dir -r backend/requirements.txt
```

**Node.js Issues:**
```yaml
# Problem: npm install fails
# Solution: Clear node_modules and package-lock
- name: Clean install frontend dependencies
  run: |
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue  
    npm install
```

**Windows-specific Issues:**
```yaml
# Problem: Path too long errors
# Solution: Use shorter paths in CI
- name: Setup with short paths
  run: |
    # Use shorter working directory
    cd /d D:\
    git clone ${{ github.repository }} build
    cd build
```

#### GitHub Actions Workflow Issues

**Secret Access Issues:**
```bash
# Problem: GITHUB_TOKEN not accessible
# Check: Repository Settings → Secrets and Variables → Actions
# Ensure: GITHUB_TOKEN is added with correct permissions

# Problem: Permission denied on release creation
# Solution: Check token has 'write' permissions to repository
```

**Workflow Permission Issues:**
```yaml
# Add to workflow if needed:
permissions:
  contents: write
  pull-requests: read
  actions: read
```

### 7.2 Maintenance Tasks

#### Weekly Tasks (Automated)
- [ ] Dependency updates via Dependabot
- [ ] Security vulnerability scanning
- [ ] Build performance monitoring

#### Monthly Tasks (Manual)
- [ ] Review and clean up old branches
- [ ] Update CI/CD workflows if needed
- [ ] Review and update CODEOWNERS if team changes
- [ ] Archive old GitHub Action runs

#### Quarterly Tasks (Strategic)
- [ ] Review team workflow effectiveness
- [ ] Update build process documentation
- [ ] Evaluate need for additional testing
- [ ] Review security and code signing process

### 7.3 Emergency Procedures

#### Critical Bug Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main  
git checkout -b hotfix/critical-security-fix

# 2. Make minimal fix
# Edit only necessary files

# 3. Test locally
# Verify fix works and doesn't break anything

# 4. Push and create emergency PR
git push origin hotfix/critical-security-fix
# Create PR targeting main (skip dev for emergency)

# 5. Get expedited review from Sanchay
# Merge directly to main after approval

# 6. Create immediate release
git tag v2.0.4-hotfix
git push origin main --tags

# 7. Backport to dev
git checkout dev
git merge main
git push origin dev
```

#### Build System Failure Recovery

**If GitHub Actions completely fails:**
```bash
# 1. Local emergency build
# Follow manual build process documented in CLAUDE.md

# 2. Bypass CI temporarily
# Admin can force-push to main if absolutely necessary

# 3. Fix CI/CD system
# Debug workflow files, check secrets, verify permissions

# 4. Re-enable protections
# Restore branch protection rules after fix
```

### 7.4 Monitoring and Alerts

#### Key Metrics to Monitor
- [ ] Build success rate (should be >95%)
- [ ] Average build time (should be <30 minutes)  
- [ ] PR review time (target <24 hours)
- [ ] Release frequency (weekly target)

#### Alert Conditions
- Build failures on `main` or `dev` branches
- Security vulnerability detected in dependencies
- Build time exceeding 45 minutes
- Multiple failed releases

### 7.5 Team Onboarding

#### New Developer Setup Checklist

**Repository Access:**
- [ ] Add as collaborator with Write permissions
- [ ] Add to appropriate CODEOWNERS sections
- [ ] Introduce to existing team members

**Development Environment:**
- [ ] Clone repository and follow CLAUDE.md setup
- [ ] Verify local build process works
- [ ] Set up development tools (VS Code, Python, Node.js)
- [ ] Test creating a small PR to dev branch

**Process Training:**
- [ ] Review this CI/CD implementation guide
- [ ] Understand branch strategy and naming conventions
- [ ] Practice code review process
- [ ] Understand release workflow

---

## 8. Implementation Checklist

### Phase 1: Basic Setup (30 minutes)
- [ ] Create `.github/` directory structure
- [ ] Add CODEOWNERS file
- [ ] Configure repository secrets (GITHUB_TOKEN)
- [ ] Set up branch protection rules for `main` and `dev`

### Phase 2: CI/CD Workflows (45 minutes)  
- [ ] Create `pr-validation.yml` workflow
- [ ] Create `dev-integration.yml` workflow
- [ ] Create `release.yml` workflow
- [ ] Test PR validation with sample PR

### Phase 3: Team Training (60 minutes)
- [ ] Walk through new workflow with Aiyaz
- [ ] Walk through new workflow with Poojan  
- [ ] Create test PRs to verify process
- [ ] Document any team-specific adjustments

### Phase 4: Go Live (15 minutes)
- [ ] Create `dev` branch from current `main`
- [ ] Enable all branch protections
- [ ] Announce new workflow to team
- [ ] Monitor first few PRs for issues

### Total Implementation Time: ~2.5 hours

---

## 9. Success Criteria

After full implementation, the team should achieve:

**Efficiency Gains:**
- ✅ Zero build failures due to environment issues  
- ✅ Consistent builds across all developer machines
- ✅ Automated validation prevents breaking changes
- ✅ Sanchay's time reduced from daily involvement to weekly releases

**Quality Improvements:**  
- ✅ All code changes reviewed before merging
- ✅ Critical files protected from accidental changes
- ✅ Build process documented and automated
- ✅ Team can work independently without blocking each other

**Process Reliability:**
- ✅ Releases are predictable and tested
- ✅ Rollback capability via git tags
- ✅ Clear ownership and responsibility matrix
- ✅ Emergency hotfix process established

---

## 10. Contact and Support

**For Implementation Questions:**
- Primary Contact: Sanchay (@Sanchay-T)
- Frontend Questions: Aiyaz (@Aiyaz17)  
- Backend/Tally Questions: Poojan (@poojanvig)

**Resources:**
- Main Documentation: `CLAUDE.md`
- Architecture Overview: `docs/01-architecture-overview.md`
- Build Process: This document

**Emergency Contacts:**
- For CI/CD system failures: @Sanchay-T
- For critical production issues: @Sanchay-T  
- For build process questions: Refer to CLAUDE.md

---

*This guide represents the complete implementation plan for CypherSol CI/CD system. It should be reviewed and updated as the team and processes evolve.*
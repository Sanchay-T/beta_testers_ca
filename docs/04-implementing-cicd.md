# Implementing CI/CD with GitHub Actions

## Table of Contents
1. [Introduction to CI/CD](#introduction-to-cicd)
2. [Setting Up GitHub Actions](#setting-up-github-actions)
3. [Build Workflow](#build-workflow)
4. [Test Workflow](#test-workflow)
5. [Release Workflow](#release-workflow)
6. [Secrets Management](#secrets-management)
7. [Monitoring and Debugging](#monitoring-and-debugging)

## Introduction to CI/CD

### What is CI/CD?

**Continuous Integration (CI)**: Automatically build and test your code when changes are pushed
**Continuous Deployment (CD)**: Automatically release builds to users

### Benefits for CypherSol

1. **No more manual builds** - Push code, get installer
2. **Catch bugs early** - Tests run automatically
3. **Consistent builds** - Same process every time
4. **Automatic releases** - Users get updates faster
5. **Build history** - Track what changed when

### GitHub Actions Overview

```yaml
name: Workflow Name
on: [push]  # When to run
jobs:
  build:    # Job name
    runs-on: windows-latest  # Where to run
    steps:
      - uses: actions/checkout@v3  # What to do
      - name: Build app
        run: echo "Building..."
```

## Setting Up GitHub Actions

### 1. Create Workflow Directory

In your repository:
```
ca-offline-suite/
└── .github/
    └── workflows/
        ├── build.yml
        ├── test.yml
        └── release.yml
```

### 2. Basic Build Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build CypherSol

# When to run this workflow
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
    # 1. Checkout code
    - name: Checkout repository
      uses: actions/checkout@v3
    
    # 2. Setup Python
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
        cache: 'pip'
    
    # 3. Setup Node.js
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    # 4. Install Python dependencies
    - name: Install Python dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r backend/requirements.txt
        pip install pyinstaller
    
    # 5. Install Node dependencies
    - name: Install Node dependencies
      working-directory: frontend
      run: npm ci
    
    # 6. Build Python backend
    - name: Build Python backend
      run: |
        pyinstaller --onefile --windowed `
          --name ca-backend `
          --distpath dist `
          --hidden-import pandas `
          --hidden-import numpy `
          --hidden-import sklearn `
          backend/main.py
    
    # 7. Run postbuild
    - name: Run postbuild
      run: python postbuild.py
    
    # 8. Build Electron app
    - name: Build Electron app
      working-directory: frontend
      env:
        NODE_ENV: production
        ELECTRON_IS_DEV: false
      run: npm run build
    
    # 9. Upload artifacts
    - name: Upload installer
      uses: actions/upload-artifact@v3
      with:
        name: cyphersol-installer
        path: frontend/dist/*.exe
        retention-days: 7
```

## Build Workflow

### Enhanced Build with Caching

Create `.github/workflows/build-enhanced.yml`:

```yaml
name: Build with Cache

on:
  push:
    branches: [ main, develop ]

env:
  PYTHON_VERSION: '3.9'
  NODE_VERSION: '16'

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    # Cache Python dependencies
    - name: Cache Python packages
      uses: actions/cache@v3
      with:
        path: ~\AppData\Local\pip\Cache
        key: ${{ runner.os }}-pip-${{ hashFiles('backend/requirements.txt') }}
        restore-keys: |
          ${{ runner.os }}-pip-
    
    # Cache Node modules
    - name: Cache node modules
      uses: actions/cache@v3
      with:
        path: frontend/node_modules
        key: ${{ runner.os }}-node-${{ hashFiles('frontend/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-
    
    # Cache PyInstaller build
    - name: Cache PyInstaller
      uses: actions/cache@v3
      with:
        path: |
          build
          dist
        key: ${{ runner.os }}-pyinstaller-${{ hashFiles('backend/**/*.py') }}
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Install dependencies
      run: |
        # Python deps
        pip install -r backend/requirements.txt
        pip install pyinstaller
        
        # Node deps
        cd frontend
        npm ci
        cd ..
    
    - name: Build application
      run: |
        # Set environment
        $env:NODE_ENV = "production"
        $env:ELECTRON_IS_DEV = "false"
        
        # Build Python
        pyinstaller --onefile --windowed --name ca-backend backend/main.py
        
        # Postbuild
        python postbuild.py
        
        # Build Electron
        cd frontend
        npm run build
    
    - name: Create release info
      run: |
        # Generate build info
        $buildInfo = @{
          version = (Get-Content frontend/package.json | ConvertFrom-Json).version
          commit = "${{ github.sha }}"
          branch = "${{ github.ref_name }}"
          buildDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
          runner = "${{ runner.os }}"
        }
        $buildInfo | ConvertTo-Json | Out-File -FilePath build-info.json
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: cyphersol-${{ github.ref_name }}-${{ github.sha }}
        path: |
          frontend/dist/*.exe
          build-info.json
```

## Test Workflow

### Automated Testing

Create `.github/workflows/test.yml`:

```yaml
name: Run Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-backend:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install pytest pytest-cov
    
    - name: Run Python tests
      run: |
        cd backend
        pytest --cov=. --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./backend/coverage.xml
        flags: backend
  
  test-frontend:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
    
    - name: Install dependencies
      working-directory: frontend
      run: npm ci
    
    - name: Run linting
      working-directory: frontend
      run: npm run lint
    
    - name: Run tests
      working-directory: frontend
      run: npm test -- --coverage --watchAll=false
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./frontend/coverage/lcov.info
        flags: frontend
  
  test-integration:
    runs-on: windows-latest
    needs: [test-backend, test-frontend]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup environment
      run: |
        # Setup both Python and Node
        # ... (similar to build workflow)
    
    - name: Start services
      run: |
        # Start Python backend
        Start-Process python -ArgumentList "backend/main.py" -PassThru
        
        # Wait for backend
        Start-Sleep -Seconds 5
        
        # Check if backend is running
        $response = Invoke-WebRequest -Uri "http://localhost:7500/health" -UseBasicParsing
        if ($response.StatusCode -ne 200) {
          throw "Backend not responding"
        }
    
    - name: Run integration tests
      run: |
        # Run your integration tests here
        npm run test:integration
```

## Release Workflow

### Automated Releases

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'  # Triggers on version tags like v1.0.0

jobs:
  create-release:
    runs-on: windows-latest
    
    outputs:
      upload_url: ${{ steps.create_release.outputs.upload_url }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Extract version
      id: version
      run: |
        $version = "${{ github.ref }}".Replace("refs/tags/v", "")
        echo "VERSION=$version" >> $env:GITHUB_OUTPUT
    
    - name: Create Release
      id: create_release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: CypherSol ${{ steps.version.outputs.VERSION }}
        body: |
          ## What's New
          - Auto-generated release for version ${{ steps.version.outputs.VERSION }}
          
          ## Installation
          1. Download the installer below
          2. Run the installer
          3. Follow the installation wizard
          
          ## Requirements
          - Windows 10 or later
          - 4GB RAM minimum
          - 500MB free disk space
        draft: false
        prerelease: false
  
  build-and-upload:
    needs: create-release
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    # Build steps (same as build workflow)
    # ...
    
    - name: Get installer path
      id: installer
      run: |
        $installer = Get-ChildItem -Path "frontend/dist" -Filter "*.exe" | Select-Object -First 1
        echo "INSTALLER_PATH=$($installer.FullName)" >> $env:GITHUB_OUTPUT
        echo "INSTALLER_NAME=$($installer.Name)" >> $env:GITHUB_OUTPUT
    
    - name: Upload Release Asset
      uses: actions/upload-release-asset@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        upload_url: ${{ needs.create-release.outputs.upload_url }}
        asset_path: ${{ steps.installer.outputs.INSTALLER_PATH }}
        asset_name: ${{ steps.installer.outputs.INSTALLER_NAME }}
        asset_content_type: application/x-msdownload
```

### Auto-Update Configuration

Update your `autoUpdater` configuration:

```javascript
// In main.js
const { autoUpdater } = require("electron-updater");

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: "github",
  owner: "your-github-username",
  repo: "ca-offline-suite",
  private: false,  // Set to true if private repo
});

// For private repos, set token
if (process.env.GH_TOKEN) {
  autoUpdater.requestHeaders = {
    'Authorization': `token ${process.env.GH_TOKEN}`
  };
}
```

## Secrets Management

### Setting Up Secrets

1. Go to your GitHub repository
2. Settings → Secrets → Actions
3. Add these secrets:

```yaml
# Required secrets:
GH_TOKEN          # GitHub personal access token
CODE_SIGN_CERT    # Base64 encoded certificate
CODE_SIGN_PASS    # Certificate password

# Optional:
SENTRY_DSN        # For error tracking
SLACK_WEBHOOK     # For notifications
```

### Using Secrets in Workflows

```yaml
- name: Code signing
  env:
    CERT_BASE64: ${{ secrets.CODE_SIGN_CERT }}
    CERT_PASSWORD: ${{ secrets.CODE_SIGN_PASS }}
  run: |
    # Decode certificate
    $certBytes = [Convert]::FromBase64String($env:CERT_BASE64)
    [IO.File]::WriteAllBytes("cert.pfx", $certBytes)
    
    # Sign executable
    & signtool sign /f cert.pfx /p $env:CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "dist\ca-backend.exe"
    
    # Clean up
    Remove-Item cert.pfx
```

## Monitoring and Debugging

### Workflow Status Badge

Add to your README.md:

```markdown
![Build Status](https://github.com/your-username/ca-offline-suite/workflows/Build%20CypherSol/badge.svg)
![Tests](https://github.com/your-username/ca-offline-suite/workflows/Run%20Tests/badge.svg)
```

### Debugging Failed Builds

1. **Check logs**: Click on the failed job to see detailed logs

2. **Run locally**: Reproduce the issue
   ```bash
   act -j build  # Uses https://github.com/nektos/act
   ```

3. **Add debug logging**:
   ```yaml
   - name: Debug info
     run: |
       echo "Current directory: $(pwd)"
       echo "Files in dist:"
       ls -la dist/
       echo "Environment:"
       env | sort
   ```

4. **SSH into runner** (for debugging):
   ```yaml
   - name: Setup tmate session
     if: ${{ failure() }}
     uses: mxschmitt/action-tmate@v3
   ```

### Notifications

#### Slack Notifications

```yaml
- name: Slack Notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
    text: |
      Build ${{ job.status }} for ${{ github.ref }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
```

#### Email Notifications

```yaml
- name: Send email
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: Build Failed - CypherSol
    to: team@cyphersol.com
    from: GitHub Actions
    body: |
      Build failed for commit ${{ github.sha }}
      Check the logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Best Practices

### 1. Branch Protection

Set up branch protection rules:
- Require PR reviews
- Require status checks to pass
- Require branches to be up to date

### 2. Workflow Organization

```yaml
# Reusable workflow
name: Reusable Build

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  build:
    uses: ./.github/workflows/build-template.yml
    with:
      environment: ${{ inputs.environment }}
```

### 3. Cost Optimization

- Use workflow conditions:
  ```yaml
  if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
  ```

- Cancel previous runs:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

### 4. Security

- Never hardcode secrets
- Use environment protection rules
- Regularly rotate tokens
- Use OIDC for cloud deployments

## Gradual Implementation

### Phase 1: Basic Build (Week 1)
1. Set up basic build workflow
2. Test with manual triggers
3. Fix any build issues

### Phase 2: Testing (Week 2)
1. Add unit tests
2. Set up test workflow
3. Add coverage reporting

### Phase 3: Automated Release (Week 3)
1. Set up release workflow
2. Test with beta releases
3. Configure auto-updater

### Phase 4: Advanced Features (Week 4)
1. Add code signing
2. Set up notifications
3. Implement staged rollouts

## Troubleshooting

### Common Issues

1. **"Node modules not found"**
   - Ensure `npm ci` instead of `npm install`
   - Check cache configuration

2. **"PyInstaller fails"**
   - Add hidden imports
   - Check Python version matches

3. **"Upload fails"**
   - Check artifact size limits (2GB)
   - Verify file paths

4. **"Auto-update not working"**
   - Ensure GH_TOKEN is set
   - Check release format

## Next Steps

1. Start with the basic build workflow
2. Add tests gradually
3. Set up automated releases
4. Monitor and improve based on metrics
5. Read `05-best-practices.md` for code quality
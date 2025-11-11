# Fix Broken CypherEdge UAT Installation
# This script uninstalls the corrupted version and reinstalls properly

Write-Host ""
Write-Host "================================================" -ForegroundColor Red
Write-Host "  Fix Broken CypherEdge UAT Installation" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

Write-Host "The app is broken due to ASAR corruption from downgrade." -ForegroundColor Yellow
Write-Host "Root cause: We 'upgraded' from 2.3.403 to 2.3.404, but 2.3.404 was actually 2.3.402 renamed." -ForegroundColor Yellow
Write-Host ""

# Step 1: Kill any running instances
Write-Host "Step 1: Stopping any running instances..." -ForegroundColor Cyan
Get-Process -Name "CypherEdge*" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "[OK] All instances stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Check if app is installed
Write-Host "Step 2: Checking installation status..." -ForegroundColor Cyan
$installPath = "C:\Program Files\CypherEdge UAT"
$installerPath = "C:\Users\sanch\AppData\Local\CypherEdge UAT-updater\pending\CypherEdge-UAT-Setup-2.3.404.exe"

if (Test-Path $installPath) {
    Write-Host "[FOUND] App installed at: $installPath" -ForegroundColor Yellow

    # Step 3: Uninstall
    Write-Host ""
    Write-Host "Step 3: Uninstalling corrupted version..." -ForegroundColor Cyan
    $uninstallerPath = "$installPath\Uninstall CypherEdge UAT.exe"

    if (Test-Path $uninstallerPath) {
        Write-Host "Running uninstaller..." -ForegroundColor Yellow
        Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait
        Write-Host "[OK] Uninstall completed" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Uninstaller not found, manually removing..." -ForegroundColor Yellow
        Remove-Item -Path $installPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Installation directory removed" -ForegroundColor Green
    }
} else {
    Write-Host "[INFO] App not currently installed" -ForegroundColor Gray
}

# Step 4: Clean AppData
Write-Host ""
Write-Host "Step 4: Cleaning AppData (preserving logs)..." -ForegroundColor Cyan
$appDataPath = "$env:APPDATA\CypherEdge-UAT"
$logsBackupPath = "$env:USERPROFILE\Desktop\cypheredge-logs-backup"

if (Test-Path $appDataPath) {
    # Backup logs
    if (Test-Path "$appDataPath\logs") {
        Copy-Item -Path "$appDataPath\logs" -Destination $logsBackupPath -Recurse -Force
        Write-Host "[OK] Logs backed up to: $logsBackupPath" -ForegroundColor Green
    }

    # Remove AppData (except backups)
    Remove-Item -Path "$appDataPath\*" -Exclude "logs" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] AppData cleaned" -ForegroundColor Green
} else {
    Write-Host "[INFO] No AppData to clean" -ForegroundColor Gray
}

# Step 5: Install fresh version
Write-Host ""
Write-Host "Step 5: Installing fresh version..." -ForegroundColor Cyan

if (Test-Path $installerPath) {
    Write-Host "Using downloaded installer: $installerPath" -ForegroundColor Yellow
    Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
    Write-Host "[OK] Installation completed" -ForegroundColor Green
} else {
    Write-Host "[WARN] Downloaded installer not found" -ForegroundColor Yellow
    Write-Host "Please manually run the installer from:" -ForegroundColor Yellow
    Write-Host "  - Download latest from DigitalOcean Spaces, OR" -ForegroundColor Yellow
    Write-Host "  - Use your original 2.3.403 installer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  INSTALLATION FIX COMPLETE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "What happened?" -ForegroundColor Cyan
Write-Host "  - We tested the update flow by copying 2.3.402 installer" -ForegroundColor White
Write-Host "  - Renamed it to 2.3.404 to trigger update detection" -ForegroundColor White
Write-Host "  - Your app was 2.3.403, so 'updating' to 2.3.404 (actually 2.3.402)" -ForegroundColor White
Write-Host "  - This DOWNGRADED the app, corrupting the ASAR file" -ForegroundColor White
Write-Host ""
Write-Host "Solution:" -ForegroundColor Cyan
Write-Host "  - Uninstalled corrupted version" -ForegroundColor Green
Write-Host "  - Cleaned AppData (logs backed up)" -ForegroundColor Green
Write-Host "  - Ready for fresh install" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Launch CypherEdge UAT" -ForegroundColor White
Write-Host "  2. To test updates properly, we need to build a REAL 2.3.404" -ForegroundColor White
Write-Host "     (Not just rename an old installer)" -ForegroundColor White
Write-Host ""

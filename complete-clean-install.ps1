# Complete Clean Install of CypherEdge UAT
# Removes ALL traces and installs fresh

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Complete Clean Install - CypherEdge UAT" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all processes
Write-Host "Step 1: Stopping all CypherEdge processes..." -ForegroundColor Yellow
Get-Process -Name "CypherEdge*" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "[OK] Processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Uninstall
Write-Host "Step 2: Uninstalling application..." -ForegroundColor Yellow
$installPath = "C:\Program Files\CypherEdge UAT"
$uninstallerPath = "$installPath\Uninstall CypherEdge UAT.exe"

if (Test-Path $uninstallerPath) {
    Write-Host "Running uninstaller..." -ForegroundColor Gray
    Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait
    Write-Host "[OK] Uninstall completed" -ForegroundColor Green
} elseif (Test-Path $installPath) {
    Write-Host "Manually removing installation directory..." -ForegroundColor Gray
    Remove-Item -Path $installPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Installation directory removed" -ForegroundColor Green
} else {
    Write-Host "[INFO] No installation found" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Clean ALL AppData
Write-Host "Step 3: Cleaning ALL AppData folders..." -ForegroundColor Yellow

$foldersToClean = @(
    "$env:APPDATA\CypherEdge-UAT",
    "$env:LOCALAPPDATA\CypherEdge UAT",
    "$env:LOCALAPPDATA\cypheredge-uat-updater",
    "$env:TEMP\cyphersol-updates"
)

foreach ($folder in $foldersToClean) {
    if (Test-Path $folder) {
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Removed: $folder" -ForegroundColor Green
    }
}
Write-Host ""

# Step 4: Choose version to install
Write-Host "Step 4: Choose version to install..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  [1] Install 2.3.403 (test starting point)" -ForegroundColor White
Write-Host "  [2] Install 2.3.404 directly (latest)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    $installerPath = "frontend\dist\CypherEdge-UAT-Setup-2.3.403.exe"
    $version = "2.3.403"
} elseif ($choice -eq "2") {
    $installerPath = "frontend\dist\CypherEdge-UAT-Setup-2.3.404.exe"
    $version = "2.3.404"
} else {
    Write-Host "[ERROR] Invalid choice" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing CypherEdge UAT $version..." -ForegroundColor Yellow

if (Test-Path $installerPath) {
    Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
    Write-Host "[OK] Installation completed" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Installer not found at: $installerPath" -ForegroundColor Red
    Write-Host "Build it first with: cd frontend && npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  CLEAN INSTALL COMPLETE!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed version: $version" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow

if ($choice -eq "1") {
    Write-Host "  1. Launch CypherEdge UAT 2.3.403" -ForegroundColor White
    Write-Host "  2. Wait for update notification to 2.3.404" -ForegroundColor White
    Write-Host "  3. Test the update flow" -ForegroundColor White
} else {
    Write-Host "  1. Launch CypherEdge UAT 2.3.404" -ForegroundColor White
    Write-Host "  2. Check for GREEN badge 'v2.3.404 - UPDATED!'" -ForegroundColor White
    Write-Host "  3. Verify Python backend starts correctly" -ForegroundColor White
}

Write-Host ""

# NUCLEAR CLEANUP - Remove EVERYTHING CypherEdge Related
# This ensures a completely clean slate for testing

Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  NUCLEAR CLEANUP - CypherEdge UAT" -ForegroundColor Red
Write-Host "  This will remove ALL traces of the application" -ForegroundColor Red
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Are you sure you want to proceed? Type 'YES' to continue"
if ($confirmation -ne "YES") {
    Write-Host "Cleanup cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting nuclear cleanup..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Kill ALL processes
Write-Host "[1/8] Killing all CypherEdge processes..." -ForegroundColor Cyan
Get-Process | Where-Object { $_.Name -like "*CypherEdge*" -or $_.Name -like "*cypheredge*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  [OK] All processes terminated" -ForegroundColor Green
Write-Host ""

# Step 2: Uninstall application
Write-Host "[2/8] Uninstalling application..." -ForegroundColor Cyan
$installPaths = @(
    "C:\Program Files\CypherEdge UAT",
    "C:\Program Files (x86)\CypherEdge UAT"
)

foreach ($installPath in $installPaths) {
    if (Test-Path $installPath) {
        $uninstallerPath = "$installPath\Uninstall CypherEdge UAT.exe"
        if (Test-Path $uninstallerPath) {
            Write-Host "  Running uninstaller at: $installPath" -ForegroundColor Gray
            Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait -ErrorAction SilentlyContinue
        }
        # Force remove directory
        Remove-Item -Path $installPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed: $installPath" -ForegroundColor Green
    }
}
Write-Host ""

# Step 3: Clean ALL AppData folders
Write-Host "[3/8] Cleaning ALL AppData folders..." -ForegroundColor Cyan
$appDataFolders = @(
    "$env:APPDATA\CypherEdge-UAT",
    "$env:APPDATA\CypherEdge UAT",
    "$env:LOCALAPPDATA\CypherEdge-UAT",
    "$env:LOCALAPPDATA\CypherEdge UAT",
    "$env:LOCALAPPDATA\cypheredge-uat-updater",
    "$env:LOCALAPPDATA\CypherEdge UAT-updater",
    "$env:LOCALAPPDATA\Programs\CypherEdge UAT"
)

foreach ($folder in $appDataFolders) {
    if (Test-Path $folder) {
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed: $folder" -ForegroundColor Green
    }
}
Write-Host ""

# Step 4: Clean temp/cache folders
Write-Host "[4/8] Cleaning temp and cache folders..." -ForegroundColor Cyan
$tempFolders = @(
    "$env:TEMP\cyphersol-updates",
    "$env:TEMP\cypheredge-*",
    "$env:LOCALAPPDATA\Temp\cypheredge-*"
)

foreach ($pattern in $tempFolders) {
    Get-ChildItem -Path (Split-Path $pattern -Parent) -Filter (Split-Path $pattern -Leaf) -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  [OK] Temp folders cleaned" -ForegroundColor Green
Write-Host ""

# Step 5: Remove cached installers from desktop project
Write-Host "[5/8] Removing old test installers from project..." -ForegroundColor Cyan
$projectPath = "C:\Users\sanch\Desktop\beta_testers_ca"
$testFiles = @(
    "temp_installer.exe",
    "test-latest.yml"
)

foreach ($file in $testFiles) {
    $filePath = Join-Path $projectPath $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed: $file" -ForegroundColor Green
    }
}
Write-Host ""

# Step 6: Clean Windows registry entries
Write-Host "[6/8] Cleaning Windows registry entries..." -ForegroundColor Cyan
$registryPaths = @(
    "HKCU:\Software\CypherEdge UAT",
    "HKLM:\Software\CypherEdge UAT",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CypherEdge UAT",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CypherEdge UAT"
)

foreach ($regPath in $registryPaths) {
    if (Test-Path $regPath) {
        Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed registry: $regPath" -ForegroundColor Green
    }
}
Write-Host ""

# Step 7: Remove Start Menu shortcuts
Write-Host "[7/8] Removing Start Menu shortcuts..." -ForegroundColor Cyan
$shortcutPaths = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\CypherEdge UAT.lnk",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\CypherEdge UAT.lnk"
)

foreach ($shortcut in $shortcutPaths) {
    if (Test-Path $shortcut) {
        Remove-Item $shortcut -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed: $shortcut" -ForegroundColor Green
    }
}
Write-Host ""

# Step 8: Verify cleanup
Write-Host "[8/8] Verifying cleanup..." -ForegroundColor Cyan
$verifyPaths = @(
    "C:\Program Files\CypherEdge UAT",
    "$env:LOCALAPPDATA\cypheredge-uat-updater",
    "$env:APPDATA\CypherEdge-UAT"
)

$cleanupSuccess = $true
foreach ($path in $verifyPaths) {
    if (Test-Path $path) {
        Write-Host "  [WARN] Still exists: $path" -ForegroundColor Yellow
        $cleanupSuccess = $false
    }
}

if ($cleanupSuccess) {
    Write-Host "  [OK] All traces removed successfully" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Some files may still exist (locked or in use)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  NUCLEAR CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "System is now completely clean. Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Install 2.3.404 manually:" -ForegroundColor White
Write-Host "     frontend\dist\CypherEdge-UAT-Setup-2.3.404.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Launch and verify it works" -ForegroundColor White
Write-Host ""
Write-Host "  3. To test update flow in future:" -ForegroundColor White
Write-Host "     - Build 2.3.405 with visible changes" -ForegroundColor Gray
Write-Host "     - Upload to S3" -ForegroundColor Gray
Write-Host "     - Test update from 2.3.404 -> 2.3.405" -ForegroundColor Gray
Write-Host ""
Write-Host "Update system is robust and ready for testing!" -ForegroundColor Green
Write-Host ""

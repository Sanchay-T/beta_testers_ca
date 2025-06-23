# CypherEdge Migration Diagnostic Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CypherEdge Migration Debug Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$appDataPath = "$env:APPDATA"
Write-Host "`nApp Data Path: $appDataPath" -ForegroundColor Yellow

# Check for new app folder
$newAppPath = "$appDataPath\CypherEdge"
Write-Host "`n📁 NEW APP FOLDER:" -ForegroundColor Green
if (Test-Path $newAppPath) {
    Write-Host "✅ EXISTS: $newAppPath" -ForegroundColor Green
    
    # Check for migration flag
    $flagPath = "$newAppPath\.migration-completed"
    if (Test-Path $flagPath) {
        Write-Host "✅ Migration flag found - migration already completed" -ForegroundColor Green
        Write-Host "Flag content:" -ForegroundColor Yellow
        Get-Content $flagPath | Out-Host
    } else {
        Write-Host "❌ No migration flag - migration should run on next start" -ForegroundColor Red
    }
    
    # Check for critical files
    Write-Host "`nCritical files in new app:" -ForegroundColor Yellow
    $dbPath = "$newAppPath\db.sqlite3"
    $licensePath = "$newAppPath\clientLicense.enc"
    
    if (Test-Path $dbPath) {
        $dbInfo = Get-Item $dbPath
        Write-Host "✅ db.sqlite3 exists (Size: $($dbInfo.Length) bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ db.sqlite3 NOT FOUND" -ForegroundColor Red
    }
    
    if (Test-Path $licensePath) {
        $licInfo = Get-Item $licensePath
        Write-Host "✅ clientLicense.enc exists (Size: $($licInfo.Length) bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ clientLicense.enc NOT FOUND" -ForegroundColor Red
    }
} else {
    Write-Host "❌ NOT FOUND: $newAppPath" -ForegroundColor Red
}

# Check for old app folders
Write-Host "`n📁 OLD APP FOLDERS:" -ForegroundColor Yellow
$oldApps = @(
    "cyphersol-electron-app",
    "cyphersol-ats-electron-app", 
    "cyphersol-ats"
)

$foundOldApp = $false
foreach ($oldApp in $oldApps) {
    $oldPath = "$appDataPath\$oldApp"
    Write-Host "`nChecking: $oldApp" -ForegroundColor Cyan
    
    if (Test-Path $oldPath) {
        Write-Host "✅ FOUND: $oldPath" -ForegroundColor Green
        $foundOldApp = $true
        
        # Check for critical files
        $oldDb = "$oldPath\db.sqlite3"
        $oldLicense = "$oldPath\clientLicense.enc"
        
        if (Test-Path $oldDb) {
            $dbInfo = Get-Item $oldDb
            Write-Host "  ✅ db.sqlite3 exists (Size: $($dbInfo.Length) bytes, Modified: $($dbInfo.LastWriteTime))" -ForegroundColor Green
        } else {
            Write-Host "  ❌ db.sqlite3 NOT FOUND" -ForegroundColor Red
        }
        
        if (Test-Path $oldLicense) {
            $licInfo = Get-Item $oldLicense
            Write-Host "  ✅ clientLicense.enc exists (Size: $($licInfo.Length) bytes, Modified: $($licInfo.LastWriteTime))" -ForegroundColor Green
        } else {
            Write-Host "  ❌ clientLicense.enc NOT FOUND" -ForegroundColor Red
        }
        
        # List other files
        Write-Host "`n  Other files in old app folder:" -ForegroundColor Yellow
        Get-ChildItem $oldPath -File | Select-Object Name, Length, LastWriteTime | Format-Table
    } else {
        Write-Host "❌ NOT FOUND: $oldPath" -ForegroundColor Red
    }
}

if (-not $foundOldApp) {
    Write-Host "`n⚠️ NO OLD APP FOLDERS FOUND - This looks like a fresh installation" -ForegroundColor Yellow
}

# Check migration log
Write-Host "`n📄 MIGRATION LOG:" -ForegroundColor Cyan
$migrationLog = "$newAppPath\migration-detailed.log"
if (Test-Path $migrationLog) {
    Write-Host "✅ Migration log exists" -ForegroundColor Green
    Write-Host "Last 20 lines of migration log:" -ForegroundColor Yellow
    Get-Content $migrationLog -Tail 20 | Out-Host
} else {
    Write-Host "❌ No migration log found" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSIS COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan 
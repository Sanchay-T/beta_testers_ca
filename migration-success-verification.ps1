# =============================================================================
# CYPHERSOL → CYPEREDGE MIGRATION SUCCESS VERIFICATION SCRIPT
# =============================================================================
# This script checks both directories after migration to verify success
# Run this after installing v2.0.0 to confirm everything worked
# =============================================================================

Write-Host "[MIGRATION SUCCESS VERIFICATION]" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Define paths
$oldPath = "$env:APPDATA\cyphersol-electron-app"
$newPath = "$env:APPDATA\CypherEdge"

Write-Host "`n[SYSTEM INFORMATION]" -ForegroundColor Yellow
Write-Host "Computer: $env:COMPUTERNAME"
Write-Host "User: $env:USERNAME"
Write-Host "Current Time: $(Get-Date)"

Write-Host "`n[DIRECTORY PATHS]" -ForegroundColor Yellow
Write-Host "Old Path: $oldPath"
Write-Host "New Path: $newPath"

# Function to analyze directory contents
function Analyze-Directory {
    param($Path, $Name)
    
    Write-Host "`n[$Name DIRECTORY ANALYSIS]" -ForegroundColor Green
    Write-Host "-" * 40 -ForegroundColor Green
    
    if (Test-Path $Path) {
        Write-Host "[OK] Directory exists: $Path" -ForegroundColor Green
        
        # Get all files and folders
        $items = Get-ChildItem -Path $Path -Recurse -Force | Sort-Object Name
        
        if ($items.Count -gt 0) {
            Write-Host "Total items found: $($items.Count)" -ForegroundColor White
            
            # Categorize items
            $files = $items | Where-Object { -not $_.PSIsContainer }
            $folders = $items | Where-Object { $_.PSIsContainer }
            
            Write-Host "Files: $($files.Count)" -ForegroundColor White
            Write-Host "Folders: $($folders.Count)" -ForegroundColor White
            
            # Show important files
            Write-Host "`n[IMPORTANT FILES]:" -ForegroundColor Cyan
            
            $importantFiles = @(
                "db.sqlite3",
                "database.sqlite", 
                "clientLicense.enc",
                "main.exe",
                "gatewayService.exe",
                ".migration-completed"
            )
            
            foreach ($fileName in $importantFiles) {
                $file = $files | Where-Object { $_.Name -eq $fileName }
                if ($file) {
                    $sizeKB = [math]::Round($file.Length / 1KB, 2)
                    $lastWrite = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                    Write-Host "  [OK] $fileName" -ForegroundColor Green
                    Write-Host "     Size: $sizeKB KB | Modified: $lastWrite" -ForegroundColor Gray
                } else {
                    Write-Host "  [MISSING] $fileName (not found)" -ForegroundColor Red
                }
            }
            
            # Show all files for complete picture
            Write-Host "`n[ALL FILES]:" -ForegroundColor Cyan
            foreach ($file in $files) {
                $sizeKB = [math]::Round($file.Length / 1KB, 2)
                $relativePath = $file.FullName.Replace("$Path\", "")
                Write-Host "  FILE: $relativePath ($sizeKB KB)" -ForegroundColor White
            }
            
            # Show folders
            if ($folders.Count -gt 0) {
                Write-Host "`n[FOLDERS]:" -ForegroundColor Cyan
                foreach ($folder in $folders) {
                    $relativePath = $folder.FullName.Replace("$Path\", "")
                    Write-Host "  FOLDER: $relativePath" -ForegroundColor White
                }
            }
            
                } else {
            Write-Host "[WARNING] Directory is empty" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "[ERROR] Directory does not exist: $Path" -ForegroundColor Red
    }
}

# Analyze both directories
Analyze-Directory -Path $oldPath -Name "OLD (cyphersol-electron-app)"  
Analyze-Directory -Path $newPath -Name "NEW (CypherEdge)"

# Migration verification
Write-Host "`n[MIGRATION VERIFICATION]" -ForegroundColor Magenta
Write-Host "-" * 40 -ForegroundColor Magenta

$migrationSuccess = $false
$migrationMessages = @()

# Check if new directory exists
if (Test-Path $newPath) {
    $migrationMessages += "[OK] New CypherEdge directory created"
    
    # Check for migration completion flag
    $migrationFlag = Join-Path $newPath ".migration-completed"
    if (Test-Path $migrationFlag) {
        $migrationMessages += "[OK] Migration completion flag found"
        $migrationSuccess = $true
        
        # Read migration details
        try {
            $migrationData = Get-Content $migrationFlag | ConvertFrom-Json
            Write-Host "`n[MIGRATION DETAILS]:" -ForegroundColor Cyan
            Write-Host "  Migration Time: $($migrationData.completedAt)" -ForegroundColor White
            Write-Host "  Old App: $($migrationData.oldAppName)" -ForegroundColor White
            Write-Host "  New App: $($migrationData.newAppName)" -ForegroundColor White
            Write-Host "  Items Migrated: $($migrationData.totalItems)" -ForegroundColor White
            Write-Host "  Successful: $($migrationData.successfulMigrations)" -ForegroundColor White
            Write-Host "  Failed: $($migrationData.failedMigrations)" -ForegroundColor White
        } catch {
            $migrationMessages += "[WARNING] Could not read migration details"
        }
    } else {
        $migrationMessages += "[WARNING] No migration completion flag found"
    }
    
    # Check for key files
    $keyFiles = @("db.sqlite3", "clientLicense.enc")
    foreach ($file in $keyFiles) {
        $filePath = Join-Path $newPath $file
        if (Test-Path $filePath) {
            $migrationMessages += "[OK] Key file migrated: $file"
        } else {
            $migrationMessages += "[ERROR] Missing key file: $file"
            $migrationSuccess = $false
        }
    }
    
} else {
    $migrationMessages += "[ERROR] New CypherEdge directory not found"
}

# Check if old directory still exists (should be preserved)
if (Test-Path $oldPath) {
    $migrationMessages += "[OK] Old directory preserved (good backup)"
} else {
    $migrationMessages += "[WARNING] Old directory was removed"
}

# Display results
Write-Host "`n[MIGRATION RESULTS]:" -ForegroundColor Yellow
foreach ($message in $migrationMessages) {
    Write-Host "  $message"
}

if ($migrationSuccess) {
    Write-Host "`n[SUCCESS] MIGRATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "[OK] Your data has been successfully migrated to CypherEdge" -ForegroundColor Green
} else {
    Write-Host "`n[WARNING] MIGRATION MAY HAVE ISSUES" -ForegroundColor Yellow
    Write-Host "[INFO] Please check the details above" -ForegroundColor Yellow
}

Write-Host "`n[VERIFICATION COMPLETE]" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Keep window open
Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 
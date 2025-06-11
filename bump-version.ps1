# Version Bumping Script for CypherEdge (PowerShell)
# 
# Usage:
#   .\bump-version.ps1 <new-version>
#   .\bump-version.ps1 2.0.2

param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

# Validate version format (basic semver check)
if ($NewVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "❌ Error: Invalid version format. Use semantic versioning (e.g., 2.0.2)" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Bumping version to $NewVersion..." -ForegroundColor Green

# Define all files that need version updates
$FilesToUpdate = @(
    @{
        Path = "frontend\package.json"
        Type = "json"
        Field = "version"
        Description = "Frontend package.json"
    },
    @{
        Path = "frontend\react-app\package.json"
        Type = "json"
        Field = "version"
        Description = "React app package.json"
    },
    @{
        Path = "frontend\react-app\splash.html"
        Type = "text"
        Pattern = "Version \d+\.\d+\.\d+"
        Replacement = "Version $NewVersion"
        Description = "Splash screen version badge"
    },
    @{
        Path = "frontend\react-app\src\components\MainDashboardComponents\MainDashboard.js"
        Type = "text"
        Pattern = "v\d+\.\d+\.\d+"
        Replacement = "v$NewVersion"
        Description = "Dashboard version display"
    },
    @{
        Path = "frontend\main.js"
        Type = "text"
        Patterns = @(
            @{
                Pattern = "🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v\d+\.\d+\.\d+"
                Replacement = "🚀 COMPREHENSIVE AUTO-UPDATE LOGGING SYSTEM v$NewVersion"
            },
            @{
                Pattern = "🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v\d+\.\d+\.\d+ INITIALIZED"
                Replacement = "🚀 CYPHERSOL AUTO-UPDATE LOGGING SYSTEM v$NewVersion INITIALIZED"
            }
        )
        Description = "Main.js logging system version"
    }
)

$UpdatedFiles = 0
$Errors = 0

# Function to update JSON files
function Update-JsonFile {
    param($FilePath, $Field, $NewValue)
    
    try {
        $content = Get-Content $FilePath -Raw
        $json = $content | ConvertFrom-Json
        $oldVersion = $json.$Field
        
        $json.$Field = $NewValue
        
        $json | ConvertTo-Json -Depth 10 | Set-Content $FilePath
        Write-Host "✅ $FilePath`: $oldVersion → $NewValue" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Error updating $FilePath`: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to update text files with regex patterns
function Update-TextFile {
    param($FilePath, $Patterns, $Description)
    
    try {
        $content = Get-Content $FilePath -Raw
        $hasChanges = $false
        $changeLog = @()

        if ($Patterns -is [array]) {
            foreach ($patternObj in $Patterns) {
                $matches = [regex]::Matches($content, $patternObj.Pattern)
                if ($matches.Count -gt 0) {
                    foreach ($match in $matches) {
                        $changeLog += "$($match.Value) → $($patternObj.Replacement)"
                    }
                    $content = $content -replace $patternObj.Pattern, $patternObj.Replacement
                    $hasChanges = $true
                }
            }
        } else {
            $matches = [regex]::Matches($content, $Patterns.Pattern)
            if ($matches.Count -gt 0) {
                foreach ($match in $matches) {
                    $changeLog += "$($match.Value) → $($Patterns.Replacement)"
                }
                $content = $content -replace $Patterns.Pattern, $Patterns.Replacement
                $hasChanges = $true
            }
        }

        if ($hasChanges) {
            Set-Content $FilePath $content
            Write-Host "✅ $FilePath`: $($changeLog -join ', ')" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠️  $FilePath`: No version patterns found to update" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ Error updating $FilePath`: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Process each file
foreach ($file in $FilesToUpdate) {
    Write-Host "`n📝 Updating $($file.Description)..." -ForegroundColor Cyan
    
    # Check if file exists
    if (-not (Test-Path $file.Path)) {
        Write-Host "❌ File not found: $($file.Path)" -ForegroundColor Red
        $Errors++
        continue
    }

    $success = $false

    switch ($file.Type) {
        "json" {
            $success = Update-JsonFile $file.Path $file.Field $NewVersion
        }
        "text" {
            if ($file.Patterns) {
                $success = Update-TextFile $file.Path $file.Patterns $file.Description
            } else {
                $success = Update-TextFile $file.Path @{ Pattern = $file.Pattern; Replacement = $file.Replacement } $file.Description
            }
        }
        default {
            Write-Host "❌ Unknown file type: $($file.Type)" -ForegroundColor Red
            $Errors++
            continue
        }
    }

    if ($success) {
        $UpdatedFiles++
    } else {
        $Errors++
    }
}

# Summary
Write-Host "`n$('=' * 50)" -ForegroundColor White
Write-Host "📊 VERSION BUMP SUMMARY" -ForegroundColor White
Write-Host "$('=' * 50)" -ForegroundColor White
Write-Host "🎯 Target Version: $NewVersion" -ForegroundColor White
Write-Host "✅ Files Updated: $UpdatedFiles" -ForegroundColor Green
Write-Host "❌ Errors: $Errors" -ForegroundColor Red

if ($Errors -eq 0) {
    Write-Host "`n🎉 Version bump completed successfully!" -ForegroundColor Green
    Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review the changes with git diff" -ForegroundColor White
    Write-Host "2. Test the application" -ForegroundColor White
    Write-Host "3. Commit and push the changes" -ForegroundColor White
    Write-Host "4. Build and release the new version" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Version bump completed with errors. Please review the issues above." -ForegroundColor Yellow
    exit 1
} 
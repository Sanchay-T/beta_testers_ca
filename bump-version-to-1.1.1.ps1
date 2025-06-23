# Bump version to 1.1.1 for testing auto-update

Write-Host "`n========================================"  -ForegroundColor Cyan
Write-Host "Bumping Version to 1.1.1" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to frontend directory if not already there
if (Test-Path "package.json") {
    Write-Host "Already in frontend directory" -ForegroundColor Green
} else {
    Write-Host "Navigating to frontend directory..." -ForegroundColor Yellow
    Set-Location frontend
}

# Read current package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

# Display current version
Write-Host "Current version: $($packageJson.version)" -ForegroundColor Yellow

# Update version to 1.1.1
$packageJson.version = "1.1.1"

# Write back to package.json
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"

Write-Host "Updated version to: 1.1.1" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can build version 1.1.1 for testing the update!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run build-with-test-cert.ps1 to build 1.1.1" -ForegroundColor White
Write-Host "2. Upload CypherEdge-Setup-1.1.1.exe and latest.yml to GitHub release" -ForegroundColor White
Write-Host "3. Test the update from 1.1.0 to 1.1.1" -ForegroundColor White

Read-Host -Prompt "`nPress Enter to continue" 
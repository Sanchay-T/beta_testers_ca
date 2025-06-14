# Build CypherEdge with Test Certificate

Write-Host "`n========================================"  -ForegroundColor Cyan
Write-Host "Building CypherEdge with Test Certificate" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Set certificate environment variables
$env:CSC_LINK = "$env:USERPROFILE\CypherEdgeTest.pfx"
$env:CSC_KEY_PASSWORD = "testpass"

Write-Host "Certificate: $env:CSC_LINK" -ForegroundColor Yellow
Write-Host ""

# Navigate to frontend directory if not already there
if (Test-Path "package.json") {
    Write-Host "Already in frontend directory" -ForegroundColor Green
} else {
    Write-Host "Navigating to frontend directory..." -ForegroundColor Yellow
    Set-Location frontend
}

Write-Host "Building version 1.1.0..." -ForegroundColor Yellow
Write-Host ""

# Run the build
npm run build:fast

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Output: dist\CypherEdge-Setup-1.1.0.exe" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "Build failed! Check the error messages above." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Read-Host -Prompt "`nPress Enter to continue" 
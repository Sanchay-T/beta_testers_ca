# Simple Gateway Stop Script
Write-Host "Stopping Gateway Services and Processes..." -ForegroundColor Yellow

# Stop services
$services = @("MyLanService", "LicensingServer")
foreach ($svc in $services) {
    Write-Host "Checking $svc..." -NoNewline
    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
    Write-Host " Done" -ForegroundColor Green
}

# Wait
Start-Sleep -Seconds 3

# Kill processes
Write-Host "Killing gateway processes..." -NoNewline
Get-Process -Name "*gateway*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host " Done" -ForegroundColor Green

# Verify
Start-Sleep -Seconds 2
$procs = Get-Process -Name "*gateway*" -ErrorAction SilentlyContinue
if (!$procs) {
    Write-Host "`nSUCCESS: All gateway processes terminated!" -ForegroundColor Green
    Write-Host "`nNow update your main.js stopEverythingNeatly function with the code in gateway-cleanup-code.js" -ForegroundColor Cyan
} else {
    Write-Host "`nWARNING: Some processes still running!" -ForegroundColor Red
    $procs | Format-Table Name, Id -AutoSize
} 
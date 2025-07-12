# Simple Gateway Killer Script
Write-Host "GATEWAY KILLER SCRIPT" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# 1. Find all gateway processes
Write-Host "STEP 1: Finding gateway processes..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -like "*gateway*" }

if ($processes) {
    Write-Host "Found these processes:" -ForegroundColor Green
    foreach ($p in $processes) {
        Write-Host "  - $($p.ProcessName) (PID: $($p.Id)) - Path: $($p.Path)" -ForegroundColor White
    }
} else {
    Write-Host "No gateway processes found" -ForegroundColor Red
}

# 2. Find services
Write-Host ""
Write-Host "STEP 2: Finding services..." -ForegroundColor Yellow
$mylan = Get-Service -Name "MyLanService" -ErrorAction SilentlyContinue
$licensing = Get-Service -Name "LicensingServer" -ErrorAction SilentlyContinue

if ($mylan) {
    Write-Host "  - MyLanService: $($mylan.Status)" -ForegroundColor White
}
if ($licensing) {
    Write-Host "  - LicensingServer: $($licensing.Status)" -ForegroundColor White
}

# 3. Stop services
Write-Host ""
Write-Host "STEP 3: Stopping services..." -ForegroundColor Yellow
if ($mylan) {
    Stop-Service -Name "MyLanService" -Force -ErrorAction SilentlyContinue
    Write-Host "  - Stopped MyLanService" -ForegroundColor Green
}
if ($licensing) {
    Stop-Service -Name "LicensingServer" -Force -ErrorAction SilentlyContinue
    Write-Host "  - Stopped LicensingServer" -ForegroundColor Green
}

# 4. Wait
Write-Host ""
Write-Host "Waiting 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 5. Kill processes
Write-Host ""
Write-Host "STEP 4: Killing processes..." -ForegroundColor Yellow

# Try graceful first
Get-Process | Where-Object { $_.ProcessName -like "*gateway*" } | ForEach-Object {
    Write-Host "  - Killing $($_.ProcessName) (PID: $($_.Id))..." -NoNewline
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host " Done" -ForegroundColor Green
}

# Wait and check
Start-Sleep -Seconds 2

# 6. Final check
Write-Host ""
Write-Host "STEP 5: Final check..." -ForegroundColor Yellow
$remaining = Get-Process | Where-Object { $_.ProcessName -like "*gateway*" }

if ($remaining) {
    Write-Host "PROBLEM: Still running:" -ForegroundColor Red
    foreach ($p in $remaining) {
        Write-Host "  - $($p.ProcessName) (PID: $($p.Id))" -ForegroundColor Red
    }
} else {
    Write-Host "SUCCESS: All gateway processes terminated!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan 
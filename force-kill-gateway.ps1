# Force Kill Gateway Script
Write-Host "FORCE KILL GATEWAY" -ForegroundColor Red
Write-Host "==================" -ForegroundColor Red
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
}

# 1. Get initial info
Write-Host "Finding gateway process..." -ForegroundColor Yellow
$proc = Get-Process | Where-Object { $_.ProcessName -like "*gateway*" } | Select-Object -First 1

if ($proc) {
    Write-Host "Found: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor White
    Write-Host "Path: $($proc.Path)" -ForegroundColor Gray
    
    # Try different kill methods
    Write-Host ""
    Write-Host "Attempting multiple kill methods..." -ForegroundColor Yellow
    
    # Method 1: PowerShell Stop-Process with Force
    Write-Host "Method 1: Stop-Process -Force..." -NoNewline
    try {
        Stop-Process -Id $proc.Id -Force -ErrorAction Stop
        Write-Host " Done" -ForegroundColor Green
    } catch {
        Write-Host " Failed" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
    
    # Method 2: WMI Terminate
    Write-Host "Method 2: WMI Terminate..." -NoNewline
    try {
        $wmiProc = Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)"
        $wmiProc.Terminate() | Out-Null
        Write-Host " Done" -ForegroundColor Green
    } catch {
        Write-Host " Failed" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
    
    # Method 3: Taskkill with /F /T
    Write-Host "Method 3: Taskkill /F /T..." -NoNewline
    try {
        $result = & taskkill /PID $($proc.Id) /F /T 2>&1
        Write-Host " Done" -ForegroundColor Green
    } catch {
        Write-Host " Failed" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
    
    # Method 4: Kill by image name
    Write-Host "Method 4: Taskkill /IM /F..." -NoNewline
    try {
        $result = & taskkill /IM "gatewayService.exe" /F 2>&1
        Write-Host " Done" -ForegroundColor Green
    } catch {
        Write-Host " Failed" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
    
    # Check if still running
    Write-Host ""
    Write-Host "Checking result..." -ForegroundColor Yellow
    $stillRunning = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    
    if ($stillRunning) {
        Write-Host "STILL RUNNING! Process is protected or being restarted." -ForegroundColor Red
        Write-Host ""
        Write-Host "Checking what might be keeping it alive..." -ForegroundColor Yellow
        
        # Check if it's a service
        $services = Get-WmiObject Win32_Service | Where-Object { $_.PathName -like "*gatewayService*" }
        if ($services) {
            Write-Host "Found related services:" -ForegroundColor Yellow
            foreach ($svc in $services) {
                Write-Host "  - $($svc.Name): $($svc.State)" -ForegroundColor White
                if ($svc.State -eq "Running") {
                    Write-Host "    Stopping service..." -NoNewline
                    Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
                    Write-Host " Done" -ForegroundColor Green
                }
            }
        }
        
        # Try one more time after stopping services
        Start-Sleep -Seconds 2
        Write-Host ""
        Write-Host "Final kill attempt..." -NoNewline
        & taskkill /IM "gatewayService.exe" /F /T 2>&1 | Out-Null
        Write-Host " Done" -ForegroundColor Green
        
        Start-Sleep -Seconds 1
        $finalCheck = Get-Process | Where-Object { $_.ProcessName -like "*gateway*" }
        if ($finalCheck) {
            Write-Host ""
            Write-Host "FAILED: Process still running!" -ForegroundColor Red
            Write-Host "The process might be:" -ForegroundColor Yellow
            Write-Host "  - Protected by antivirus" -ForegroundColor White
            Write-Host "  - Running with higher privileges" -ForegroundColor White
            Write-Host "  - Being instantly restarted by a service" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "SUCCESS: Process terminated!" -ForegroundColor Green
        }
    } else {
        Write-Host "SUCCESS: Process terminated!" -ForegroundColor Green
    }
} else {
    Write-Host "No gateway process found." -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan 
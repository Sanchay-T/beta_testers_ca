# CypherEdge Update Cleanup Test Script
# This script helps test the gateway/LAN service cleanup during updates

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CypherEdge Update Cleanup Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if running as admin
function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check admin rights
if (-not (Test-Admin)) {
    Write-Host "WARNING: Not running as administrator. Some checks may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Function to find and display processes
function Show-TargetProcesses {
    Write-Host "`n=== CURRENT TARGET PROCESSES ===" -ForegroundColor Green
    
    $processes = Get-Process | Where-Object {
        $_.ProcessName -match 'gateway|mylan|licensing' -or
        $_.Path -match 'gateway|mylan|licensing'
    }
    
    if ($processes) {
        $processes | ForEach-Object {
            Write-Host "Found Process:" -ForegroundColor Yellow
            Write-Host "  Name: $($_.ProcessName)" -ForegroundColor White
            Write-Host "  PID: $($_.Id)" -ForegroundColor White
            Write-Host "  Path: $($_.Path)" -ForegroundColor White
            Write-Host "  Memory: $([Math]::Round($_.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor White
            Write-Host "  CPU: $($_.CPU)" -ForegroundColor White
            Write-Host ""
        }
        return $true
    } else {
        Write-Host "No target processes found." -ForegroundColor Green
        return $false
    }
}

# Function to check services
function Show-Services {
    Write-Host "`n=== WINDOWS SERVICES STATUS ===" -ForegroundColor Green
    
    $serviceNames = @("MyLanService", "LicensingServer", "gatewayService", "CypherEdgeGateway")
    
    foreach ($svcName in $serviceNames) {
        try {
            $service = Get-Service -Name $svcName -ErrorAction Stop
            Write-Host "Service: $svcName" -ForegroundColor Yellow
            Write-Host "  Status: $($service.Status)" -ForegroundColor White
            Write-Host "  StartType: $($service.StartType)" -ForegroundColor White
            Write-Host ""
        } catch {
            Write-Host "Service: $svcName - NOT INSTALLED" -ForegroundColor Gray
        }
    }
}

# Function to check network connections
function Show-NetworkConnections {
    Write-Host "`n=== NETWORK CONNECTIONS ===" -ForegroundColor Green
    
    $connections = netstat -ano | Select-String "7890|5000"
    if ($connections) {
        Write-Host "Active connections on monitored ports:" -ForegroundColor Yellow
        $connections | ForEach-Object { Write-Host $_ -ForegroundColor White }
    } else {
        Write-Host "No connections on ports 7890 or 5000" -ForegroundColor Green
    }
}

# Function to monitor cleanup in real-time
function Start-CleanupMonitor {
    Write-Host "`n=== STARTING REAL-TIME CLEANUP MONITOR ===" -ForegroundColor Magenta
    Write-Host "This will monitor processes every 500ms during cleanup..." -ForegroundColor White
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
    Write-Host ""
    
    $iteration = 0
    while ($true) {
        $iteration++
        $timestamp = Get-Date -Format "HH:mm:ss.fff"
        
        # Check for our target processes
        $procs = Get-Process | Where-Object {
            $_.ProcessName -match 'gateway|mylan|licensing'
        }
        
        if ($procs) {
            Write-Host "[$timestamp] Iteration $iteration - PROCESSES STILL RUNNING:" -ForegroundColor Red
            $procs | ForEach-Object {
                Write-Host "  - $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[$timestamp] Iteration $iteration - All target processes terminated!" -ForegroundColor Green
        }
        
        Start-Sleep -Milliseconds 500
    }
}

# Main menu
function Show-Menu {
    Write-Host "`n=== TEST OPTIONS ===" -ForegroundColor Cyan
    Write-Host "1. Show current target processes" -ForegroundColor White
    Write-Host "2. Show Windows services status" -ForegroundColor White
    Write-Host "3. Show network connections" -ForegroundColor White
    Write-Host "4. Show all diagnostics" -ForegroundColor White
    Write-Host "5. Start real-time cleanup monitor" -ForegroundColor White
    Write-Host "6. Simulate cleanup (test kill commands)" -ForegroundColor White
    Write-Host "7. View latest log file" -ForegroundColor White
    Write-Host "8. Exit" -ForegroundColor White
    Write-Host ""
}

# Simulate cleanup function
function Test-Cleanup {
    Write-Host "`n=== SIMULATING CLEANUP PROCESS ===" -ForegroundColor Yellow
    Write-Host "This will attempt to kill processes but NOT stop services" -ForegroundColor White
    
    $confirm = Read-Host "Continue? (y/n)"
    if ($confirm -ne 'y') { return }
    
    # Try various kill methods
    Write-Host "`nMethod 1: Taskkill by name..." -ForegroundColor Cyan
    taskkill /IM "gatewayService.exe" /F 2>$null
    taskkill /IM "MyLanService.exe" /F 2>$null
    
    Start-Sleep -Seconds 1
    
    Write-Host "`nMethod 2: PowerShell Stop-Process..." -ForegroundColor Cyan
    Get-Process | Where-Object {$_.ProcessName -match 'gateway|mylan'} | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 1
    
    Write-Host "`nMethod 3: WMIC..." -ForegroundColor Cyan
    wmic process where "name like '%gateway%'" delete 2>$null
    
    Write-Host "`nCleanup simulation complete!" -ForegroundColor Green
}

# View log file
function Show-LogFile {
    $logPath = "$env:USERPROFILE\AppData\Roaming\CypherEdge Dev\logs\cyphersol.log"
    if (Test-Path $logPath) {
        Write-Host "`nShowing last 50 lines of log file..." -ForegroundColor Cyan
        Get-Content $logPath -Tail 50 | Where-Object {$_ -match '\[CLEANUP\]|\[DIAGNOSTICS\]'} | ForEach-Object {
            if ($_ -match 'ERROR|WARNING|WARN') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'SUCCESS|✅') {
                Write-Host $_ -ForegroundColor Green
            } else {
                Write-Host $_ -ForegroundColor White
            }
        }
    } else {
        Write-Host "Log file not found at: $logPath" -ForegroundColor Red
    }
}

# Main loop
while ($true) {
    Show-Menu
    $choice = Read-Host "Select option"
    
    switch ($choice) {
        "1" { Show-TargetProcesses }
        "2" { Show-Services }
        "3" { Show-NetworkConnections }
        "4" { 
            Show-TargetProcesses
            Show-Services
            Show-NetworkConnections
        }
        "5" { Start-CleanupMonitor }
        "6" { Test-Cleanup }
        "7" { Show-LogFile }
        "8" { 
            Write-Host "`nExiting..." -ForegroundColor Cyan
            exit 
        }
        default { Write-Host "Invalid option" -ForegroundColor Red }
    }
    
    Write-Host "`nPress Enter to continue..." -ForegroundColor Gray
    Read-Host
} 
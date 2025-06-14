# Gateway Process Killer - Specific for gatewayService.exe
# Fixed version that won't kill PowerShell

Write-Host "======================================" -ForegroundColor Red
Write-Host "GATEWAY PROCESS KILLER (FIXED)" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some methods may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Function to find gateway processes
function Get-GatewayProcesses {
    $processes = @()
    
    # Method 1: By exact name
    $byName = Get-Process -Name "gatewayService" -ErrorAction SilentlyContinue
    if ($byName) {
        $processes += $byName
    }
    
    # Method 2: By specific patterns (NOT including PowerShell!)
    $byPattern = Get-Process | Where-Object {
        ($_.ProcessName -eq "gatewayService") -or 
        ($_.ProcessName -eq "MyLanService") -or
        ($_.ProcessName -eq "LicensingServer") -or
        ($_.ProcessName -like "gateway*" -and $_.ProcessName -notlike "*powershell*")
    }
    if ($byPattern) {
        foreach ($proc in $byPattern) {
            if ($processes.Id -notcontains $proc.Id) {
                $processes += $proc
            }
        }
    }
    
    # Method 3: By port 7890
    Write-Host "Checking port 7890 for gateway processes..." -ForegroundColor Cyan
    $netstat = netstat -ano | Select-String ":7890.*LISTENING"
    foreach ($line in $netstat) {
        if ($line -match '(\d+)$') {
            $processId = [int]$matches[1]  # Use different variable name!
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc -and $processes.Id -notcontains $proc.Id) {
                # Double check it's not PowerShell
                if ($proc.ProcessName -notlike "*powershell*" -and $proc.ProcessName -notlike "*pwsh*") {
                    $processes += $proc
                    Write-Host "  Found process on port 7890: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Green
                }
            }
        }
    }
    
    return $processes | Sort-Object Id -Unique
}

# Get initial state
Write-Host "Scanning for gateway processes..." -ForegroundColor Yellow
Write-Host "Current PowerShell PID: $PID (will NOT be killed)" -ForegroundColor Cyan
$initialProcesses = Get-GatewayProcesses

if ($initialProcesses.Count -eq 0) {
    Write-Host "No gateway processes found!" -ForegroundColor Green
    Write-Host "Press Enter to exit..."
    Read-Host
    exit
}

Write-Host "`nFound $($initialProcesses.Count) gateway process(es):" -ForegroundColor Yellow
foreach ($proc in $initialProcesses) {
    Write-Host "  - $($proc.ProcessName) (PID: $($proc.Id)) - Memory: $([Math]::Round($proc.WorkingSet64/1MB, 2)) MB" -ForegroundColor White
}

# Safety check
Write-Host "`nSafety check - these processes will be killed:" -ForegroundColor Yellow
foreach ($proc in $initialProcesses) {
    if ($proc.ProcessName -like "*powershell*" -or $proc.ProcessName -like "*pwsh*") {
        Write-Host "  ERROR: Script wants to kill PowerShell! Aborting!" -ForegroundColor Red
        Write-Host "Press Enter to exit..."
        Read-Host
        exit
    }
    Write-Host "  ✓ $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Green
}

Write-Host "`nPress Enter to kill these processes..."
Read-Host

# Kill each process with multiple methods
$results = @()
foreach ($proc in $initialProcesses) {
    Write-Host "`n======================================" -ForegroundColor Cyan
    Write-Host "Killing $($proc.ProcessName) (PID: $($proc.Id))..." -ForegroundColor Yellow
    
    $killed = $false
    $attempts = @()
    
    # Method 1: Stop-Process (PowerShell)
    if (-not $killed) {
        Write-Host "  Method 1: PowerShell Stop-Process..." -NoNewline
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
            $check = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if (-not $check) {
                Write-Host " SUCCESS!" -ForegroundColor Green
                $killed = $true
                $attempts += "Stop-Process: SUCCESS"
            } else {
                Write-Host " FAILED" -ForegroundColor Red
                $attempts += "Stop-Process: FAILED"
            }
        } catch {
            Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
            $attempts += "Stop-Process: ERROR - $($_.Exception.Message)"
        }
    }
    
    # Method 2: Taskkill
    if (-not $killed) {
        Write-Host "  Method 2: Taskkill /F..." -NoNewline
        try {
            $output = & cmd /c "taskkill /PID $($proc.Id) /F" 2>&1
            Start-Sleep -Milliseconds 500
            $check = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if (-not $check) {
                Write-Host " SUCCESS!" -ForegroundColor Green
                $killed = $true
                $attempts += "Taskkill: SUCCESS"
            } else {
                Write-Host " FAILED" -ForegroundColor Red
                $attempts += "Taskkill: FAILED"
            }
        } catch {
            Write-Host " ERROR" -ForegroundColor Red
            $attempts += "Taskkill: ERROR"
        }
    }
    
    # Method 3: WMI
    if (-not $killed) {
        Write-Host "  Method 3: WMI Terminate..." -NoNewline
        try {
            $wmiProc = Get-WmiObject Win32_Process | Where-Object {$_.ProcessId -eq $proc.Id}
            if ($wmiProc) {
                $result = $wmiProc.Terminate()
                Start-Sleep -Milliseconds 500
                $check = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
                if (-not $check) {
                    Write-Host " SUCCESS!" -ForegroundColor Green
                    $killed = $true
                    $attempts += "WMI: SUCCESS (ReturnValue: $($result.ReturnValue))"
                } else {
                    Write-Host " FAILED" -ForegroundColor Red
                    $attempts += "WMI: FAILED (ReturnValue: $($result.ReturnValue))"
                }
            } else {
                Write-Host " Process not found in WMI" -ForegroundColor Yellow
                $attempts += "WMI: Process not found"
            }
        } catch {
            Write-Host " ERROR" -ForegroundColor Red
            $attempts += "WMI: ERROR"
        }
    }
    
    # Method 4: WMIC command line
    if (-not $killed) {
        Write-Host "  Method 4: WMIC Delete..." -NoNewline
        try {
            $output = & cmd /c "wmic process where ProcessId=$($proc.Id) delete" 2>&1
            Start-Sleep -Milliseconds 500
            $check = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if (-not $check) {
                Write-Host " SUCCESS!" -ForegroundColor Green
                $killed = $true
                $attempts += "WMIC: SUCCESS"
            } else {
                Write-Host " FAILED" -ForegroundColor Red
                $attempts += "WMIC: FAILED"
            }
        } catch {
            Write-Host " ERROR" -ForegroundColor Red
            $attempts += "WMIC: ERROR"
        }
    }
    
    # Method 5: Taskkill with tree
    if (-not $killed) {
        Write-Host "  Method 5: Taskkill /T (with tree)..." -NoNewline
        try {
            $output = & cmd /c "taskkill /PID $($proc.Id) /F /T" 2>&1
            Start-Sleep -Milliseconds 500
            $check = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if (-not $check) {
                Write-Host " SUCCESS!" -ForegroundColor Green
                $killed = $true
                $attempts += "Taskkill /T: SUCCESS"
            } else {
                Write-Host " FAILED" -ForegroundColor Red
                $attempts += "Taskkill /T: FAILED"
            }
        } catch {
            Write-Host " ERROR" -ForegroundColor Red
            $attempts += "Taskkill /T: ERROR"
        }
    }
    
    $results += @{
        ProcessName = $proc.ProcessName
        ProcessId = $proc.Id
        Killed = $killed
        Attempts = $attempts
    }
}

# Final verification
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "FINAL VERIFICATION" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$finalProcesses = Get-GatewayProcesses

if ($finalProcesses.Count -eq 0) {
    Write-Host "✅ ALL GATEWAY PROCESSES SUCCESSFULLY TERMINATED!" -ForegroundColor Green
} else {
    Write-Host "⚠️ WARNING: Some processes are still running!" -ForegroundColor Red
    foreach ($proc in $finalProcesses) {
        Write-Host "  - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
    }
}

# Port check
Write-Host "`nChecking port 7890..." -ForegroundColor Cyan
$portCheck = netstat -ano | Select-String ":7890.*LISTENING"
if ($portCheck) {
    Write-Host "⚠️ WARNING: Port 7890 is still in use!" -ForegroundColor Red
    $portCheck | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
} else {
    Write-Host "✅ Port 7890 is free!" -ForegroundColor Green
}

# Save results
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputPath = "$env:TEMP\Gateway_Kill_Results_$timestamp.json"
$output = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    InitialProcessCount = $initialProcesses.Count
    FinalProcessCount = $finalProcesses.Count
    Success = ($finalProcesses.Count -eq 0)
    Results = $results
}

$output | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8
Write-Host "`nResults saved to: $outputPath" -ForegroundColor Cyan

# Recommendations for main.js
Write-Host "`n======================================" -ForegroundColor Magenta
Write-Host "RECOMMENDATIONS FOR main.js UPDATE" -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta

$successfulMethod = $results | Where-Object {$_.Killed -eq $true} | Select-Object -First 1
if ($successfulMethod) {
    $firstSuccess = $successfulMethod.Attempts | Where-Object {$_ -like "*SUCCESS*"} | Select-Object -First 1
    Write-Host "The first successful method was: $firstSuccess" -ForegroundColor Green
    Write-Host "`nFor main.js, prioritize this kill method for gatewayService.exe" -ForegroundColor Yellow
} else {
    Write-Host "No method succeeded! The process may be:" -ForegroundColor Red
    Write-Host "  - Protected by antivirus" -ForegroundColor Yellow
    Write-Host "  - Running with higher privileges" -ForegroundColor Yellow
    Write-Host "  - Being automatically restarted" -ForegroundColor Yellow
}

Write-Host "`nPress Enter to exit..."
Read-Host 
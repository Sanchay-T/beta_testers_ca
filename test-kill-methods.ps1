# MyLanService Kill Method Tester
# Run this AFTER gather-mylan-info.ps1 to test what actually works

Write-Host "======================================" -ForegroundColor Red
Write-Host "MyLanService KILL METHOD TESTER" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will attempt to stop/kill MyLanService!" -ForegroundColor Yellow
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Must run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Function to check if process is running
function Test-ProcessRunning {
    param($ProcessName, $ProcessId)
    
    if ($ProcessId) {
        $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($proc) {
            return @{
                Running = $true
                Process = $proc
                Method = "ByPID"
            }
        }
    }
    
    if ($ProcessName) {
        $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($proc) {
            return @{
                Running = $true
                Process = $proc
                Method = "ByName"
            }
        }
    }
    
    # Check gateway patterns
    $proc = Get-Process | Where-Object {$_.ProcessName -match 'gateway|mylan|licensing'}
    if ($proc) {
        return @{
            Running = $true
            Process = $proc
            Method = "ByPattern"
        }
    }
    
    return @{Running = $false}
}

# Function to check service status
function Test-ServiceRunning {
    $svc = Get-Service -Name "MyLanService" -ErrorAction SilentlyContinue
    if ($svc) {
        return @{
            Exists = $true
            Status = $svc.Status
            Service = $svc
        }
    }
    return @{Exists = $false}
}

# Get initial state
Write-Host "Getting initial state..." -ForegroundColor Cyan
$initialService = Test-ServiceRunning
$initialProcess = $null

if ($initialService.Exists) {
    Write-Host "Service Status: $($initialService.Status)" -ForegroundColor Green
    $svcWMI = Get-WmiObject Win32_Service | Where-Object {$_.Name -eq "MyLanService"}
    if ($svcWMI -and $svcWMI.ProcessId) {
        Write-Host "Service PID: $($svcWMI.ProcessId)" -ForegroundColor Green
        $initialProcess = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
    }
} else {
    Write-Host "MyLanService not found!" -ForegroundColor Red
    Write-Host "Checking for gateway processes anyway..." -ForegroundColor Yellow
    $initialProcess = Test-ProcessRunning -ProcessName "gatewayService"
}

if (-not $initialProcess -or -not $initialProcess.Running) {
    Write-Host "No gateway processes found to test!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "`nFound process to test:" -ForegroundColor Green
$initialProcess.Process | ForEach-Object {
    Write-Host "  $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor White
}

Write-Host "`nPress Enter to start testing kill methods..."
Read-Host

# Test results
$results = @()

# Method 1: Stop Service
Write-Host "`n[METHOD 1] Stopping Windows Service..." -ForegroundColor Yellow
$method1Start = Get-Date
try {
    Stop-Service -Name "MyLanService" -Force -ErrorAction Stop
    Start-Sleep -Seconds 2
    $serviceCheck = Test-ServiceRunning
    $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
    
    $results += @{
        Method = "Stop-Service"
        Success = (-not $processCheck.Running)
        Duration = ((Get-Date) - $method1Start).TotalSeconds
        ServiceStatus = $serviceCheck.Status
        ProcessStatus = $processCheck.Running
        Error = $null
    }
    
    if (-not $processCheck.Running) {
        Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
    } else {
        Write-Host "  FAILED: Process still running!" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{
        Method = "Stop-Service"
        Success = $false
        Error = $_.Exception.Message
    }
}

# If still running, try more methods
if ((Test-ProcessRunning -ProcessId $svcWMI.ProcessId).Running) {
    
    # Method 2: SC Stop
    Write-Host "`n[METHOD 2] SC Stop Command..." -ForegroundColor Yellow
    $method2Start = Get-Date
    try {
        $output = sc.exe stop "MyLanService" 2>&1
        Start-Sleep -Seconds 2
        $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
        
        $results += @{
            Method = "SC Stop"
            Success = (-not $processCheck.Running)
            Duration = ((Get-Date) - $method2Start).TotalSeconds
            Output = $output -join " "
        }
        
        if (-not $processCheck.Running) {
            Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: Process still running!" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Method 3: Taskkill by PID
if ((Test-ProcessRunning -ProcessId $svcWMI.ProcessId).Running) {
    Write-Host "`n[METHOD 3] Taskkill by PID..." -ForegroundColor Yellow
    $method3Start = Get-Date
    try {
        $output = taskkill /PID $svcWMI.ProcessId /F 2>&1
        Start-Sleep -Seconds 1
        $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
        
        $results += @{
            Method = "Taskkill /PID"
            Success = (-not $processCheck.Running)
            Duration = ((Get-Date) - $method3Start).TotalSeconds
            Output = $output -join " "
        }
        
        if (-not $processCheck.Running) {
            Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: Process still running!" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Method 4: Stop-Process
if ((Test-ProcessRunning -ProcessId $svcWMI.ProcessId).Running) {
    Write-Host "`n[METHOD 4] PowerShell Stop-Process..." -ForegroundColor Yellow
    $method4Start = Get-Date
    try {
        Stop-Process -Id $svcWMI.ProcessId -Force
        Start-Sleep -Seconds 1
        $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
        
        $results += @{
            Method = "Stop-Process"
            Success = (-not $processCheck.Running)
            Duration = ((Get-Date) - $method4Start).TotalSeconds
        }
        
        if (-not $processCheck.Running) {
            Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: Process still running!" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Method 5: WMI Terminate
if ((Test-ProcessRunning -ProcessId $svcWMI.ProcessId).Running) {
    Write-Host "`n[METHOD 5] WMI Terminate..." -ForegroundColor Yellow
    $method5Start = Get-Date
    try {
        $proc = Get-WmiObject Win32_Process | Where-Object {$_.ProcessId -eq $svcWMI.ProcessId}
        $result = $proc.Terminate()
        Start-Sleep -Seconds 1
        $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
        
        $results += @{
            Method = "WMI Terminate"
            Success = (-not $processCheck.Running)
            Duration = ((Get-Date) - $method5Start).TotalSeconds
            ReturnValue = $result.ReturnValue
        }
        
        if (-not $processCheck.Running) {
            Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: Process still running!" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Method 6: WMIC Command Line
if ((Test-ProcessRunning -ProcessId $svcWMI.ProcessId).Running) {
    Write-Host "`n[METHOD 6] WMIC Command Line..." -ForegroundColor Yellow
    $method6Start = Get-Date
    try {
        $output = wmic process where "ProcessId=$($svcWMI.ProcessId)" delete 2>&1
        Start-Sleep -Seconds 1
        $processCheck = Test-ProcessRunning -ProcessId $svcWMI.ProcessId
        
        $results += @{
            Method = "WMIC Delete"
            Success = (-not $processCheck.Running)
            Duration = ((Get-Date) - $method6Start).TotalSeconds
            Output = $output -join " "
        }
        
        if (-not $processCheck.Running) {
            Write-Host "  SUCCESS: Process terminated!" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: Process still running!" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Final check
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "FINAL STATUS CHECK" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$finalService = Test-ServiceRunning
$finalProcess = Test-ProcessRunning -ProcessId $svcWMI.ProcessId

Write-Host "Service Status: $(if($finalService.Exists) {$finalService.Status} else {'Not Found'})" -ForegroundColor White
Write-Host "Process Status: $(if($finalProcess.Running) {'STILL RUNNING!'} else {'Terminated'})" -ForegroundColor $(if($finalProcess.Running) {'Red'} else {'Green'})

# Save results
$outputPath = "$env:TEMP\MyLanService_KillTest_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$testResults = @{
    TestTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    InitialState = @{
        ServiceStatus = $initialService.Status
        ProcessId = $svcWMI.ProcessId
    }
    Methods = $results
    FinalState = @{
        ServiceExists = $finalService.Exists
        ServiceStatus = $finalService.Status
        ProcessRunning = $finalProcess.Running
    }
    Recommendation = ""
}

# Determine best method
$successfulMethods = $results | Where-Object {$_.Success -eq $true}
if ($successfulMethods) {
    $fastest = $successfulMethods | Sort-Object Duration | Select-Object -First 1
    $testResults.Recommendation = "Use $($fastest.Method) - terminated in $($fastest.Duration) seconds"
} else {
    $testResults.Recommendation = "No method succeeded - process may be protected or respawning"
}

$testResults | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS SAVED TO:" -ForegroundColor Green
Write-Host $outputPath -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "`nRECOMMENDATION: $($testResults.Recommendation)" -ForegroundColor Yellow

Write-Host "`nPress Enter to open results..."
Read-Host
notepad $outputPath 
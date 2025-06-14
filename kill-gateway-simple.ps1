# Simple Gateway Process Killer
# Target: gatewayService.exe on port 7890

Write-Host "======================================"
Write-Host "GATEWAY PROCESS KILLER (SIMPLE)"
Write-Host "======================================"
Write-Host ""

# Check admin
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host ""
}

# Find process on port 7890
Write-Host "Looking for process on port 7890..."
$foundPID = $null

# Use netstat to find the PID
$netstatOutput = netstat -ano | findstr ":7890"
foreach ($line in $netstatOutput) {
    if ($line -match "LISTENING\s+(\d+)") {
        $foundPID = $matches[1]
        break
    }
}

if ($foundPID) {
    Write-Host "Found process on port 7890: PID $foundPID" -ForegroundColor Green
    
    # Get process info
    try {
        $proc = Get-Process -Id $foundPID -ErrorAction Stop
        Write-Host "Process Name: $($proc.ProcessName)" -ForegroundColor Cyan
        Write-Host "Process Path: $($proc.Path)" -ForegroundColor Cyan
        
        # Safety check
        if ($proc.ProcessName -like "*powershell*") {
            Write-Host "ERROR: This is PowerShell! Not killing." -ForegroundColor Red
            Write-Host "Press Enter to exit..."
            Read-Host
            exit
        }
        
        Write-Host ""
        Write-Host "Press Enter to kill this process..."
        Read-Host
        
        # Try to kill it
        Write-Host "Attempting to kill PID $foundPID..."
        
        # Method 1: Stop-Process
        try {
            Stop-Process -Id $foundPID -Force
            Write-Host "Kill command sent!" -ForegroundColor Green
        } catch {
            Write-Host "Stop-Process failed, trying taskkill..." -ForegroundColor Yellow
            
            # Method 2: Taskkill
            Start-Process -FilePath "taskkill" -ArgumentList "/PID", $foundPID, "/F" -Wait -NoNewWindow
        }
        
        # Wait a bit
        Start-Sleep -Seconds 2
        
        # Check if it's dead
        $checkProc = Get-Process -Id $foundPID -ErrorAction SilentlyContinue
        if ($checkProc) {
            Write-Host "Process still running! Trying harder..." -ForegroundColor Red
            
            # Force kill with /T flag
            Start-Process -FilePath "taskkill" -ArgumentList "/PID", $foundPID, "/F", "/T" -Wait -NoNewWindow
            Start-Sleep -Seconds 1
            
            $checkProc2 = Get-Process -Id $foundPID -ErrorAction SilentlyContinue
            if ($checkProc2) {
                Write-Host "FAILED to kill process!" -ForegroundColor Red
            } else {
                Write-Host "SUCCESS: Process killed!" -ForegroundColor Green
            }
        } else {
            Write-Host "SUCCESS: Process killed!" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "Could not find process with PID $foundPID" -ForegroundColor Red
    }
} else {
    Write-Host "No process found listening on port 7890" -ForegroundColor Yellow
}

# Final check
Write-Host ""
Write-Host "Final port check..."
$finalCheck = netstat -ano | findstr ":7890.*LISTENING"
if ($finalCheck) {
    Write-Host "WARNING: Port 7890 is still in use!" -ForegroundColor Red
    Write-Host $finalCheck
} else {
    Write-Host "Port 7890 is now free!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host 
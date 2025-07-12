# Simple Port 7890 Checker
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "PORT 7890 DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Method 1: Using netstat
Write-Host "Method 1: Checking with netstat..." -ForegroundColor Yellow
$netstatResult = netstat -ano | Select-String ":7890"
if ($netstatResult) {
    Write-Host "Found connections on port 7890:" -ForegroundColor Green
    foreach ($line in $netstatResult) {
        Write-Host "  $line" -ForegroundColor White
        if ($line -match '(\d+)$') {
            $processId = [int]$matches[1]
            try {
                $proc = Get-Process -Id $processId -ErrorAction Stop
                Write-Host "    └─> Process: $($proc.ProcessName) (PID: $processId)" -ForegroundColor Cyan
                Write-Host "        Path: $($proc.Path)" -ForegroundColor Gray
            } catch {
                Write-Host "    └─> Could not get process info for PID: $processId" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "No connections found on port 7890" -ForegroundColor Yellow
}

Write-Host ""

# Method 2: Using PowerShell Get-NetTCPConnection (Windows 8+)
Write-Host "Method 2: Checking with Get-NetTCPConnection..." -ForegroundColor Yellow
try {
    $connections = Get-NetTCPConnection -LocalPort 7890 -ErrorAction Stop
    if ($connections) {
        Write-Host "Found TCP connections on port 7890:" -ForegroundColor Green
        foreach ($conn in $connections) {
            Write-Host "  State: $($conn.State) | PID: $($conn.OwningProcess)" -ForegroundColor White
            try {
                $proc = Get-Process -Id $conn.OwningProcess -ErrorAction Stop
                Write-Host "  └─> Process: $($proc.ProcessName)" -ForegroundColor Cyan
                Write-Host "      Path: $($proc.Path)" -ForegroundColor Gray
                Write-Host "      Company: $($proc.Company)" -ForegroundColor Gray
                Write-Host "      Description: $($proc.Description)" -ForegroundColor Gray
            } catch {
                Write-Host "  └─> Could not get process info" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "No TCP connections found on port 7890" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Get-NetTCPConnection not available (requires Windows 8+)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Current PowerShell PID: $PID" -ForegroundColor Magenta
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host 
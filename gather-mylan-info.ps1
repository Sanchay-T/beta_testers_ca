# MyLanService Information Gatherer
# Run this FIRST to get all info about the service

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "MyLanService COMPLETE INFO GATHERER" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Create output object
$info = @{}
$info.Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$info.ComputerName = $env:COMPUTERNAME

# 1. Get Service Info
Write-Host "1. Gathering Windows Service Information..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name "MyLanService" -ErrorAction Stop
    $serviceWMI = Get-WmiObject Win32_Service | Where-Object {$_.Name -eq "MyLanService"}
    
    $info.Service = @{
        Name = $service.Name
        DisplayName = $service.DisplayName
        Status = $service.Status
        StartType = $service.StartType
        PathName = $serviceWMI.PathName
        ProcessId = $serviceWMI.ProcessId
        StartMode = $serviceWMI.StartMode
        State = $serviceWMI.State
        Description = $serviceWMI.Description
        StartName = $serviceWMI.StartName
    }
    
    Write-Host "  Service Name: $($service.Name)" -ForegroundColor Green
    Write-Host "  Status: $($service.Status)" -ForegroundColor Green
    Write-Host "  Process ID: $($serviceWMI.ProcessId)" -ForegroundColor Green
    Write-Host "  Executable: $($serviceWMI.PathName)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: MyLanService not found!" -ForegroundColor Red
    $info.Service = "NOT FOUND"
}

# 2. Get Process Info
Write-Host "`n2. Gathering Process Information..." -ForegroundColor Yellow
$processes = @()

# Check by service PID
if ($info.Service -ne "NOT FOUND" -and $info.Service.ProcessId) {
    $proc = Get-Process -Id $info.Service.ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        $processes += $proc
        Write-Host "  Found process by Service PID: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Green
    }
}

# Check common gateway-related names
$searchNames = @("gatewayService", "MyLan", "MyLanService", "Licensing", "gateway")
foreach ($name in $searchNames) {
    $found = Get-Process | Where-Object {$_.ProcessName -like "*$name*" -or $_.Path -like "*$name*"}
    foreach ($p in $found) {
        if ($processes.Id -notcontains $p.Id) {
            $processes += $p
            Write-Host "  Found process: $($p.ProcessName) (PID: $($p.Id))" -ForegroundColor Green
        }
    }
}

# Get detailed info for each process
$info.Processes = @()
foreach ($proc in $processes) {
    try {
        $procInfo = @{
            ProcessName = $proc.ProcessName
            Id = $proc.Id
            Path = $proc.Path
            MainWindowTitle = $proc.MainWindowTitle
            StartTime = $proc.StartTime
            CPU = $proc.CPU
            WorkingSet = $proc.WorkingSet64
            Threads = $proc.Threads.Count
            Handles = $proc.HandleCount
            Company = $proc.Company
            FileVersion = $proc.FileVersion
            CommandLine = (Get-WmiObject Win32_Process | Where-Object {$_.ProcessId -eq $proc.Id}).CommandLine
        }
        $info.Processes += $procInfo
    } catch {
        Write-Host "  Warning: Could not get full details for PID $($proc.Id)" -ForegroundColor Yellow
    }
}

# 3. Check Registry
Write-Host "`n3. Checking Registry Entries..." -ForegroundColor Yellow
$regPaths = @(
    "HKLM:\SYSTEM\CurrentControlSet\Services\MyLanService",
    "HKLM:\SOFTWARE\MyLan",
    "HKLM:\SOFTWARE\WOW6432Node\MyLan"
)

$info.Registry = @{}
foreach ($path in $regPaths) {
    if (Test-Path $path) {
        Write-Host "  Found: $path" -ForegroundColor Green
        $info.Registry[$path] = Get-ItemProperty -Path $path
    }
}

# 4. Check Network Connections
Write-Host "`n4. Checking Network Connections..." -ForegroundColor Yellow
$connections = netstat -ano | Select-String "7890|5000|LISTENING"
$info.NetworkConnections = $connections | ForEach-Object { $_.ToString().Trim() }
Write-Host "  Found $($info.NetworkConnections.Count) relevant connections" -ForegroundColor Green

# 5. Check Files
Write-Host "`n5. Checking File Locations..." -ForegroundColor Yellow
$filePaths = @()
if ($info.Service -ne "NOT FOUND" -and $info.Service.PathName) {
    $exePath = $info.Service.PathName.Trim('"').Split(' ')[0]
    if (Test-Path $exePath) {
        $filePaths += Get-Item $exePath
        $dir = Split-Path $exePath -Parent
        $filePaths += Get-ChildItem $dir -Filter "*.exe" -ErrorAction SilentlyContinue
        $filePaths += Get-ChildItem $dir -Filter "*.dll" -ErrorAction SilentlyContinue | Select-Object -First 10
    }
}

$info.Files = $filePaths | ForEach-Object {
    @{
        FullName = $_.FullName
        Name = $_.Name
        Length = $_.Length
        LastWriteTime = $_.LastWriteTime
        FileVersion = $_.VersionInfo.FileVersion
    }
}
Write-Host "  Found $($info.Files.Count) related files" -ForegroundColor Green

# 6. Get Security Info
Write-Host "`n6. Checking Security Context..." -ForegroundColor Yellow
foreach ($proc in $processes) {
    try {
        $owner = (Get-WmiObject Win32_Process | Where-Object {$_.ProcessId -eq $proc.Id}).GetOwner()
        Write-Host "  Process $($proc.Id) runs as: $($owner.Domain)\$($owner.User)" -ForegroundColor Green
    } catch {}
}

# 7. Save Results
$outputPath = "$env:TEMP\MyLanService_Info_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$info | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "COMPLETE INFO SAVED TO:" -ForegroundColor Green
Write-Host $outputPath -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan

# Display Summary
Write-Host "`nSUMMARY:" -ForegroundColor Yellow
Write-Host "Service Status: $($info.Service.Status)" -ForegroundColor White
Write-Host "Service PID: $($info.Service.ProcessId)" -ForegroundColor White
Write-Host "Processes Found: $($info.Processes.Count)" -ForegroundColor White
Write-Host "Network Connections: $($info.NetworkConnections.Count)" -ForegroundColor White

Write-Host "`nPress Enter to open the JSON file..."
Read-Host
notepad $outputPath 
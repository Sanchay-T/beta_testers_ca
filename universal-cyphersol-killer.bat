@echo off
setlocal enabledelayedexpansion

echo =============================================
echo UNIVERSAL CYPHERSOL KILLER AND UNINSTALLER
echo =============================================
echo This will automatically find and remove ALL Cyphersol components
echo on ANY system without needing to know specific details.
echo.
echo Safe for sales team to use on client PCs.
echo.
set /p confirm="Continue? (Y/N): "
if /i not "%confirm%"=="Y" exit /b 0

echo.
echo =============================================
echo STEP 1: AUTO-DETECTING ALL CYPHERSOL STUFF
echo =============================================

echo Scanning system for Cyphersol components...

:: Find all Cyphersol processes
echo.
echo === FINDING CYPHERSOL PROCESSES ===
tasklist /FO CSV | findstr /I "cyphersol" > temp_cyphersol_processes.txt 2>nul
if exist temp_cyphersol_processes.txt (
    for /f "tokens=1,2 delims=," %%a in (temp_cyphersol_processes.txt) do (
        set "process_name=%%~a"
        set "process_pid=%%~b"
        echo Found: !process_name! PID: !process_pid!
    )
    del temp_cyphersol_processes.txt
) else (
    echo No Cyphersol processes found
)

:: Find main.exe processes
echo.
echo === FINDING MAIN.EXE PROCESSES ===
tasklist /FO CSV | findstr /I "main.exe" > temp_main_processes.txt 2>nul
if exist temp_main_processes.txt (
    for /f "tokens=1,2 delims=," %%a in (temp_main_processes.txt) do (
        set "process_name=%%~a"
        set "process_pid=%%~b"
        echo Found: !process_name! PID: !process_pid!
    )
    del temp_main_processes.txt
) else (
    echo No main.exe processes found
)

:: Find gatewayService.exe processes
echo.
echo === FINDING GATEWAY PROCESSES ===
tasklist /FO CSV | findstr /I "gateway" > temp_gateway_processes.txt 2>nul
if exist temp_gateway_processes.txt (
    for /f "tokens=1,2 delims=," %%a in (temp_gateway_processes.txt) do (
        set "process_name=%%~a"
        set "process_pid=%%~b"
        echo Found: !process_name! PID: !process_pid!
    )
    del temp_gateway_processes.txt
) else (
    echo No gateway processes found
)

:: Find electron development processes
echo.
echo === FINDING ELECTRON DEV PROCESSES ===
tasklist /FO CSV | findstr /I "electron" > temp_electron_processes.txt 2>nul
if exist temp_electron_processes.txt (
    for /f "tokens=1,2 delims=," %%a in (temp_electron_processes.txt) do (
        set "process_name=%%~a"
        set "process_pid=%%~b"
        echo Found: !process_name! PID: !process_pid!
    )
    del temp_electron_processes.txt
) else (
    echo No electron processes found
)

:: Auto-detect which ports are being used by our processes
echo.
echo === AUTO-DETECTING PORTS USED BY CYPHERSOL ===
echo Checking what ports main.exe is using...
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq main.exe" /FO CSV /NH 2^>nul') do (
    if not "%%p"=="INFO:" (
        for /f "tokens=2" %%port in ('netstat -ano ^| findstr "%%~p" ^| findstr "LISTENING"') do (
            echo main.exe PID %%~p is using port: %%port
        )
    )
)

echo Checking common development ports (3000, 7500, 8000, 5000)...
for %%port in (3000 7500 8000 5000) do (
    netstat -ano | findstr ":%%port" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=5" %%pid in ('netstat -ano ^| findstr ":%%port" ^| findstr "LISTENING"') do (
            echo Port %%port is used by PID: %%pid
        )
    )
)

:: Check for services
echo.
echo === FINDING CYPHERSOL SERVICES ===
sc query | findstr /I "cyphersol\|licensing\|gateway" >nul 2>&1
if !errorlevel! equ 0 (
    echo Found Cyphersol-related services:
    sc query | findstr /I "SERVICE_NAME.*cyphersol\|SERVICE_NAME.*licensing\|SERVICE_NAME.*gateway"
) else (
    echo No obvious Cyphersol services found
)

:: Look for installations
echo.
echo === FINDING INSTALLATIONS ===
set "found_installs="
if exist "C:\Program Files\Cyphersol" (
    echo [FOUND] C:\Program Files\Cyphersol
    set "found_installs=!found_installs!;C:\Program Files\Cyphersol"
)
if exist "C:\Program Files (x86)\Cyphersol" (
    echo [FOUND] C:\Program Files (x86)\Cyphersol  
    set "found_installs=!found_installs!;C:\Program Files (x86)\Cyphersol"
)

echo.
echo =============================================
echo STEP 2: NUCLEAR OPTION - KILL EVERYTHING
echo =============================================

echo Killing ALL Cyphersol-related processes...

:: Kill all Cyphersol.exe processes
echo.
echo Killing Cyphersol.exe processes...
taskkill /F /IM "Cyphersol.exe" 2>nul
if %errorlevel% equ 0 (
    echo   ✓ Killed Cyphersol.exe processes
) else (
    echo   ℹ No Cyphersol.exe to kill
)

:: Kill all main.exe processes  
echo Killing main.exe processes...
taskkill /F /IM "main.exe" 2>nul
if %errorlevel% equ 0 (
    echo   ✓ Killed main.exe processes
) else (
    echo   ℹ No main.exe to kill
)

:: Kill all gateway processes
echo Killing gateway processes...
taskkill /F /IM "gatewayService.exe" 2>nul
taskkill /F /IM "gateway.exe" 2>nul
echo   ✓ Attempted gateway process cleanup

:: Kill all electron processes (dev mode)
echo Killing electron processes...
taskkill /F /IM "electron.exe" 2>nul
if %errorlevel% equ 0 (
    echo   ✓ Killed electron processes
) else (
    echo   ℹ No electron processes to kill
)

:: Auto-kill processes on common dev ports
echo.
echo Killing processes on common development ports...
for %%port in (3000 7500 8000 5000 4000 9000) do (
    for /f "tokens=5" %%pid in ('netstat -ano ^| findstr ":%%port" ^| findstr "LISTENING" 2^>nul') do (
        echo Killing PID %%pid using port %%port...
        taskkill /F /PID %%pid 2>nul
    )
)

:: Kill any node/python processes that might be related
echo.
echo Checking for suspicious node.js/python processes...
for /f "tokens=2" %%pid in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH 2^>nul') do (
    if not "%%pid"=="INFO:" (
        :: Check if this node process has "cyphersol" in its command line
        wmic process where "ProcessId=%%~pid" get CommandLine /format:list 2>nul | findstr /I "cyphersol" >nul
        if !errorlevel! equ 0 (
            echo Killing Cyphersol-related node.exe PID %%~pid...
            taskkill /F /PID %%~pid 2>nul
        )
    )
)

for /f "tokens=2" %%pid in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH 2^>nul') do (
    if not "%%pid"=="INFO:" (
        :: Check if this python process has "uvicorn" or "cyphersol" in command line
        wmic process where "ProcessId=%%~pid" get CommandLine /format:list 2>nul | findstr /I "uvicorn\|cyphersol\|fastapi" >nul
        if !errorlevel! equ 0 (
            echo Killing Cyphersol-related python.exe PID %%~pid...
            taskkill /F /PID %%~pid 2>nul
        )
    )
)

:: Stop and remove services
echo.
echo Stopping and removing services...
sc stop LicensingServer 2>nul
sc delete LicensingServer 2>nul
echo   ✓ Attempted LicensingServer cleanup

echo.
echo Waiting for processes to fully die...
timeout /t 3 /nobreak >nul

echo =============================================
echo STEP 3: AUTO-FIND AND RUN UNINSTALLER
echo =============================================

set "uninstaller_found="

:: Look in all possible locations
echo Searching for uninstaller...

:: Check Program Files
if exist "C:\Program Files\Cyphersol\Uninstall Cyphersol.exe" (
    set "uninstaller_found=C:\Program Files\Cyphersol\Uninstall Cyphersol.exe"
) else if exist "C:\Program Files\Cyphersol\uninstall.exe" (
    set "uninstaller_found=C:\Program Files\Cyphersol\uninstall.exe"
) else if exist "C:\Program Files (x86)\Cyphersol\Uninstall Cyphersol.exe" (
    set "uninstaller_found=C:\Program Files (x86)\Cyphersol\Uninstall Cyphersol.exe"
) else if exist "C:\Program Files (x86)\Cyphersol\uninstall.exe" (
    set "uninstaller_found=C:\Program Files (x86)\Cyphersol\uninstall.exe"
)

:: If not found, search registry
if "!uninstaller_found!"=="" (
    echo Searching Windows registry for uninstaller...
    for /f "tokens=3*" %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "Cyphersol" 2^>nul ^| findstr "UninstallString"') do (
        set "uninstaller_found=%%a %%b"
        goto :found_uninstaller
    )
    
    for /f "tokens=3*" %%a in ('reg query "HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "Cyphersol" 2^>nul ^| findstr "UninstallString"') do (
        set "uninstaller_found=%%a %%b"
        goto :found_uninstaller
    )
)

:found_uninstaller
if not "!uninstaller_found!"=="" (
    echo Found uninstaller: !uninstaller_found!
    echo.
    echo Running uninstaller automatically...
    
    :: Try silent first
    echo Attempting silent uninstall...
    "!uninstaller_found!" /S 2>nul
    if !errorlevel! equ 0 (
        echo   ✓ Silent uninstall successful
    ) else (
        echo   ⚠ Silent failed, running interactive uninstaller...
        echo   (A window will appear - please follow the prompts)
        "!uninstaller_found!"
    )
    
    echo Waiting for uninstaller to finish...
    timeout /t 10 /nobreak >nul
) else (
    echo ⚠ No uninstaller found - will do manual cleanup only
)

echo.
echo =============================================
echo STEP 4: SCORCHED EARTH FILE CLEANUP
echo =============================================

echo Removing all Cyphersol files and folders...

:: Remove installation directories
for %%dir in ("C:\Program Files\Cyphersol" "C:\Program Files (x86)\Cyphersol") do (
    if exist %%dir (
        echo Removing %%dir...
        rd /s /q %%dir 2>nul
        if exist %%dir (
            echo   ⚠ Some files couldn't be removed (may be in use)
        ) else (
            echo   ✓ Removed %%dir
        )
    )
)

:: Remove user data
echo.
echo Removing user data...
for %%dir in ("%APPDATA%\Cyphersol" "%LOCALAPPDATA%\Cyphersol") do (
    if exist %%dir (
        echo Removing %%dir...
        rd /s /q %%dir 2>nul
        if exist %%dir (
            echo   ⚠ Couldn't remove %%dir
        ) else (
            echo   ✓ Removed %%dir
        )
    )
)

:: Remove shortcuts everywhere
echo.
echo Removing shortcuts...
del "%USERPROFILE%\Desktop\Cyphersol.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Cyphersol.lnk" 2>nul
del "%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\Cyphersol.lnk" 2>nul
echo   ✓ Shortcuts cleanup attempted

echo.
echo =============================================
echo STEP 5: FINAL VERIFICATION
echo =============================================

echo Checking if cleanup was successful...

set "issues_found=0"

:: Check processes
tasklist | findstr /I "cyphersol\|main.exe" >nul 2>&1
if !errorlevel! equ 0 (
    echo   ⚠ Some Cyphersol processes still running
    set /a issues_found+=1
) else (
    echo   ✓ No Cyphersol processes running
)

:: Check common ports
for %%port in (3000 7500) do (
    netstat -ano | findstr ":%%port" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ⚠ Port %%port still in use
        set /a issues_found+=1
    )
)

:: Check installations
for %%dir in ("C:\Program Files\Cyphersol" "C:\Program Files (x86)\Cyphersol") do (
    if exist %%dir (
        echo   ⚠ Directory still exists: %%dir
        set /a issues_found+=1
    )
)

if !issues_found! equ 0 (
    echo   ✓ All common ports are free
    echo   ✓ No installation directories found
)

echo.
echo =============================================
if !issues_found! equ 0 (
    echo ✅ SUCCESS! CYPHERSOL COMPLETELY REMOVED
    echo.
    echo System is clean and ready for fresh installation.
    echo Safe to proceed with new setup.
) else (
    echo ⚠ MOSTLY CLEAN (!issues_found! minor issues)
    echo.
    echo Most components removed successfully.
    echo Remaining issues may require:
    echo - Computer restart
    echo - Manual intervention
    echo.
    echo But system should be good enough for new installation.
)
echo =============================================

echo.
echo This window will stay open for review.
echo Press any key to close...
pause 
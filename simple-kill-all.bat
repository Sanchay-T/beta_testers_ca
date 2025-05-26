@echo off
echo =============================================
echo SIMPLE CYPHERSOL KILLER - BULLETPROOF VERSION
echo =============================================
echo This will forcefully kill ALL Cyphersol processes and uninstall.
echo No fancy detection - just brute force killing.
echo.
set /p confirm="Kill everything? (Y/N): "
if /i not "%confirm%"=="Y" exit /b 0

echo.
echo =============================================
echo STEP 1: FINDING ALL CYPHERSOL-RELATED STUFF
echo =============================================

echo Finding processes with cyphersol in name...
tasklist | findstr /I "cyphersol"
echo.

echo Finding processes with main in name...
tasklist | findstr /I "main"
echo.

echo Finding processes with gateway in name...
tasklist | findstr /I "gateway"
echo.

echo Finding processes with licensing in name...
tasklist | findstr /I "licensing"
echo.

echo =============================================
echo STEP 2: KILLING ALL PROCESSES - BRUTE FORCE
echo =============================================

echo Killing known Cyphersol processes...
taskkill /F /IM "Cyphersol.exe" 2>nul
taskkill /F /IM "main.exe" 2>nul
taskkill /F /IM "gatewayService.exe" 2>nul
taskkill /F /IM "gateway.exe" 2>nul
taskkill /F /IM "electron.exe" 2>nul
echo Done with known processes.

echo.
echo Killing ANY process with 'cyphersol' in name...
for /f "tokens=1" %%p in ('tasklist /NH /FO CSV ^| findstr /I "cyphersol"') do (
    echo Killing %%p...
    taskkill /F /IM %%p 2>nul
)

echo Killing ANY process with 'main' in name...
for /f "tokens=1" %%p in ('tasklist /NH /FO CSV ^| findstr /I "main"') do (
    echo Killing %%p...
    taskkill /F /IM %%p 2>nul
)

echo Killing ANY process with 'gateway' in name...
for /f "tokens=1" %%p in ('tasklist /NH /FO CSV ^| findstr /I "gateway"') do (
    echo Killing %%p...
    taskkill /F /IM %%p 2>nul
)

echo Killing ANY process with 'licensing' in name...
for /f "tokens=1" %%p in ('tasklist /NH /FO CSV ^| findstr /I "licensing"') do (
    echo Killing %%p...
    taskkill /F /IM %%p 2>nul
)

echo.
echo Nuclear option - killing common dev processes...
taskkill /F /IM "node.exe" 2>nul
taskkill /F /IM "python.exe" 2>nul
echo Done.

echo.
echo =============================================
echo STEP 3: KILLING PROCESSES ON PORTS
echo =============================================

echo Killing anything on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do taskkill /F /PID %%a 2>nul
echo Done.

echo Killing anything on port 7500...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":7500" 2^>nul') do taskkill /F /PID %%a 2>nul
echo Done.

echo Killing anything on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" 2^>nul') do taskkill /F /PID %%a 2>nul
echo Done.

echo Killing anything on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" 2^>nul') do taskkill /F /PID %%a 2>nul
echo Done.

echo Killing anything on port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" 2^>nul') do taskkill /F /PID %%a 2>nul
echo Done.

echo.
echo =============================================
echo STEP 4: STOPPING SERVICES
echo =============================================

echo Stopping known services...
sc stop LicensingServer 2>nul
echo Done.

echo Deleting known services...
sc delete LicensingServer 2>nul
echo Done.

echo.
echo Looking for ANY service with cyphersol, licensing, or gateway...
for /f "tokens=2" %%s in ('sc query ^| findstr /I "SERVICE_NAME.*cyphersol" 2^>nul') do (
    echo Found service %%s - stopping and deleting...
    sc stop %%s 2>nul
    sc delete %%s 2>nul
)

for /f "tokens=2" %%s in ('sc query ^| findstr /I "SERVICE_NAME.*licensing" 2^>nul') do (
    echo Found service %%s - stopping and deleting...
    sc stop %%s 2>nul
    sc delete %%s 2>nul
)

for /f "tokens=2" %%s in ('sc query ^| findstr /I "SERVICE_NAME.*gateway" 2^>nul') do (
    echo Found service %%s - stopping and deleting...
    sc stop %%s 2>nul
    sc delete %%s 2>nul
)

echo.
echo Waiting 5 seconds for everything to die...
timeout /t 5 /nobreak

echo.
echo =============================================
echo STEP 5: FINDING AND RUNNING UNINSTALLER
echo =============================================

if exist "C:\Program Files\Cyphersol\Uninstall Cyphersol.exe" (
    echo Found uninstaller in Program Files
    echo Running silent uninstall...
    "C:\Program Files\Cyphersol\Uninstall Cyphersol.exe" /S
    timeout /t 10 /nobreak
    goto :cleanup
)

if exist "C:\Program Files\Cyphersol\uninstall.exe" (
    echo Found uninstaller in Program Files
    echo Running silent uninstall...
    "C:\Program Files\Cyphersol\uninstall.exe" /S
    timeout /t 10 /nobreak
    goto :cleanup
)

if exist "C:\Program Files (x86)\Cyphersol\Uninstall Cyphersol.exe" (
    echo Found uninstaller in Program Files (x86)
    echo Running silent uninstall...
    "C:\Program Files (x86)\Cyphersol\Uninstall Cyphersol.exe" /S
    timeout /t 10 /nobreak
    goto :cleanup
)

if exist "C:\Program Files (x86)\Cyphersol\uninstall.exe" (
    echo Found uninstaller in Program Files (x86)
    echo Running silent uninstall...
    "C:\Program Files (x86)\Cyphersol\uninstall.exe" /S
    timeout /t 10 /nobreak
    goto :cleanup
)

echo No uninstaller found - doing manual cleanup only

:cleanup
echo.
echo =============================================
echo STEP 6: MANUAL FILE CLEANUP
echo =============================================

echo Removing Program Files installation...
if exist "C:\Program Files\Cyphersol" (
    rd /s /q "C:\Program Files\Cyphersol"
    echo Removed C:\Program Files\Cyphersol
) else (
    echo No Program Files installation found
)

echo Removing Program Files (x86) installation...
if exist "C:\Program Files (x86)\Cyphersol" (
    rd /s /q "C:\Program Files (x86)\Cyphersol"
    echo Removed C:\Program Files (x86)\Cyphersol
) else (
    echo No Program Files (x86) installation found
)

echo Removing user AppData...
if exist "%APPDATA%\Cyphersol" (
    rd /s /q "%APPDATA%\Cyphersol"
    echo Removed %APPDATA%\Cyphersol
) else (
    echo No AppData folder found
)

echo Removing local AppData...
if exist "%LOCALAPPDATA%\Cyphersol" (
    rd /s /q "%LOCALAPPDATA%\Cyphersol"
    echo Removed %LOCALAPPDATA%\Cyphersol
) else (
    echo No LocalAppData folder found
)

echo Removing shortcuts...
del "%USERPROFILE%\Desktop\Cyphersol.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Cyphersol.lnk" 2>nul
del "%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\Cyphersol.lnk" 2>nul
echo Shortcuts cleanup done

echo.
echo =============================================
echo STEP 7: FINAL CHECK
echo =============================================

echo Checking if Cyphersol processes are still running...
tasklist | findstr /I "cyphersol"
if %errorlevel% equ 0 (
    echo WARNING: Some Cyphersol processes still running!
) else (
    echo GOOD: No Cyphersol processes found
)

echo Checking if main.exe is still running...
tasklist | findstr /I "main.exe"
if %errorlevel% equ 0 (
    echo WARNING: main.exe still running!
) else (
    echo GOOD: No main.exe found
)

echo Checking if gateway processes are still running...
tasklist | findstr /I "gateway"
if %errorlevel% equ 0 (
    echo WARNING: Gateway processes still running!
) else (
    echo GOOD: No gateway processes found
)

echo Checking if licensing processes are still running...
tasklist | findstr /I "licensing"
if %errorlevel% equ 0 (
    echo WARNING: Licensing processes still running!
) else (
    echo GOOD: No licensing processes found
)

echo Checking if port 7500 is free...
netstat -ano | findstr ":7500"
if %errorlevel% equ 0 (
    echo WARNING: Port 7500 still in use!
) else (
    echo GOOD: Port 7500 is free
)

echo Checking if installation exists...
if exist "C:\Program Files\Cyphersol" (
    echo WARNING: C:\Program Files\Cyphersol still exists!
) else if exist "C:\Program Files (x86)\Cyphersol" (
    echo WARNING: C:\Program Files (x86)\Cyphersol still exists!
) else (
    echo GOOD: No installation directories found
)

echo.
echo =============================================
echo CLEANUP COMPLETE
echo =============================================
echo.
echo If you see any WARNINGS above, you may need to:
echo 1. Restart your computer
echo 2. Run this script again
echo 3. Manually kill remaining processes in Task Manager
echo.
echo Otherwise, system should be clean for new installation.
echo.
echo Press any key to exit...
pause 
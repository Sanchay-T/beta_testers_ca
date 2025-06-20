@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo          CLEANING AND REBUILDING NODE MODULES
echo ======================================================
echo.

:: Check for administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Administrator privileges required. Please run as administrator.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)

:: Set up logging
set LOGFILE=clean_build_log_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt
set LOGFILE=%LOGFILE: =0%
echo Clean and Build process started at %date% %time% > %LOGFILE%

:: Clean frontend node_modules and package-lock
echo Cleaning frontend dependencies...
echo Cleaning frontend dependencies... >> %LOGFILE%

if exist frontend\node_modules (
    echo Removing frontend\node_modules...
    rmdir /s /q frontend\node_modules
    if !errorlevel! neq 0 (
        echo ERROR: Failed to remove frontend node_modules. >> %LOGFILE%
        echo ERROR: Failed to remove frontend node_modules.
        echo Press any key to exit...
        pause > nul
        exit /b 1
    )
)

if exist frontend\package-lock.json (
    echo Removing frontend\package-lock.json...
    del /f frontend\package-lock.json
    if !errorlevel! neq 0 (
        echo ERROR: Failed to remove frontend package-lock.json. >> %LOGFILE%
        echo ERROR: Failed to remove frontend package-lock.json.
        echo Press any key to continue anyway...
        pause > nul
    )
)

:: Clean react-app node_modules and package-lock
echo Cleaning react-app dependencies...
echo Cleaning react-app dependencies... >> %LOGFILE%

if exist frontend\react-app\node_modules (
    echo Removing frontend\react-app\node_modules...
    rmdir /s /q frontend\react-app\node_modules
    if !errorlevel! neq 0 (
        echo ERROR: Failed to remove react-app node_modules. >> %LOGFILE%
        echo ERROR: Failed to remove react-app node_modules.
        echo Press any key to exit...
        pause > nul
        exit /b 1
    )
)

if exist frontend\react-app\package-lock.json (
    echo Removing frontend\react-app\package-lock.json...
    del /f frontend\react-app\package-lock.json
    if !errorlevel! neq 0 (
        echo ERROR: Failed to remove react-app package-lock.json. >> %LOGFILE%
        echo ERROR: Failed to remove react-app package-lock.json.
        echo Press any key to continue anyway...
        pause > nul
    )
)

:: Reinstall frontend dependencies
echo.
echo Installing frontend dependencies...
echo Installing frontend dependencies... >> %LOGFILE%
cd frontend
call npm install >> ../%LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies. >> ../%LOGFILE%
    echo ERROR: Failed to install frontend dependencies.
    cd ..
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Frontend dependencies installed successfully. >> ../%LOGFILE%

:: Reinstall react-app dependencies
echo.
echo Installing react-app dependencies...
echo Installing react-app dependencies... >> ../%LOGFILE%
cd react-app
call npm install >> ../../%LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to install react-app dependencies. >> ../../%LOGFILE%
    echo ERROR: Failed to install react-app dependencies.
    cd ../..
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo React-app dependencies installed successfully. >> ../../%LOGFILE%
cd ../..

echo.
echo Dependencies cleaned and reinstalled successfully.
echo Dependencies cleaned and reinstalled successfully. >> %LOGFILE%
echo.

:: Now run the build script
echo Starting the main build process...
echo Starting the main build process... >> %LOGFILE%
call build.bat

endlocal 
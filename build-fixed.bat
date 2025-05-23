@echo off
setlocal enabledelayedexpansion

:: Set project root directory (where the script is)
set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
echo Project root: %PROJECT_ROOT%

:: Set directories with absolute paths
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "REACT_APP_DIR=%FRONTEND_DIR%\react-app"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "VENV_DIR=%PROJECT_ROOT%\.venv"

:: Set up logging
set LOGFILE=build_fixed_log_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt
set LOGFILE=%LOGFILE: =0%
echo Build process started at %date% %time% > %LOGFILE%

echo ======================================================
echo          CYPHERSOL FIXED BUILD PROCESS
echo ======================================================
echo.
echo Build process started at %date% %time%
echo Logging to %LOGFILE%
echo Using paths:
echo   - Project root: %PROJECT_ROOT%
echo   - Frontend: %FRONTEND_DIR%
echo   - React app: %REACT_APP_DIR%
echo   - Backend: %BACKEND_DIR%
echo   - Virtual env: %VENV_DIR%

:: Check for administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Administrator privileges required. Please run as administrator. >> %LOGFILE%
    echo ERROR: Administrator privileges required. Please run as administrator.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)

:: Set environment variables more robustly
echo.
echo Setting environment variables...
echo Setting environment variables... >> %LOGFILE%

:: Set NODE_ENV globally for this session
set NODE_ENV=production
echo Set NODE_ENV globally to: %NODE_ENV% >> %LOGFILE%

:: Check if frontend directory exists
if not exist "%FRONTEND_DIR%" (
    echo ERROR: Frontend directory not found at %FRONTEND_DIR% >> %LOGFILE%
    echo ERROR: Frontend directory not found at %FRONTEND_DIR%
    echo Press any key to exit...
    pause > nul
    exit /b 1
)

:: Create/update .env file with multiple environment settings
echo NODE_ENV=production > "%FRONTEND_DIR%\.env"
echo ELECTRON_IS_DEV=false >> "%FRONTEND_DIR%\.env"
echo GENERATE_SOURCEMAP=false >> "%FRONTEND_DIR%\.env"
if %errorlevel% neq 0 (
    echo WARNING: Failed to create .env file. >> %LOGFILE%
    echo WARNING: Failed to create .env file. Continuing anyway...
) else (
    echo Environment file created successfully. >> %LOGFILE%
    echo Contents of .env file: >> %LOGFILE%
    type "%FRONTEND_DIR%\.env" >> %LOGFILE%
)

:: Activate Python virtual environment
echo.
echo Activating Python virtual environment...
echo Activating Python virtual environment... >> %LOGFILE%

:: Check if virtual environment exists
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found at %VENV_DIR%\Scripts\activate.bat >> %LOGFILE%
    echo ERROR: Virtual environment not found at %VENV_DIR%\Scripts\activate.bat
    echo Press any key to exit...
    pause > nul
    exit /b 1
)

call "%VENV_DIR%\Scripts\activate.bat" || (
    echo ERROR: Failed to activate virtual environment. >> %LOGFILE%
    echo ERROR: Failed to activate virtual environment.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Virtual environment activated successfully. >> %LOGFILE%

:: Clean previous build more thoroughly
echo.
echo Cleaning previous build files...
echo Cleaning previous build files... >> %LOGFILE%
if exist "%PROJECT_ROOT%\dist\main" (
    echo Removing %PROJECT_ROOT%\dist\main...
    rmdir /s /q "%PROJECT_ROOT%\dist\main"
)
if exist "%FRONTEND_DIR%\dist" (
    echo Removing %FRONTEND_DIR%\dist...
    rmdir /s /q "%FRONTEND_DIR%\dist"
)
echo Previous build files cleaned. >> %LOGFILE%

:: Build Python backend
echo.
echo Building Python backend with PyInstaller...
echo Building Python backend with PyInstaller... >> %LOGFILE%
echo Current directory: %CD% >> %LOGFILE%
echo Python executable: >> %LOGFILE%
where python >> %LOGFILE% 2>&1

pyinstaller --onedir "%BACKEND_DIR%\main.py" >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Python backend. Check %LOGFILE% for details. >> %LOGFILE%
    echo ERROR: Failed to build Python backend. Check %LOGFILE% for details.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Python backend built successfully. >> %LOGFILE%

:: Check if dist/main was created
if not exist "%PROJECT_ROOT%\dist\main" (
    echo ERROR: Python build completed but dist\main directory not found. >> %LOGFILE%
    echo ERROR: Python build completed but dist\main directory not found.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Verified dist\main directory exists. >> %LOGFILE%

:: Run postbuild script
echo.
echo Running postbuild script...
echo Running postbuild script... >> %LOGFILE%
python "%PROJECT_ROOT%\postbuild.py" >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to run postbuild script. Check %LOGFILE% for details. >> %LOGFILE%
    echo ERROR: Failed to run postbuild script. Check %LOGFILE% for details.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Postbuild script completed successfully. >> %LOGFILE%

:: Build Electron app
echo.
echo Building Electron app...
echo Building Electron app... >> %LOGFILE%
cd "%FRONTEND_DIR%"

:: Set environment for npm build
set NODE_ENV=production
set GENERATE_SOURCEMAP=false

echo Running npm run build with NODE_ENV=%NODE_ENV%... >> "%PROJECT_ROOT%\%LOGFILE%"
call npm run build >> "%PROJECT_ROOT%\%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Electron app. Check %LOGFILE% for details. >> "%PROJECT_ROOT%\%LOGFILE%"
    echo ERROR: Failed to build Electron app. Check %LOGFILE% for details.
    cd "%PROJECT_ROOT%"
    echo Press any key to exit...
    pause > nul
    exit /b 1
)
echo Electron app built successfully. >> "%PROJECT_ROOT%\%LOGFILE%"
cd "%PROJECT_ROOT%"

:: Verify the build output
echo.
echo Verifying build output...
echo Verifying build output... >> %LOGFILE%
if exist "%FRONTEND_DIR%\dist" (
    echo Electron dist directory exists. >> %LOGFILE%
    dir "%FRONTEND_DIR%\dist" >> %LOGFILE%
) else (
    echo WARNING: Electron dist directory not found! >> %LOGFILE%
    echo WARNING: Electron dist directory not found!
)

:: Show build completion status
echo.
echo ======================================================
echo               BUILD COMPLETED SUCCESSFULLY
echo ======================================================
echo Build completed at %date% %time% >> %LOGFILE%
echo Build completed at %date% %time%
echo.

:: Open dist folder
echo Opening dist folder...
echo Opening dist folder... >> %LOGFILE%
start "" "%FRONTEND_DIR%\dist"

echo.
echo Installation file is ready. You can now install the application.
echo For detailed build log, see: %LOGFILE%
echo.
echo IMPORTANT: The application should now properly detect it's in
echo production mode and avoid the isDev error.
echo.
echo Press any key to exit...
pause > nul

endlocal 
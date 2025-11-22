@echo off
setlocal

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "USER_DATA_DIR=%LOCALAPPDATA%\Google\Chrome\User Data"

echo Chrome Remote Debugging Setup
echo ================================
echo.

REM Check if Chrome is running
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I /N "chrome.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Chrome is currently running.
    echo To enable remote debugging, Chrome needs to be restarted.
    echo Your user data and tabs will be preserved.
    echo.
    set /p response="Close Chrome and restart with remote debugging? (Y/N): "
    if /i not "%response%"=="Y" (
        echo Cancelled. Chrome will continue running normally.
        pause
        exit /b 0
    )
    echo.
    echo Closing Chrome (this may take a few seconds)...
    taskkill /F /IM chrome.exe >nul 2>&1
    timeout /t 2 >nul
) else (
    echo Chrome is not running. Starting with remote debugging...
)

echo.
echo Starting Chrome with remote debugging on port 9222...
echo User data directory: %USER_DATA_DIR%
echo.

start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="%USER_DATA_DIR%"

echo Chrome started! Waiting 5 seconds for it to initialize...
timeout /t 5 >nul

echo.
echo Testing connection...
curl -s http://localhost:9222/json/version >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Chrome remote debugging is active!
    echo Your user data and tabs are preserved.
    echo You can now use the MCP server.
    echo.
    echo You can verify by opening: http://localhost:9222/json
) else (
    echo.
    echo WARNING: Could not verify connection automatically.
    echo Chrome may still be starting. Please try:
    echo   1. Open http://localhost:9222/json in your browser
    echo   2. If you see JSON data, remote debugging is working!
)

echo.
pause


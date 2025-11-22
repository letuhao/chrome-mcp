# PowerShell script to start Chrome with remote debugging while preserving user data

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# Find Chrome user data directory (default location)
$userDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"

Write-Host "Chrome Remote Debugging Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $chromePath)) {
    Write-Host "ERROR: Chrome not found at $chromePath" -ForegroundColor Red
    Write-Host "Please update the path in this script." -ForegroundColor Red
    exit 1
}

# Check if Chrome is already running
$chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue

if ($chromeRunning) {
    Write-Host "Chrome is currently running." -ForegroundColor Yellow
    Write-Host "To enable remote debugging, Chrome needs to be restarted with the flag." -ForegroundColor Yellow
    Write-Host "Your user data and tabs will be preserved." -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Close Chrome and restart with remote debugging? (Y/N)"
    
    if ($response -ne 'Y' -and $response -ne 'y') {
        Write-Host "Cancelled. Chrome will continue running normally." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Closing Chrome (this may take a few seconds)..." -ForegroundColor Yellow
    # Try graceful shutdown first
    $chromeRunning | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    Start-Sleep -Seconds 2
    
    # Force close if still running
    $stillRunning = Get-Process chrome -ErrorAction SilentlyContinue
    if ($stillRunning) {
        Write-Host "Force closing remaining Chrome processes..." -ForegroundColor Yellow
        Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "Chrome is not running. Starting with remote debugging..." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Chrome with remote debugging on port 9222..." -ForegroundColor Green
Write-Host "User data directory: $userDataDir" -ForegroundColor Gray

# Start Chrome with remote debugging AND preserve user data
$arguments = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=`"$userDataDir`""
)

Start-Process $chromePath -ArgumentList $arguments
Write-Host "Chrome started! Waiting 5 seconds for it to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Testing connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing -ErrorAction Stop
    Write-Host ""
    Write-Host "✓ SUCCESS: Chrome remote debugging is active!" -ForegroundColor Green
    Write-Host "✓ Your user data and tabs are preserved." -ForegroundColor Green
    Write-Host "✓ You can now use the MCP server." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can verify by opening: http://localhost:9222/json" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "WARNING: Could not verify connection automatically." -ForegroundColor Yellow
    Write-Host "Chrome may still be starting. Please try:" -ForegroundColor Yellow
    Write-Host "  1. Open http://localhost:9222/json in your browser" -ForegroundColor Yellow
    Write-Host "  2. If you see JSON data, remote debugging is working!" -ForegroundColor Yellow
    Write-Host ""
}


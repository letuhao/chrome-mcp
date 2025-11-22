# PowerShell script to start Chrome with remote debugging while preserving user data
# Handles Chrome 136+ security restrictions

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$defaultUserDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$debugUserDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data Debug"

Write-Host "Chrome Remote Debugging Setup (with User Data)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $chromePath)) {
    Write-Host "ERROR: Chrome not found at $chromePath" -ForegroundColor Red
    exit 1
}

# Check Chrome version
Write-Host "Checking Chrome version..." -ForegroundColor Yellow
try {
    $versionInfo = (Get-Item $chromePath).VersionInfo
    $chromeVersion = $versionInfo.ProductVersion
    $majorVersion = [int]($chromeVersion.Split('.')[0])
    Write-Host "Chrome version: $chromeVersion" -ForegroundColor Gray
    
    if ($majorVersion -ge 136) {
        Write-Host ""
        Write-Host "NOTE: Chrome 136+ requires using a separate user data directory for security." -ForegroundColor Yellow
        Write-Host "We'll create a copy of your user data for debugging." -ForegroundColor Yellow
        Write-Host ""
        
        # Check if debug user data already exists
        if (Test-Path $debugUserDataDir) {
            Write-Host "Debug user data directory already exists at:" -ForegroundColor Gray
            Write-Host "  $debugUserDataDir" -ForegroundColor Gray
            $response = Read-Host "Use existing copy or create fresh copy? (E=Existing, F=Fresh) [E]"
            
            if ($response -eq 'F' -or $response -eq 'f') {
                Write-Host "Removing old debug user data..." -ForegroundColor Yellow
                Remove-Item -Path $debugUserDataDir -Recurse -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
        }
        
        # Copy user data if needed
        if (-not (Test-Path $debugUserDataDir)) {
            Write-Host "Copying user data to debug directory (this may take a minute)..." -ForegroundColor Yellow
            Write-Host "Source: $defaultUserDataDir" -ForegroundColor Gray
            Write-Host "Destination: $debugUserDataDir" -ForegroundColor Gray
            
            # Close Chrome first if running
            $chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue
            if ($chromeRunning) {
                Write-Host ""
                Write-Host "Chrome is running. We need to close it to copy user data safely." -ForegroundColor Yellow
                $response = Read-Host "Close Chrome now? (Y/N)"
                if ($response -eq 'Y' -or $response -eq 'y') {
                    Write-Host "Closing Chrome..." -ForegroundColor Yellow
                    $chromeRunning | ForEach-Object { $_.CloseMainWindow() | Out-Null }
                    Start-Sleep -Seconds 2
                    $stillRunning = Get-Process chrome -ErrorAction SilentlyContinue
                    if ($stillRunning) {
                        Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
                    }
                    Start-Sleep -Seconds 2
                } else {
                    Write-Host "Cannot copy user data while Chrome is running. Exiting." -ForegroundColor Red
                    exit 1
                }
            }
            
            # Copy user data
            Write-Host "Copying files..." -ForegroundColor Yellow
            robocopy "$defaultUserDataDir" "$debugUserDataDir" /E /XD "Cache" "Code Cache" "GPUCache" /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
            Write-Host "User data copied!" -ForegroundColor Green
        }
        
        $userDataDir = $debugUserDataDir
    } else {
        Write-Host "Using default user data directory (Chrome < 136)" -ForegroundColor Gray
        $userDataDir = $defaultUserDataDir
    }
} catch {
    Write-Host "Could not determine Chrome version, using default user data directory" -ForegroundColor Yellow
    $userDataDir = $defaultUserDataDir
}

# Check if Chrome is running
$chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue

if ($chromeRunning) {
    Write-Host ""
    Write-Host "Chrome is currently running." -ForegroundColor Yellow
    Write-Host "To enable remote debugging, Chrome needs to be restarted with the flag." -ForegroundColor Yellow
    Write-Host "Your user data will be preserved." -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Close Chrome and restart with remote debugging? (Y/N)"
    
    if ($response -ne 'Y' -and $response -ne 'y') {
        Write-Host "Cancelled. Chrome will continue running normally." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Closing Chrome (this may take a few seconds)..." -ForegroundColor Yellow
    $chromeRunning | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    Start-Sleep -Seconds 2
    
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
    Write-Host "✓ Your user data is available." -ForegroundColor Green
    Write-Host "✓ You can now use the chrome-mcp server." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can verify by opening: http://localhost:9222/json" -ForegroundColor Cyan
    if ($majorVersion -ge 136) {
        Write-Host ""
        Write-Host "NOTE: You're using a copy of your user data for debugging." -ForegroundColor Yellow
        Write-Host "Changes in this session won't sync to your main Chrome profile." -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "WARNING: Could not verify connection automatically." -ForegroundColor Yellow
    Write-Host "Chrome may still be starting. Please try:" -ForegroundColor Yellow
    Write-Host "  1. Open http://localhost:9222/json in your browser" -ForegroundColor Yellow
    Write-Host "  2. If you see JSON data, remote debugging is working!" -ForegroundColor Yellow
    Write-Host ""
}


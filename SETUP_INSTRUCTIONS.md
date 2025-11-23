# Chrome MCP Setup and Automation Instructions

## Quick Start Guide

Follow these steps to correctly set up Chrome MCP and run the download automation.

## Step 1: Start Chrome with Remote Debugging

**IMPORTANT:** Always use the profile script to start Chrome, especially for Chrome 136+:

```powershell
.\scripts\startup\start-chrome-debug-with-profile.ps1
```

This script:
- ✅ Handles Chrome 136+ security restrictions
- ✅ Creates a separate user data directory for debugging
- ✅ Preserves your Chrome profile and settings
- ✅ Automatically enables remote debugging on port 9222

**Alternative (if the profile script doesn't work):**
```powershell
.\scripts\startup\start-chrome-debug.ps1
```

**Manual method (not recommended):**
```powershell
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### Verify Chrome Remote Debugging

After starting Chrome, verify it's working:

```powershell
Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing
```

If you see JSON output, remote debugging is active! ✅

## Step 2: Start Download Automation

Once Chrome is running with remote debugging enabled, start the automation:

```powershell
npm run auto-download
```

Or directly:

```powershell
node auto-download-standalone.js
```

The automation script will:
- ✅ Connect to Chrome automatically
- ✅ Monitor tabs every 30 seconds
- ✅ Find ExHentai torrent pages
- ✅ Download newest torrents automatically
- ✅ Close tabs after successful download
- ✅ Generate logs and reports

## Complete Setup Sequence

```powershell
# 1. Start Chrome with remote debugging (use profile script)
.\scripts\startup\start-chrome-debug-with-profile.ps1

# 2. Wait for Chrome to initialize (5-10 seconds)

# 3. Verify Chrome connection (optional)
Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing

# 4. Start automation
npm run auto-download
```

## Common Mistakes to Avoid

### ❌ DON'T:
- Start Chrome normally without the `--remote-debugging-port=9222` flag
- Use the wrong startup script (use `start-chrome-debug-with-profile.ps1` for Chrome 136+)
- Start automation before Chrome remote debugging is active
- Close Chrome and restart without the remote debugging flag

### ✅ DO:
- Always use `start-chrome-debug-with-profile.ps1` script
- Verify Chrome connection before starting automation
- Keep Chrome running while automation is active
- Check logs if something doesn't work

## Troubleshooting

### Chrome Remote Debugging Not Working

**Problem:** Cannot connect to Chrome on port 9222

**Solution:**
1. Close all Chrome windows
2. Run: `.\scripts\startup\start-chrome-debug-with-profile.ps1`
3. Wait 5-10 seconds for Chrome to initialize
4. Verify: `Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing`

### Automation Script Can't Connect

**Problem:** Automation shows "Cannot connect to Chrome"

**Solution:**
1. Verify Chrome is running with remote debugging:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing
   ```
2. If it fails, restart Chrome using the profile script
3. Restart the automation script

### Chrome 136+ Issues

**Problem:** Chrome won't start with remote debugging

**Solution:**
- Use `start-chrome-debug-with-profile.ps1` (not the basic script)
- This script handles Chrome 136+ security restrictions automatically
- It creates a separate user data directory for debugging

## Monitoring Automation

### View Logs

```powershell
# View today's log
Get-Content logs\auto-download-$(Get-Date -Format 'yyyy-MM-dd').log -Tail 20

# Follow log in real-time (if supported)
Get-Content logs\auto-download-$(Get-Date -Format 'yyyy-MM-dd').log -Wait
```

### Check Stats

```powershell
Get-Content logs\stats.json | ConvertFrom-Json | Format-List
```

### View Latest Report

```powershell
Get-ChildItem logs\batch-report-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

## Stopping Automation

To stop the automation:
1. Press `Ctrl+C` in the terminal where it's running
2. Or find and stop the Node.js process:
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

## Configuration

Edit `auto-download-standalone.js` to customize:

```javascript
const CHECK_INTERVAL = 30000;     // Check every 30 seconds (ms)
const MAX_CONCURRENT = 1;          // Process 1 tab at a time
const CLOSE_ON_SUCCESS = true;     // Auto-close tabs after download
const MAX_RETRIES = 3;             // Retry attempts per download
```

## Summary

**Correct Setup Order:**
1. ✅ Run `.\scripts\startup\start-chrome-debug-with-profile.ps1`
2. ✅ Wait for Chrome to initialize
3. ✅ Verify connection (optional)
4. ✅ Run `npm run auto-download`

**Remember:** Always use the profile script to start Chrome, especially for Chrome 136+!


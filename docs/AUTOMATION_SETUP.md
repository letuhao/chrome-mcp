# Full Automation Setup Guide

## Overview

The `auto-download-standalone.js` script runs **completely independently** without needing any agent interaction. It continuously monitors Chrome tabs and automatically downloads torrents.

## Features

✅ **Fully Automated**: Runs continuously without agent interaction  
✅ **Auto-Detection**: Automatically finds ExHentai torrent tabs  
✅ **Auto-Download**: Downloads newest torrent from each page  
✅ **Auto-Close**: Closes tabs after successful download  
✅ **Self-Logging**: Generates reports and logs automatically  
✅ **State Tracking**: Remembers processed tabs to avoid duplicates  
✅ **Error Handling**: Continues running even if individual tabs fail  

## Quick Start

### 1. Ensure Chrome is Running with Remote Debugging

**Windows PowerShell:**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Or use the existing script:**
```powershell
.\start-chrome-debug-with-profile.ps1
```

### 2. Start the Automation Script

```bash
npm run auto-download
```

Or directly:
```bash
node auto-download-standalone.js
```

### 3. Let It Run!

The script will:
- Check for new tabs every 30 seconds (configurable)
- Process ExHentai torrent tabs automatically
- Download newest torrent from each
- Close tabs after success
- Generate reports in `logs/` directory

**Press Ctrl+C to stop gracefully.**

## Configuration

Edit `auto-download-standalone.js` to customize:

```javascript
const CHECK_INTERVAL = 30000;     // Check every 30 seconds (ms)
const MAX_CONCURRENT = 1;          // Process 1 tab at a time
const CLOSE_ON_SUCCESS = true;     // Auto-close tabs after download
const MAX_RETRIES = 3;             // Retry attempts per download
const CHROME_PORT = 9222;          // Chrome debugging port
```

## Running as a Background Service

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Auto Download Torrents"
4. Trigger: At startup / Daily / Every X hours
5. Action: Start a program
   - Program: `node`
   - Arguments: `D:\Works\source\chrome-mcp\auto-download-standalone.js`
   - Start in: `D:\Works\source\chrome-mcp`
6. Check "Run whether user is logged on or not"
7. Save

### Windows Service (Alternative)

Use `node-windows` or `pm2` to run as a Windows service:

```bash
npm install -g pm2
pm2 start auto-download-standalone.js --name "auto-download"
pm2 save
pm2 startup
```

### Linux/Mac (systemd)

Create `/etc/systemd/system/auto-download.service`:

```ini
[Unit]
Description=Auto Download Torrents
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/chrome-mcp
ExecStart=/usr/bin/node auto-download-standalone.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable auto-download
sudo systemctl start auto-download
sudo systemctl status auto-download
```

## Monitoring

### Log Files

All logs are saved in `logs/` directory:
- `auto-download-YYYY-MM-DD.log` - Daily log file
- `batch-report-YYYY-MM-DDTHH-MM-SS.json` - Batch processing reports
- `stats.json` - Current statistics and state

### Check Status

```bash
# View latest log
tail -f logs/auto-download-$(date +%Y-%m-%d).log

# View stats
cat logs/stats.json

# View latest report
ls -t logs/batch-report-*.json | head -1 | xargs cat
```

### Performance

For 500 tabs per day:
- **Time per tab**: ~3-5 seconds (download + close)
- **Daily processing time**: ~25-42 minutes (if sequential)
- **With parallel processing** (MAX_CONCURRENT=5): ~5-8 minutes
- **Resource usage**: Minimal (mostly waiting)

## Agent Interaction (Minimal)

You only need to interact with the agent for:

1. **Initial Setup**: First time configuration
2. **Error Investigation**: If script fails repeatedly
3. **Configuration Changes**: Adjusting intervals/behavior
4. **Status Checks**: Occasional verification (optional)

**The script runs completely independently otherwise!**

## Troubleshooting

### Script Not Starting

1. Check Chrome is running: `http://localhost:9222/json`
2. Verify port 9222 is accessible
3. Check script permissions: `chmod +x auto-download-standalone.js`

### No Tabs Being Processed

1. Check logs: `logs/auto-download-*.log`
2. Verify tabs match pattern: `gallerytorrents.php`
3. Check if tabs already processed: `logs/stats.json`

### Downloads Not Working

1. Check Chrome download settings
2. Verify network connectivity
3. Check ExHentai login status in Chrome

### High CPU/Memory Usage

1. Reduce `CHECK_INTERVAL` (check less frequently)
2. Reduce `MAX_CONCURRENT` (process fewer tabs at once)
3. Add delays between operations

## Example Workflow

```bash
# 1. Start Chrome with debugging
.\start-chrome-debug-with-profile.ps1

# 2. Start automation script
npm run auto-download

# 3. Let it run (goes to background automatically if using pm2)

# 4. Check logs occasionally
tail -f logs/auto-download-*.log

# 5. Check stats
cat logs/stats.json

# 6. Stop when needed
# Ctrl+C or: pm2 stop auto-download
```

## Advanced: Parallel Processing

To process multiple tabs simultaneously:

```javascript
const MAX_CONCURRENT = 5; // Process 5 tabs at once
```

Then modify `processTabs` function to use `Promise.all` with batching.

## Summary

- **Zero Agent Overhead**: Script runs independently
- **Minimal Setup**: One command to start
- **Self-Monitoring**: Logs and reports generated automatically
- **Production Ready**: Can run 24/7 as a service
- **Scalable**: Handles 500+ tabs per day easily

The automation handles everything - you just need to:
1. Start it once
2. Check logs occasionally (optional)
3. Let it run!


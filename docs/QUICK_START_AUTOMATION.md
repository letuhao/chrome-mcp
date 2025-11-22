# Quick Start: Fully Automated Torrent Download

## The Problem You Described

You have **500 tabs per day** to download, and using an agent for each tab would consume too many tokens. You need **true automation** that runs independently.

## The Solution

The `auto-download-standalone.js` script runs **completely independently** without agent interaction:

✅ **Zero Agent Overhead**: Runs as a standalone Node.js script  
✅ **Continuous Monitoring**: Checks for new tabs every 30 seconds  
✅ **Automatic Processing**: Finds, downloads, and closes tabs automatically  
✅ **Self-Logging**: Generates reports in `logs/` directory  
✅ **State Tracking**: Remembers processed tabs (no duplicates)  
✅ **Production Ready**: Can run 24/7 as a background service  

## How It Works

1. **Connects to Chrome** via Chrome DevTools Protocol (CDP) on port 9222
2. **Monitors tabs continuously** every 30 seconds (configurable)
3. **Finds ExHentai torrent tabs** automatically
4. **Downloads newest torrent** from each page
5. **Closes tabs** after successful download
6. **Generates reports** in `logs/` directory
7. **Continues running** until stopped (Ctrl+C)

**No agent needed - it runs completely independently!**

## Quick Start (3 Steps)

### Step 1: Start Chrome with Remote Debugging

**Windows PowerShell:**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Or use your existing script:**
```powershell
.\start-chrome-debug-with-profile.ps1
```

### Step 2: Start the Automation Script

```bash
npm run auto-download
```

Or directly:
```bash
node auto-download-standalone.js
```

### Step 3: Let It Run!

The script will:
- Check for new tabs every 30 seconds
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
```

## For 500 Tabs Per Day

**Estimated Time:**
- Sequential (1 at a time): ~25-42 minutes per day
- Parallel (5 at a time): ~5-8 minutes per day

**Setup for High Volume:**

1. **Increase parallel processing:**
   ```javascript
   const MAX_CONCURRENT = 5; // Process 5 tabs at once
   ```

2. **Reduce check interval:**
   ```javascript
   const CHECK_INTERVAL = 10000; // Check every 10 seconds
   ```

3. **Run as a background service** (see AUTOMATION_SETUP.md)

## Monitoring (Optional)

### Check Logs

```bash
# View today's log
cat logs/auto-download-$(date +%Y-%m-%d).log

# Or on Windows PowerShell:
Get-Content logs/auto-download-$(Get-Date -Format "yyyy-MM-dd").log
```

### Check Stats

```bash
cat logs/stats.json
```

### Check Latest Report

```bash
# Linux/Mac
ls -t logs/batch-report-*.json | head -1 | xargs cat

# Windows PowerShell
Get-ChildItem logs\batch-report-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

## Running as Background Service

### Option 1: Task Scheduler (Windows)

1. Open Task Scheduler
2. Create task to run `node auto-download-standalone.js`
3. Set trigger: At startup / Daily
4. Run even when user is not logged in

### Option 2: PM2 (Cross-platform)

```bash
npm install -g pm2
pm2 start auto-download-standalone.js --name "auto-download"
pm2 save
pm2 startup  # Run command it shows to auto-start on boot
```

### Option 3: Windows Service

See `AUTOMATION_SETUP.md` for detailed instructions.

## Agent Interaction (Minimal!)

You only need the agent for:

1. **Initial setup** - First time configuration
2. **Error investigation** - If script fails repeatedly  
3. **Config changes** - Adjusting intervals/behavior
4. **Status checks** - Occasional verification (optional)

**For daily operations: ZERO agent interaction needed!**

## File Structure

```
chrome-mcp/
├── auto-download-standalone.js  # Main automation script
├── scripts/
│   └── download-newest-torrent-enhanced.js  # Torrent selection logic
├── logs/                        # Generated automatically
│   ├── auto-download-YYYY-MM-DD.log       # Daily logs
│   ├── batch-report-YYYY-MM-DDTHH-MM-SS.json  # Batch reports
│   └── stats.json               # Current statistics
└── package.json
```

## Troubleshooting

### Script Not Starting

**Check Chrome connection:**
```bash
curl http://localhost:9222/json
# Or open in browser: http://localhost:9222/json
```

**If connection fails:**
1. Ensure Chrome is running with `--remote-debugging-port=9222`
2. Check firewall isn't blocking port 9222
3. Try restarting Chrome with the flag

### No Tabs Being Processed

1. **Check logs:**
   ```bash
   cat logs/auto-download-*.log | tail -20
   ```

2. **Verify tabs match pattern:**
   - URLs must contain `gallerytorrents.php`

3. **Check if tabs already processed:**
   ```bash
   cat logs/stats.json
   ```

### Downloads Not Working

1. Check Chrome download folder exists and is writable
2. Verify network connectivity
3. Check ExHentai login status in Chrome

## Summary

✅ **Fully Automated**: Runs independently, no agent needed  
✅ **Zero Token Cost**: No agent interaction for daily operations  
✅ **Scalable**: Handles 500+ tabs per day easily  
✅ **Production Ready**: Can run 24/7 as a service  
✅ **Self-Monitoring**: Logs and reports generated automatically  

**You just start it once and let it run!**

## Next Steps

1. **Start it once**: `npm run auto-download`
2. **Check logs occasionally**: Optional verification
3. **Adjust config if needed**: Edit `auto-download-standalone.js`
4. **Set up as service**: For 24/7 operation (see AUTOMATION_SETUP.md)

The script handles everything else automatically! 🚀


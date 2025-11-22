# Automated Batch Download - Usage Guide

## Features

✅ **Automatic Tab Closing**: Tabs are automatically closed after successful download  
✅ **Batch Processing**: Process multiple tabs automatically  
✅ **Continuous Monitoring**: Monitor for new tabs and download automatically  
✅ **Retry Logic**: Automatically retry failed downloads  
✅ **Reports**: Generate detailed reports for tracking

## Quick Start

### Manual Batch Download (One-time)

Use the `batch_download_torrents` tool:

```json
{
  "reportPath": "./batch-report-after.json",
  "closeOnSuccess": true
}
```

This will:
- Find all ExHentai torrent tabs
- Download newest torrent from each tab
- Close tabs after successful download
- Generate a report

### Automated Continuous Download

Use the `auto_batch_download_torrents` tool for continuous monitoring:

```json
{
  "interval": 30,
  "closeOnSuccess": true,
  "reportPath": "./auto-download-reports",
  "maxRunTime": 3600
}
```

**Note**: For true automation, you need to set up a background process or scheduled task that calls this tool periodically.

## Tool Parameters

### `batch_download_torrents`

- `urls` (optional): Array of specific URLs to process
- `maxRetries` (default: 3): Maximum retry attempts per download
- `reportPath` (optional): Path to save report JSON file
- `autoRetry` (default: true): Automatically retry failed downloads
- `closeOnSuccess` (default: true): **Automatically close tabs after successful download**

### `auto_batch_download_torrents`

- `interval` (default: 30): Check interval in seconds
- `maxRetries` (default: 3): Maximum retry attempts per download
- `reportPath` (optional): Path to save report JSON files (with timestamps)
- `closeOnSuccess` (default: true): **Automatically close tabs after successful download**
- `maxRunTime` (default: 0): Maximum runtime in seconds (0 = unlimited)

## Automation Setup

### Option 1: Schedule via Windows Task Scheduler

1. Create a task that runs periodically
2. Run your MCP client with `batch_download_torrents` tool
3. Set frequency (e.g., every 30 minutes)

### Option 2: Background Script (Node.js)

Create a script that calls the MCP tool periodically:

```javascript
// run-auto-download.js
const { spawn } = require('child_process');

function runBatchDownload() {
  // Call your MCP client or tool here
  console.log('Running batch download...');
  
  // Example: spawn a process to call MCP tool
  // This depends on your MCP client setup
}

// Run every 30 seconds
setInterval(runBatchDownload, 30000);

// Run immediately
runBatchDownload();
```

### Option 3: Simple Loop Script

Create a PowerShell script for Windows:

```powershell
# auto-download.ps1
while ($true) {
    Write-Host "Running batch download at $(Get-Date)"
    # Call your MCP tool here
    Start-Sleep -Seconds 30
}
```

## Report Format

Reports are saved as JSON with the following structure:

```json
{
  "timestamp": "2025-01-20T12:00:00.000Z",
  "status": "post_download",
  "totalTabs": 3,
  "processed": 3,
  "succeeded": 3,
  "failed": 0,
  "items": [
    {
      "tab": {
        "id": "...",
        "url": "...",
        "title": "..."
      },
      "success": true,
      "downloadUrl": "...",
      "tabClosed": true,
      "retryCount": 0,
      "preReport": { ... },
      "postReport": { ... }
    }
  ]
}
```

## Benefits

1. **No Manual Intervention**: Downloads happen automatically
2. **Clean Tab Management**: Tabs close after successful download
3. **Retry on Failure**: Automatic retry with page reload
4. **Full Tracking**: Detailed reports for all downloads
5. **Flexible Scheduling**: Run on-demand or continuously

## Notes

- Tabs are **only closed on successful download** (if `closeOnSuccess: true`)
- Failed downloads keep tabs open for manual inspection
- Reports include all details for retry if needed
- The tool automatically detects ExHentai torrent pages
- Works with any number of tabs simultaneously


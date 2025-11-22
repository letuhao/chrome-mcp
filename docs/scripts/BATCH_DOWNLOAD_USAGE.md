# Batch Torrent Download with Reports

## Overview

The `batch_download_torrents` tool allows you to download newest torrents from multiple ExHentai tabs with:
- ✅ Download verification
- ✅ Automatic retry with page reload on failure
- ✅ Pre-download and post-download reports
- ✅ Report saving for manual retry of failed downloads

## Usage

### Basic Usage (Process All ExHentai Torrent Tabs)

```json
{
  "name": "batch_download_torrents",
  "arguments": {}
}
```

This will:
1. Find all open tabs with `gallerytorrents.php` in the URL
2. Process each tab to find and download the newest torrent
3. Retry failed downloads up to 3 times (default)
4. Generate a comprehensive report

### With Specific URLs

```json
{
  "name": "batch_download_torrents",
  "arguments": {
    "urls": [
      "https://exhentai.org/gallerytorrents.php?gid=123456",
      "https://exhentai.org/gallerytorrents.php?gid=789012"
    ],
    "maxRetries": 5,
    "reportPath": "./download-report.json",
    "autoRetry": true
  }
}
```

### Parameters

- `urls` (optional): Array of specific URLs to process. If not provided, processes all ExHentai torrent tabs
- `maxRetries` (optional, default: 3): Maximum number of retry attempts per download
- `reportPath` (optional): Path to save the JSON report file
- `autoRetry` (optional, default: true): Automatically retry failed downloads with page reload

## Report Format

The report is a JSON object with the following structure:

```json
{
  "timestamp": "2025-01-20T12:00:00.000Z",
  "totalTabs": 10,
  "processed": 10,
  "succeeded": 8,
  "failed": 2,
  "retries": 5,
  "items": [
    {
      "tab": {
        "id": "tab-id",
        "url": "https://exhentai.org/gallerytorrents.php?gid=123456",
        "title": "Torrents for Gallery Title"
      },
      "success": true,
      "selectedTorrent": {
        "postedDate": "2025-11-21 13:18",
        "seeds": 19,
        "peers": 1,
        "downloadLink": "https://exhentai.org/torrent/...",
        "filename": "example.zip",
        "uploader": "Username",
        "size": "68.29 MiB",
        "galleryId": "123456",
        "isNewest": true,
        "hasSeeders": true,
        "selectionReason": "newest_with_seeders"
      },
      "downloadUrl": "https://exhentai.org/torrent/...",
      "retryCount": 0,
      "preReport": {
        "timestamp": "2025-01-20T12:00:00.000Z",
        "pageUrl": "https://exhentai.org/gallerytorrents.php?gid=123456",
        "pageTitle": "Torrents for Gallery Title",
        "status": "ready",
        "action": "pre_download",
        "selectedTorrent": { /* ... */ },
        "totalTorrents": 1
      },
      "postReport": {
        "timestamp": "2025-01-20T12:00:05.000Z",
        "action": "post_download",
        "downloadStatus": "success",
        "downloadUrl": "https://exhentai.org/torrent/...",
        /* ... other pre-report fields ... */
      },
      "error": null
    }
  ]
}
```

## Retrying Failed Downloads

### Method 1: Using the Report File

1. Save the report to a file by providing `reportPath`:
```json
{
  "name": "batch_download_torrents",
  "arguments": {
    "reportPath": "./download-report.json"
  }
}
```

2. Extract failed URLs from the report:
```javascript
const report = JSON.parse(fs.readFileSync('./download-report.json', 'utf-8'));
const failedUrls = report.items
  .filter(item => !item.success)
  .map(item => item.tab.url);
```

3. Retry with failed URLs:
```json
{
  "name": "batch_download_torrents",
  "arguments": {
    "urls": [/* failed URLs here */],
    "maxRetries": 5,
    "reportPath": "./download-retry-report.json"
  }
}
```

### Method 2: Manual Retry Script

Use the `retry-failed-downloads.js` script to extract failed URLs:

```javascript
const { retryFailedDownloads } = require('./scripts/retry-failed-downloads.js');

const result = await retryFailedDownloads('./download-report.json');
console.log(result.failedUrls); // Array of URLs to retry
```

## Download Verification

The tool verifies downloads by:
1. Navigating to the torrent URL
2. Checking if the browser initiated the download (by checking page response)
3. Waiting 3 seconds for download to start
4. Verifying navigation success

If verification fails, the tool will:
1. Reload the page
2. Retry the download (up to `maxRetries` times)
3. Mark the download as failed in the report if all retries fail

## Report Analysis

### Success Rate

```javascript
const report = JSON.parse(fs.readFileSync('./download-report.json', 'utf-8'));
const successRate = (report.succeeded / report.totalTabs) * 100;
console.log(`Success rate: ${successRate}%`);
```

### Failed Downloads Summary

```javascript
const failed = report.items.filter(item => !item.success);
failed.forEach(item => {
  console.log(`Failed: ${item.tab.title}`);
  console.log(`  URL: ${item.tab.url}`);
  console.log(`  Error: ${item.error}`);
  console.log(`  Retries: ${item.retryCount}`);
});
```

## Best Practices

1. **Save Reports**: Always save reports to files for later analysis
2. **Review Failed Downloads**: Check failed items to identify patterns
3. **Adjust Retry Count**: Increase `maxRetries` for unreliable connections
4. **Process in Batches**: Don't process too many tabs at once (100+ tabs may be slow)
5. **Monitor Progress**: Check reports periodically during long batch operations

## Troubleshooting

### All Downloads Failing

- Check if Chrome remote debugging is enabled (port 9222)
- Verify tabs are still open
- Check network connectivity
- Review error messages in the report

### Timeouts

- Increase retry delay in the code if needed
- Check if ExHentai is responding
- Verify browser isn't blocked by rate limiting

### Missing Tabs

- Ensure tabs with `gallerytorrents.php` are open
- Check if URLs match exactly when using `urls` parameter
- Verify tabs haven't been closed


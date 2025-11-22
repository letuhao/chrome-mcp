# Torrent Download Scripts

## download-newest-torrent.js

A reusable script to automatically find and download the newest torrent from ExHentai torrent pages.

### Logic

1. Finds all torrents on the page by parsing forms with "Posted:" and "Seeds:" information
2. Sorts torrents by posted date (newest first)
3. Selects the best torrent based on:
   - **Newest with seeders**: If the newest torrent has seeders > 0, use it
   - **Alternative with seeders**: If newest has 0 seeders, find the oldest torrent that has seeders > 0
   - **Newest anyway**: If no torrents have seeders, use the newest anyway

### Usage

#### Via MCP Tool (Recommended)

Use the `download_newest_torrent` tool from the Chrome MCP server:

```json
{
  "name": "download_newest_torrent",
  "arguments": {
    "autoDownload": true
  }
}
```

Parameters:
- `autoDownload` (optional, default: `true`): Automatically download the selected torrent. If `false`, only returns the selection information without downloading.

#### Via Chrome MCP execute_script

You can also execute the script directly using the `execute_script` tool:

```javascript
// Read and execute the script
const script = `...` // contents of download-newest-torrent.js
```

### Return Format

The script returns a JSON object with:

```json
{
  "success": true,
  "downloadUrl": "https://exhentai.org/torrent/...",
  "selectedTorrent": {
    "postedDate": "2025-11-21 13:18",
    "seeds": 19,
    "peers": 1,
    "downloadLink": "https://...",
    "filename": "example.zip",
    "uploader": "Username",
    "size": "68.29 MiB",
    "isNewest": true,
    "hasSeeders": true,
    "selectionReason": "newest_with_seeders"
  },
  "allTorrents": [
    {
      "postedDate": "2025-11-21 13:18",
      "seeds": 19,
      "peers": 1,
      "downloadLink": "https://...",
      "filename": "example.zip"
    }
  ],
  "totalTorrents": 1
}
```

### Error Handling

If the script fails, it returns:

```json
{
  "success": false,
  "error": "Error message here",
  "torrents": []
}
```

Possible errors:
- `"No torrents found on the page"` - The page doesn't contain any torrent forms
- `"Failed to select torrent"` - Could not parse torrent information
- Other parsing/execution errors

### Requirements

- The script must be executed on an ExHentai torrent page (URL containing `gallerytorrents.php`)
- The page must contain forms with torrent information including "Posted:" and "Seeds:" fields
- Chrome remote debugging must be enabled on port 9222


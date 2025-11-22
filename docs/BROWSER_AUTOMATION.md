# Browser Automation Guide

Your chrome-mcp server now has full browser control capabilities! Here's what you can do:

## New Features

### 1. **Download Files**
- `download_file` - Download files from current page or specific URL
- `wait_for_download` - Wait for downloads to complete
- `get_downloads` - Get list of recent downloads

### 2. **Tab Management**
- `close_tab` - Close specific tabs by URL or tab ID
- `switch_to_tab` - Switch between tabs
- `list_tabs` - List all open tabs (already existed)

### 3. **Page Control**
- `get_page_content` - Get page text or HTML
- `click_element` - Click any element on the page
- `type_text` - Type into input fields
- `execute_script` - Run JavaScript on the page
- `take_screenshot` - Capture screenshots

### 4. **Batch Operations**
- `batch_download_and_close` - Download files from multiple tabs and close them automatically

## Usage Examples

### Example 1: Download files from multiple tabs and close them

```
"Download files from these URLs and close the tabs after:
- https://example.com/file1
- https://example.com/file2
- https://example.com/file3

Use selector: 'a.download-link'"
```

The AI will:
1. Navigate to each URL
2. Click the download link/button
3. Wait for download to start
4. Close the tab
5. Move to the next URL

### Example 2: Close specific tabs

```
"Close all tabs with 'exhentai.org' in the URL"
```

### Example 3: Get page content

```
"Show me the text content of the current page"
```

### Example 4: Click and interact

```
"Click the button with class 'download-btn' on the current page"
```

## How to Use

1. **Make sure Chrome is running with remote debugging:**
   ```powershell
   .\start-chrome-debug-with-profile.ps1
   ```

2. **Restart Cursor** to load the updated MCP server

3. **Ask the AI to control your browser:**
   - "Download files from these tabs and close them"
   - "Show me what's on the current page"
   - "Click the download button"
   - "Close all tabs with 'example.com'"

## Tips

- The browser automation works with your actual Chrome browser and user data
- Downloads go to your default Chrome downloads folder
- You can specify CSS selectors to find elements (e.g., `'a.download-link'`, `'#download-btn'`)
- The batch download feature is perfect for downloading multiple files automatically

## Troubleshooting

- If tools don't appear: Restart Cursor to reload the MCP server
- If connection fails: Make sure Chrome is running with `--remote-debugging-port=9222`
- If downloads don't work: Check that the selector matches the download link/button on the page


# Using Chrome MCP with Your User Data

## The Problem

The `cursor-browser-extension` MCP opens a separate browser instance without your user data (bookmarks, history, logged-in sessions, etc.).

## The Solution

Use your custom `chrome-mcp` server which connects to your actual Chrome instance with all your data.

### Important: Chrome 136+ Security Restriction

Chrome 136+ blocks remote debugging when using the default user data directory for security. You have two options:

### Option 1: Use the Script (Recommended)

Run the script that handles Chrome 136+ automatically:

```powershell
.\start-chrome-debug-with-profile.ps1
```

This script will:
- Check your Chrome version
- If Chrome 136+, create a copy of your user data for debugging
- Start Chrome with remote debugging enabled
- Preserve your bookmarks, extensions, and most settings

**Note for Chrome 136+**: The script creates a copy of your user data. Changes made during debugging won't sync back to your main profile, but you'll have access to your bookmarks, extensions, and logged-in sessions.

### Option 2: Manual Setup

1. **For Chrome < 136:**
   ```powershell
   # Close Chrome completely, then:
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data"
   ```

2. **For Chrome 136+:**
   ```powershell
   # First, close Chrome completely
   # Then copy your user data:
   $source = "$env:LOCALAPPDATA\Google\Chrome\User Data"
   $dest = "$env:LOCALAPPDATA\Google\Chrome\User Data Debug"
   robocopy $source $dest /E /XD "Cache" "Code Cache" "GPUCache"
   
   # Start Chrome with the copied user data:
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$dest"
   ```

### Verify It Works

1. After starting Chrome, open: `http://localhost:9222/json`
2. You should see JSON data with your tabs
3. In Cursor, ask: "Show me the current Chrome tab"
4. The `chrome-mcp` server should now connect to your Chrome with your data!

## Alternative: Keep Using Browser Extension MCP

If you prefer the browser extension MCP (which doesn't require restarting Chrome), note that it uses a separate browser instance without your profile data. This is a limitation of that MCP server.


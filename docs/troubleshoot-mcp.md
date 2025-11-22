# MCP Server Troubleshooting Guide

## Quick Fix: Restart Cursor

**Yes, restart Cursor** - This is the most common solution for MCP connection issues.

## Steps to Fix:

### 1. Restart Cursor (Recommended First Step)
1. Close Cursor completely
2. Reopen Cursor
3. Check if MCP server shows as "Connected" (green status)

### 2. If Restart Doesn't Work, Rebuild the Server
```powershell
npm run build
```

### 3. Verify MCP Server Configuration in Cursor
1. Open Cursor Settings (Ctrl+,)
2. Go to **Features** → **Model Context Protocol**
3. Find `chrome-mcp` server
4. Verify the configuration:
   - **Command:** `node`
   - **Arguments:** `["D:\\Works\\source\\chrome-mcp\\dist\\index.js"]`
   - Make sure the path is correct!

### 4. Toggle MCP Server Off/On
1. In Cursor MCP settings, toggle `chrome-mcp` **OFF**
2. Wait 2 seconds
3. Toggle it **ON** again
4. Check if status changes to "Connected"

### 5. Check Chrome Remote Debugging
Chrome must be running with remote debugging enabled:
- Chrome should be started with: `--remote-debugging-port=9222`
- Verify by running: `curl http://localhost:9222/json`
- If you see JSON with tab info, Chrome debugging is active

### 6. Test MCP Server Manually
```powershell
node dist/index.js
```
The server should output: "Chrome MCP server running on stdio"
If it crashes or errors, there's a code issue.

### 7. Check for Conflicting Processes
If you see multiple `node` processes running, they might be interfering:
```powershell
Get-Process -Name node | Stop-Process -Force
```
Then restart Cursor.

### 8. Check Cursor Logs
Look in Cursor's output panel for MCP errors:
- View → Output → Select "Chrome MCP" or "MCP" from dropdown
- Look for error messages

## Common Issues:

### Issue: "Not connected" error
**Solution:** Restart Cursor (step 1) or toggle MCP server off/on (step 4)

### Issue: "Cannot connect to Chrome"
**Solution:** Make sure Chrome is running with `--remote-debugging-port=9222`

### Issue: "Module not found"
**Solution:** Run `npm run build` to rebuild the server

### Issue: MCP server shows error immediately
**Solution:** Check Cursor logs for the specific error message

## Verification Steps:

After fixing, test by asking Cursor:
- "List my Chrome tabs"
- "What's the current Chrome tab?"

If these work, the MCP connection is fixed!


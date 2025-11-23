# Chrome MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-1.0.4-purple.svg)](https://modelcontextprotocol.io/)

A powerful **Model Context Protocol (MCP) server** for Chrome browser automation and integration with Cursor IDE. Control your Chrome browser directly from Cursor, automate tasks, and build browser automation workflows with AI assistance.

## ✨ Features

### 🎯 Core Capabilities
- **Browser Control**: Navigate, click, type, and interact with web pages
- **Tab Management**: List, switch, and close Chrome tabs
- **Page Inspection**: Get page content, take screenshots, execute JavaScript
- **Download Automation**: Download files and automate download workflows
- **Smart Torrent Selection**: Automated torrent selection with seeders/date logic

### 🚀 Advanced Features
- **Connection Health Checks**: Automatic reconnection on Chrome disconnections
- **Timeout Protection**: Prevents infinite hangs with configurable timeouts
- **Retry Logic**: Automatic retry with page reload for failed operations
- **Batch Processing**: Process multiple tabs simultaneously
- **Comprehensive Reporting**: Detailed pre/post download reports
- **Standalone Automation**: Background script for continuous monitoring

### 🛠️ Technical Highlights
- ✅ **Robust Error Handling**: Graceful failure recovery
- ✅ **TypeScript**: Full type safety
- ✅ **Connection Pooling**: Efficient resource management
- ✅ **Health Monitoring**: Automatic connection validation
- ✅ **Production Ready**: Battle-tested with timeout and retry mechanisms

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Available Tools](#-available-tools)
- [Usage Examples](#-usage-examples)
- [Automation Features](#-automation-features)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Installation

### Prerequisites
- **Node.js** 20+ installed
- **Chrome** browser installed
- **Cursor IDE** (for MCP integration)

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd chrome-mcp
npm install
```

### Step 2: Build the Server

```bash
npm run build
```

### Step 3: Start Chrome with Remote Debugging

**⚠️ IMPORTANT:** For Chrome 136+, always use the profile script to handle security restrictions.

**Windows (Recommended):**
```powershell
.\scripts\startup\start-chrome-debug-with-profile.ps1
```

This script automatically handles Chrome 136+ security restrictions and preserves your user data.

**Alternative (Chrome < 136):**
```bash
.\scripts\startup\start-chrome-debug.bat
```

**Manual method (not recommended):**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

> **📖 For detailed setup instructions, see [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)**

**macOS:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Linux:**
```bash
google-chrome --remote-debugging-port=9222
```

> **Note:** Close all Chrome instances before starting with remote debugging enabled.

### Step 4: Configure Cursor

1. Open **Cursor Settings** (`Ctrl+,` or `Cmd+,`)
2. Navigate to **Features** → **Model Context Protocol**
3. Click **Add MCP Server**
4. Configure as follows:

   **Name:** `chrome-mcp`
   
   **Command:** `node`
   
   **Arguments:** `["<absolute-path-to-project>/dist/index.js"]`
   
   Example:
   ```json
   ["D:\\Works\\source\\chrome-mcp\\dist\\index.js"]
   ```

5. Save and verify connection status (should show "Connected")

## 🎯 Quick Start

### Running Download Automation

**Quick Setup:**
1. Start Chrome: `.\scripts\startup\start-chrome-debug-with-profile.ps1`
2. Start automation: `npm run auto-download`

See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for detailed instructions.

### Using MCP Tools in Cursor

Once configured, you can control Chrome directly from Cursor chat:

```
# List all Chrome tabs
"List my Chrome tabs"

# Navigate to a website
"Navigate to https://example.com"

# Get current tab info
"What's the current Chrome tab?"

# Take a screenshot
"Take a screenshot of the current page"
```

## 📚 Available Tools

### Browser Control
- **`get_current_tab`** - Get information about the current active Chrome tab
- **`list_tabs`** - List all open Chrome tabs with details
- **`navigate_to_url`** - Navigate to a specific URL
- **`switch_to_tab`** - Switch to a specific tab by URL or ID
- **`close_tab`** - Close a specific tab
- **`check_chrome_connection`** - Verify Chrome remote debugging connection

### Page Interaction
- **`get_page_content`** - Get HTML or text content of current page
- **`click_element`** - Click an element using CSS selector or XPath
- **`type_text`** - Type text into input fields
- **`execute_script`** - Execute JavaScript on the page
- **`take_screenshot`** - Capture page or viewport screenshot

### Downloads
- **`download_file`** - Download file from URL or click download link
- **`wait_for_download`** - Wait for download to complete
- **`get_downloads`** - Get list of recent downloads
- **`batch_download_and_close`** - Batch download from multiple tabs

### Advanced Automation
- **`download_newest_torrent`** - Smart torrent selection and download
  - Selects newest torrent with seeders
  - Falls back to older torrents with seeders
  - Handles outdated torrent sections
  
- **`batch_download_torrents`** - Batch torrent download with reports
  - Processes multiple tabs
  - Retry logic with page reload
  - Comprehensive pre/post reports
  - Automatic tab closing on success

## 💡 Usage Examples

### Basic Navigation

```typescript
// Via Cursor chat:
"Navigate to https://github.com and take a screenshot"
```

### Form Interaction

```typescript
// Via Cursor chat:
"Go to google.com, find the search box, and type 'MCP server'"
```

### Batch Operations

```typescript
// Via Cursor chat:
"Download newest torrents from all ExHentai tabs that are open"
```

### JavaScript Execution

```typescript
// Via Cursor chat:
"Execute JavaScript to get all links on the current page"
```

## 🤖 Automation Features

### Standalone Automation Script

**⚠️ IMPORTANT:** Always start Chrome with remote debugging first using the profile script:
```powershell
.\scripts\startup\start-chrome-debug-with-profile.ps1
```

Then run continuous monitoring in the background:

```bash
npm run auto-download
```

> **📖 See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for complete setup guide**

**Features:**
- Monitors Chrome tabs for ExHentai torrent pages
- Automatically downloads newest torrents
- Closes tabs after successful download
- Generates detailed logs and reports
- Runs independently of Cursor

**Configuration:**
- Edit `auto-download-standalone.js` to customize:
  - Download folder path
  - Polling interval
  - Retry logic
  - Logging settings

### Smart Torrent Selection Logic

The automation uses intelligent selection:

1. **Prefer Newest Section**: Only considers torrents in "newest" section
2. **Seeders Priority**: Prefers torrents with active seeders
3. **Fallback Logic**: Falls back to outdated section if no newest torrents
4. **Selection Order**:
   - Newest torrent with seeders ✓
   - Alternative newest torrent with seeders
   - Newest torrent without seeders (last resort)
   - Outdated torrent with seeders (if no newest available)

## 📁 Project Structure

```
chrome-mcp/
├── README.md                    # Main project documentation
├── package.json                 # Node.js dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── .gitignore                   # Git ignore rules
├── auto-download-standalone.js  # Standalone automation script
│
├── src/                         # Source code
│   └── index.ts                 # Main MCP server implementation
│
├── dist/                        # Compiled output (generated, gitignored)
│   └── index.js
│
├── docs/                        # Documentation
│   ├── README.md                # Documentation index
│   ├── AUTOMATION_SETUP.md
│   ├── QUICK_START_AUTOMATION.md
│   ├── AUTO_DOWNLOAD_USAGE.md
│   └── ... (see docs/README.md for full list)
│
├── scripts/                     # Scripts and utilities
│   ├── download-newest-torrent.js          # Basic torrent selector
│   ├── download-newest-torrent-enhanced.js # Enhanced torrent selector
│   ├── retry-failed-downloads.js           # Retry logic
│   ├── helpers/                            # Helper scripts
│   │   └── test-mcp-connection.js          # Connection testing
│   └── startup/                             # Chrome startup scripts
│       ├── start-chrome-debug.bat
│       └── start-chrome-debug.ps1
│
├── logs/                        # Logs and reports (gitignored)
│   ├── auto-download-*.log
│   └── batch-report-*.json
│
└── reports/                     # Temporary reports (gitignored)
    └── *-report*.json
```

For detailed folder structure, see [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

## 🔧 Configuration

### Custom Download Folder

Edit `auto-download-standalone.js`:
```javascript
const DOWNLOAD_FOLDER = 'D:\\Your\\Download\\Folder';
```

### Chrome Remote Debugging Port

Default: `9222`

To change, modify the port in:
- Chrome startup command: `--remote-debugging-port=YOUR_PORT`
- MCP server code: `src/index.ts` (default `9222`)

## 🐛 Troubleshooting

### "Not connected" Error

1. **Verify Chrome is running** with remote debugging:
   ```bash
   curl http://localhost:9222/json
   ```
   Should return JSON array of tabs.

2. **Restart Cursor MCP Server**:
   - Toggle MCP server OFF/ON in Cursor settings
   - Restart Cursor if needed

3. **Rebuild the server**:
   ```bash
   npm run build
   ```

### Connection Timeout

- Ensure Chrome is running with `--remote-debugging-port=9222`
- Check firewall isn't blocking port 9222
- Verify no other process is using port 9222

### Downloads Not Working

- Check download folder permissions
- Verify Chrome download settings
- Check browser console for errors

### MCP Server Shows Error

1. Check Cursor output logs (View → Output → MCP)
2. Verify `dist/index.js` exists (run `npm run build`)
3. Check Node.js version (requires 20+)

## 📊 Monitoring and Reports

### Automation Logs

Logs are saved to `logs/auto-download-YYYY-MM-DD.log`:
```
[INFO] Processing tab: Tab Title
[INFO]   Connected to tab...
[INFO]   Found torrent: 2025-11-21 15:47 (Seeds: 2)
[INFO]   ✓ Successfully processed tab
```

### Download Reports

Reports saved to `logs/batch-report-before-*.json` and `logs/batch-report-after-*.json`:
- Pre-download: Selected torrent details
- Post-download: Success/failure status
- Manual retry: Failed downloads for manual intervention

## 🧪 Testing

### Test Connection

```bash
node test-mcp-connection.js
```

### Manual Verification

Use the verification script to check downloads:
```bash
node manual-verification-report-*.json
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (with hot reload)
npm run dev

# Run standalone automation
npm run auto-download
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - For the MCP specification
- [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) - Chrome DevTools Protocol client
- [Cursor IDE](https://cursor.sh/) - AI-powered code editor

## 📖 Additional Documentation

### Setup Guides
- **[Setup Instructions](SETUP_INSTRUCTIONS.md)** - **START HERE** - Complete guide to correctly set up Chrome and automation
- [Quick Start Automation](docs/QUICK_START_AUTOMATION.md) - Quick start guide for automation features
- [Automation Setup Guide](docs/AUTOMATION_SETUP.md) - Detailed setup instructions for automation

All documentation is organized in the [`docs/`](docs/) folder:

### Setup & Getting Started
- [Automation Setup Guide](docs/AUTOMATION_SETUP.md) - Detailed setup instructions
- [Quick Start Automation](docs/QUICK_START_AUTOMATION.md) - Quick start guide
- [Auto Download Usage](docs/AUTO_DOWNLOAD_USAGE.md) - Auto-download feature guide

### Guides
- [Browser Automation](docs/BROWSER_AUTOMATION.md) - Browser automation capabilities
- [Troubleshooting Guide](docs/troubleshoot-mcp.md) - Common issues and solutions

### Technical Documentation
- [Code Review](docs/MCP_CODE_REVIEW.md) - Detailed code review and architecture
- [Improvements Summary](docs/MCP_IMPROVEMENTS_SUMMARY.md) - Recent improvements
- [Fixed Outdated Fallback](docs/FIXED_OUTDATED_FALLBACK.md) - Outdated torrent fallback fix
- [Folder Structure](docs/FOLDER_STRUCTURE.md) - Project organization

### Scripts Documentation
- [Scripts Documentation](docs/scripts/README.md) - Scripts overview
- [Batch Download Usage](docs/scripts/BATCH_DOWNLOAD_USAGE.md) - Batch download guide

See [docs/README.md](docs/README.md) for complete documentation index.

## 🔗 Related Projects

- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

---

**Made with ❤️ for browser automation enthusiasts**

For questions or issues, please open a GitHub issue.

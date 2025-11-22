#!/usr/bin/env node
/**
 * Standalone Automated Torrent Downloader
 * 
 * This script runs independently and automatically processes ExHentai torrent tabs.
 * It connects directly to Chrome via Chrome DevTools Protocol (CDP) and doesn't
 * require any agent interaction.
 * 
 * Usage:
 *   node auto-download-standalone.js
 * 
 * Configuration:
 *   - Set CHECK_INTERVAL to control how often it checks for new tabs (default: 30 seconds)
 *   - Set MAX_CONCURRENT to process multiple tabs at once (default: 1)
 *   - Set CLOSE_ON_SUCCESS to auto-close tabs after download (default: true)
 * 
 * The script will:
 *   1. Monitor Chrome tabs continuously
 *   2. Find ExHentai torrent pages automatically
 *   3. Download newest torrent from each page
 *   4. Close tabs after successful download
 *   5. Generate reports in logs/ directory
 *   6. Continue running until stopped (Ctrl+C)
 */

import CDP from 'chrome-remote-interface';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== CONFIGURATION ==========
const CHECK_INTERVAL = 30000; // Check for new tabs every 30 seconds (in milliseconds)
const MAX_CONCURRENT = 1; // Process 1 tab at a time (increase for parallel processing)
const CLOSE_ON_SUCCESS = true; // Auto-close tabs after successful download
const MAX_RETRIES = 3; // Maximum retry attempts per download
const CHROME_PORT = 9222; // Chrome remote debugging port
const LOG_DIR = join(__dirname, 'logs'); // Directory for logs and reports
const SCRIPT_PATH = join(__dirname, 'scripts', 'download-newest-torrent-enhanced.js'); // Enhanced script path

// ========== STATE MANAGEMENT ==========
let processedTabs = new Set(); // Track processed tab URLs to avoid duplicates
let isRunning = true; // Control flag for graceful shutdown
let stats = {
  totalProcessed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  startTime: new Date().toISOString(),
  lastCheckTime: null,
};

// ========== HELPER FUNCTIONS ==========

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Log message with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = join(LOG_DIR, `auto-download-${new Date().toISOString().split('T')[0]}.log`);
  writeFileSync(logFile, logMessage + '\n', { flag: 'a' });
}

/**
 * Discover Chrome tabs via CDP
 */
async function discoverChromeTabs(port = CHROME_PORT) {
  try {
    const response = await fetch(`http://localhost:${port}/json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Cannot connect to Chrome on port ${port}. Make sure Chrome is running with --remote-debugging-port=${port}. Error: ${error.message}`);
  }
}

/**
 * Load the enhanced torrent script
 */
function loadTorrentScript() {
  try {
    return readFileSync(SCRIPT_PATH, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load script from ${SCRIPT_PATH}: ${error.message}`);
  }
}

/**
 * Process a single tab - find torrent and download it
 * Returns both pre-report (before download) and post-report (after download)
 */
async function processTab(tab, scriptContent) {
  let tabClient = null;
  const tabId = tab.id;
  const tabUrl = tab.url;
  const tabTitle = tab.title;
  
  log(`Processing tab: ${tabTitle}`);
  
  let preReport = null;
  let postReport = null;
  
  try {
    // Connect to the tab with timeout
    log(`  Connecting to tab ${tabId}...`);
    tabClient = await Promise.race([
      CDP({ port: CHROME_PORT, target: tabId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000))
    ]);
    
    log(`  Connected, enabling domains...`);
    await tabClient.Page.enable();
    await tabClient.Runtime.enable();
    
    // Wait for page to be ready (don't wait for load event if page already loaded)
    log(`  Checking if page is ready...`);
    const navigationPromise = tabClient.Page.loadEventFired().catch(() => {
      // Page might already be loaded, that's okay
      return Promise.resolve();
    });
    
    // Race between navigation event and a timeout
    await Promise.race([
      navigationPromise,
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    // Additional small delay to ensure page is interactive
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log(`  Page ready`);
    
    // Execute script to find and select torrent
    log(`  Executing torrent selection script...`);
    const scriptResult = await Promise.race([
      tabClient.Runtime.evaluate({
        expression: scriptContent,
        returnByValue: true,
        awaitPromise: true,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Script execution timeout after 15 seconds')), 15000))
    ]);

    if (scriptResult.exceptionDetails) {
      throw new Error(`Script error: ${scriptResult.exceptionDetails.text}`);
    }

    const result = scriptResult.result?.value;
    log(`  Script execution completed`);
    
    if (!result || !result.success || !result.downloadUrl) {
      throw new Error(result?.error || 'Failed to find torrent on page');
    }

    // Create PRE-DOWNLOAD REPORT (before download)
    preReport = {
      timestamp: new Date().toISOString(),
      pageUrl: tabUrl,
      pageTitle: tabTitle,
      status: 'ready',
      action: 'pre_download',
      hasOutdatedSection: result.report?.hasOutdatedSection || false,
      selectedTorrent: result.selectedTorrent || result.report?.selectedTorrent,
      newestTorrents: result.newestTorrents || result.report?.newestTorrents || [],
      outdatedTorrents: result.outdatedTorrents || result.report?.outdatedTorrents || [],
      totalNewestTorrents: result.totalNewestTorrents || result.report?.totalNewestTorrents || 0,
      totalOutdatedTorrents: result.totalOutdatedTorrents || result.report?.totalOutdatedTorrents || 0,
      downloadUrl: result.downloadUrl,
    };
    
    log(`  Found torrent: ${result.selectedTorrent?.postedDate} (Seeds: ${result.selectedTorrent?.seeds})`);
    
    // Navigate to download URL to trigger download
    log(`  Downloading: ${result.downloadUrl}`);
    let downloadSuccess = false;
    try {
      await tabClient.Page.navigate({ url: result.downloadUrl });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for download to start
      downloadSuccess = true;
    } catch (downloadError) {
      downloadSuccess = false;
      log(`  Download navigation failed: ${downloadError.message}`, 'ERROR');
    }
    
    // Close tab if enabled
    let tabClosed = false;
    if (CLOSE_ON_SUCCESS) {
      try {
        await fetch(`http://localhost:${CHROME_PORT}/json/close/${tabId}`, { method: 'POST' });
        tabClosed = true;
        log(`  Tab closed successfully`);
      } catch (closeError) {
        log(`  Warning: Failed to close tab: ${closeError.message}`, 'WARN');
      }
    }
    
    // Create POST-DOWNLOAD REPORT (after download)
    postReport = {
      ...preReport,
      action: 'post_download',
      downloadStatus: downloadSuccess ? 'success' : 'failed',
      downloadUrl: result.downloadUrl,
      tabClosed: tabClosed,
      timestamp: new Date().toISOString(),
      error: downloadSuccess ? undefined : 'Download navigation failed',
    };
    
    // Mark as processed
    if (downloadSuccess) {
      processedTabs.add(tabUrl);
      stats.totalProcessed++;
      stats.totalSucceeded++;
      log(`  ✓ Successfully processed tab: ${tabTitle}`);
    } else {
      stats.totalProcessed++;
      stats.totalFailed++;
      log(`  ✗ Download failed for tab: ${tabTitle}`, 'ERROR');
    }
    
    return {
      success: downloadSuccess,
      tab: { id: tabId, url: tabUrl, title: tabTitle },
      selectedTorrent: result.selectedTorrent,
      downloadUrl: result.downloadUrl,
      tabClosed,
      preReport,
      postReport,
      timestamp: new Date().toISOString(),
      error: downloadSuccess ? undefined : 'Download navigation failed',
    };
    
  } catch (error) {
    stats.totalProcessed++;
    stats.totalFailed++;
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log(`  ✗ Failed to process tab: ${errorMsg}`, 'ERROR');
    if (errorStack) {
      log(`  Error stack: ${errorStack}`, 'ERROR');
    }
    
    // Create error reports even if processing failed
    if (!preReport) {
      preReport = {
        timestamp: new Date().toISOString(),
        pageUrl: tabUrl,
        pageTitle: tabTitle,
        status: 'error',
        action: 'pre_download',
        error: errorMsg,
      };
    }
    
    postReport = {
      ...preReport,
      action: 'post_download',
      downloadStatus: 'failed',
      error: errorMsg,
      errorStack: errorStack,
      timestamp: new Date().toISOString(),
      tabClosed: false,
    };
    
    // Don't mark failed tabs as processed - allow retry
    // processedTabs.add(tabUrl); // Commented out to allow retry
    
    return {
      success: false,
      tab: { id: tabId, url: tabUrl, title: tabTitle },
      error: errorMsg,
      preReport,
      postReport,
      timestamp: new Date().toISOString(),
      needsManualRetry: true, // Flag for manual retry
    };
    
  } finally {
    if (tabClient) {
      try {
        await tabClient.close().catch(() => {});
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Process multiple tabs in sequence (or parallel if MAX_CONCURRENT > 1)
 */
async function processTabs(tabs, scriptContent) {
  const torrentTabs = tabs.filter((tab) => 
    tab.url && tab.url.includes('gallerytorrents.php')
  );
  
  // Filter out already processed tabs
  const newTabs = torrentTabs.filter((tab) => !processedTabs.has(tab.url));
  
  if (newTabs.length === 0) {
    return [];
  }
  
  log(`Found ${newTabs.length} new torrent tab(s) to process`);
  
  const results = [];
  
  // Process tabs sequentially for now (can be parallelized)
  for (const tab of newTabs) {
    if (!isRunning) break; // Stop if shutdown requested
    
    const result = await processTab(tab, scriptContent);
    results.push(result);
    
    // Small delay between tabs
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Save before report (pre-download)
 */
function saveBeforeReport(results) {
  if (results.length === 0) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = join(LOG_DIR, `batch-report-before-${timestamp}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    status: 'pre_download',
    totalTabs: results.length,
    action: 'before_download',
    items: results.map(r => ({
      tab: r.tab,
      preReport: r.preReport,
      downloadUrl: r.downloadUrl || r.preReport?.downloadUrl,
      selectedTorrent: r.selectedTorrent || r.preReport?.selectedTorrent,
    })),
  };
  
  writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
  log(`Saved BEFORE report: ${reportFile}`);
  return reportFile;
}

/**
 * Save after report (post-download) with manual retry information
 */
function saveAfterReport(results) {
  if (results.length === 0) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = join(LOG_DIR, `batch-report-after-${timestamp}.json`);
  
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const report = {
    timestamp: new Date().toISOString(),
    status: 'post_download',
    totalTabs: results.length,
    processed: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    retries: 0,
    tabsClosed: results.filter(r => r.tabClosed).length,
    stats: {
      ...stats,
      lastCheckTime: new Date().toISOString(),
    },
    items: results.map(r => ({
      tab: r.tab,
      success: r.success,
      selectedTorrent: r.selectedTorrent || r.preReport?.selectedTorrent,
      downloadUrl: r.downloadUrl || r.preReport?.downloadUrl,
      retryCount: r.retryCount || 0,
      tabClosed: r.tabClosed || false,
      preReport: r.preReport,
      postReport: r.postReport,
      error: r.error,
      needsManualRetry: r.needsManualRetry || !r.success, // Flag failed items
    })),
    // Manual retry section - list of failed downloads for manual retry
    manualRetry: failed.length > 0 ? {
      count: failed.length,
      items: failed.map(r => ({
        tab: r.tab,
        downloadUrl: r.downloadUrl || r.preReport?.downloadUrl,
        selectedTorrent: r.selectedTorrent || r.preReport?.selectedTorrent,
        error: r.error,
        preReport: r.preReport,
        postReport: r.postReport,
        instructions: `Manually download from: ${r.downloadUrl || r.preReport?.downloadUrl || r.tab.url}`,
      })),
      instructions: `These ${failed.length} download(s) failed and need manual retry. Use the downloadUrl in each item to manually download.`,
    } : null,
  };
  
  writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
  log(`Saved AFTER report: ${reportFile}`);
  
  if (failed.length > 0) {
    log(`⚠️  ${failed.length} download(s) failed - see manual retry section in report`, 'WARN');
  }
  
  return reportFile;
}

/**
 * Save summary statistics
 */
function saveStats() {
  const statsFile = join(LOG_DIR, 'stats.json');
  const statsData = {
    ...stats,
    lastUpdateTime: new Date().toISOString(),
    processedUrls: Array.from(processedTabs),
  };
  writeFileSync(statsFile, JSON.stringify(statsData, null, 2), 'utf-8');
}

/**
 * Main loop - continuously monitor and process tabs
 */
async function mainLoop() {
  log('='.repeat(60));
  log('Starting Automated Torrent Downloader');
  log(`Configuration: CHECK_INTERVAL=${CHECK_INTERVAL}ms, MAX_CONCURRENT=${MAX_CONCURRENT}, CLOSE_ON_SUCCESS=${CLOSE_ON_SUCCESS}`);
  log('='.repeat(60));
  
  // Load script once
  const scriptContent = loadTorrentScript();
  log('Loaded enhanced torrent script');
  
  while (isRunning) {
    try {
      stats.lastCheckTime = new Date().toISOString();
      
      // Discover tabs
      const tabs = await discoverChromeTabs();
      
      // Process new tabs
      const results = await processTabs(tabs, scriptContent);
      
      // Save reports if there are results
      if (results.length > 0) {
        // Save BEFORE report (pre-download state)
        const beforeReportFile = saveBeforeReport(results);
        
        // Save AFTER report (post-download results with manual retry info)
        const afterReportFile = saveAfterReport(results);
        
        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        log(`Batch complete: ${succeeded}/${results.length} succeeded, ${failed} failed`);
        
        // Log failed items with manual retry instructions
        if (failed.length > 0) {
          log(`⚠️  Failed downloads (need manual retry):`, 'WARN');
          failed.forEach(r => {
            const downloadUrl = r.downloadUrl || r.preReport?.downloadUrl || r.tab.url;
            log(`  - ${r.tab.title}`, 'WARN');
            log(`    Error: ${r.error}`, 'WARN');
            log(`    Manual download URL: ${downloadUrl}`, 'WARN');
          });
          log(`  See report for full details: ${afterReportFile}`, 'WARN');
        }
      } else {
        log(`No new tabs found (processed: ${stats.totalProcessed}, succeeded: ${stats.totalSucceeded}, failed: ${stats.totalFailed})`);
      }
      
      // Save stats periodically
      saveStats();
      
      // Wait before next check
      if (isRunning) {
        log(`Waiting ${CHECK_INTERVAL / 1000} seconds before next check...`);
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, CHECK_INTERVAL);
          // Clear timeout if shutdown requested
          process.once('SIGINT', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
    } catch (error) {
      log(`Error in main loop: ${error.message}`, 'ERROR');
      log(`Will retry in ${CHECK_INTERVAL / 1000} seconds...`);
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
    }
  }
  
  log('Shutting down...');
  saveStats();
  log(`Final stats: Processed: ${stats.totalProcessed}, Succeeded: ${stats.totalSucceeded}, Failed: ${stats.totalFailed}`);
  process.exit(0);
}

/**
 * Graceful shutdown handler
 */
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  isRunning = false;
});

// ========== STARTUP ==========
ensureLogDir();
log('Initializing...');

// Verify Chrome connection
discoverChromeTabs().then(() => {
  log('✓ Chrome connection verified');
  log('Starting main loop...\n');
  mainLoop().catch((error) => {
    log(`Fatal error: ${error.message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  });
}).catch((error) => {
  log(`Failed to connect to Chrome: ${error.message}`, 'ERROR');
  log('Make sure Chrome is running with --remote-debugging-port=9222');
  process.exit(1);
});


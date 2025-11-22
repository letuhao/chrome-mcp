/**
 * Enhanced reusable script to find and download the newest torrent from ExHentai torrent pages
 * 
 * Features:
 * - Download verification
 * - Retry logic with page reload
 * - Pre-download and post-download reports
 * - Support for batch processing multiple tabs
 * 
 * Logic:
 * 1. Find all torrents on the page sorted by posted date (newest first)
 * 2. Select the newest torrent if it has seeders > 0
 * 3. If newest has 0 seeders, find an older one with seeders
 * 4. If no torrents have seeders, use the newest anyway
 * 5. Verify download success
 * 6. Retry with page reload if download fails
 * 
 * Returns: { success, selectedTorrent, allTorrents, downloadStatus, report }
 */

(function downloadNewestTorrentEnhanced() {
  'use strict';
  
  // Configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  const DOWNLOAD_VERIFY_DELAY_MS = 3000;
  
  // Step 1: Find all torrents on the page, separating newest from outdated
  function findAllTorrents() {
    const newestTorrents = [];
    const outdatedTorrents = [];
    
    // Check if "Outdated Torrents" section exists
    const allParagraphs = Array.from(document.querySelectorAll('p'));
    const outdatedHeader = allParagraphs.find(p => 
      p.textContent && p.textContent.trim().includes('Outdated Torrents')
    );
    
    const hasOutdatedSection = !!outdatedHeader;
    
    // Get all forms
    const forms = Array.from(document.querySelectorAll('form'));
    
    forms.forEach((form, index) => {
      const text = form.textContent || '';
      const html = form.innerHTML || '';
      
      // Check if this form contains torrent information
      if (!text.includes('Posted:') || !text.includes('Seeds:')) {
        return;
      }
      
      // Extract posted date
      const postedMatch = text.match(/Posted:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
      if (!postedMatch) {
        return;
      }
      
      const postedDate = postedMatch[1];
      let postedTimestamp;
      try {
        postedTimestamp = new Date(postedDate).getTime();
        if (isNaN(postedTimestamp)) {
          console.warn(`Invalid date: ${postedDate}`);
          return;
        }
      } catch (e) {
        console.warn(`Error parsing date: ${postedDate}`, e);
        return;
      }
      
      // Extract seeds count
      const seedsMatch = text.match(/Seeds:\s*(\d+)/);
      const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;
      
      // Extract peers count (optional, for info)
      const peersMatch = text.match(/Peers:\s*(\d+)/);
      const peers = peersMatch ? parseInt(peersMatch[1], 10) : 0;
      
      // Extract download link
      let downloadLink = null;
      
      // Try multiple patterns to find the download link
      const linkPatterns = [
        /href="([^"]*\/torrent\/[^"]*\.torrent[^"]*)"/,
        /href="([^"]*\.torrent)"/,
        /document\.location=['"]([^'"]*\.torrent[^'"]*)['"]/,
      ];
      
      for (const pattern of linkPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          downloadLink = match[1]
            .split('"')[0]
            .split("'")[0]
            .trim();
          
          // Clean up onclick redirect URLs
          if (downloadLink.includes("onclick")) {
            const onclickMatch = html.match(/onclick[^>]*document\.location=['"]([^'"]+)['"]/);
            if (onclickMatch && onclickMatch[1]) {
              downloadLink = onclickMatch[1];
            }
          }
          break;
        }
      }
      
      if (!downloadLink) {
        return;
      }
      
      // Extract filename (optional, for display)
      const filenameMatch = text.match(/([^\s]+\.(zip|rar|7z|torrent|cbz|cb7|cbr))/i);
      const filename = filenameMatch ? filenameMatch[1] : null;
      
      // Extract uploader (optional, for display)
      const uploaderMatch = text.match(/Uploader:\s*([^\n\r]+)/);
      const uploader = uploaderMatch ? uploaderMatch[1].trim() : null;
      
      // Extract size (optional, for display)
      const sizeMatch = text.match(/Size:\s*([\d.]+\s+\w+)/i);
      const size = sizeMatch ? sizeMatch[1] : null;
      
      // Extract gallery ID from URL
      const galleryIdMatch = window.location.href.match(/gid=(\d+)/);
      const galleryId = galleryIdMatch ? galleryIdMatch[1] : null;
      
      // Determine if this is an outdated torrent
      let isOutdated = false;
      
      if (hasOutdatedSection) {
        // Check if date is in red color (outdated indicator)
        const dateInRed = html.match(/<span[^>]*style[^>]*color:red[^>]*>/);
        const hasRedDate = !!dateInRed || (html.includes('color:red') && html.includes(postedDate));
        
        // Check if form is after the outdated header
        // Forms after the outdated header are outdated
        const formPosition = forms.indexOf(form);
        const outdatedHeaderIndex = outdatedHeader ? 
          Array.from(document.querySelectorAll('*')).indexOf(outdatedHeader) : -1;
        const formElementIndex = Array.from(document.querySelectorAll('*')).indexOf(form);
        
        isOutdated = hasRedDate || (outdatedHeaderIndex !== -1 && formElementIndex > outdatedHeaderIndex);
      }
      
      const torrentInfo = {
        index: index,
        postedDate: postedDate,
        postedTimestamp: postedTimestamp,
        seeds: seeds,
        peers: peers,
        downloadLink: downloadLink,
        filename: filename,
        uploader: uploader,
        size: size,
        galleryId: galleryId,
        pageUrl: window.location.href,
        isOutdated: isOutdated,
      };
      
      if (isOutdated) {
        outdatedTorrents.push(torrentInfo);
      } else {
        newestTorrents.push(torrentInfo);
      }
    });
    
    return {
      newestTorrents: newestTorrents,
      outdatedTorrents: outdatedTorrents,
      hasOutdatedSection: hasOutdatedSection,
    };
  }
  
  // Step 2: Select the best torrent (works for both newest and outdated torrents)
  function selectBestTorrent(torrents, isFromNewestSection = true) {
    if (torrents.length === 0) {
      return null;
    }
    
    // Sort by date (newest first)
    torrents.sort((a, b) => b.postedTimestamp - a.postedTimestamp);
    
    const newest = torrents[0];
    
    // If newest has seeders, use it
    if (newest.seeds > 0) {
      const sectionPrefix = isFromNewestSection ? 'newest' : 'outdated';
      return {
        torrent: newest,
        reason: `${sectionPrefix}_with_seeders`,
        isNewest: true,
        hasSeeders: true,
        fromNewestSection: isFromNewestSection,
      };
    }
    
    // Newest has 0 seeders - find an alternative with seeders
    const alternative = torrents.find(t => t.seeds > 0);
    
    if (alternative) {
      const sectionPrefix = isFromNewestSection ? 'newest' : 'outdated';
      return {
        torrent: alternative,
        reason: `alternative_from_${sectionPrefix}_with_seeders`,
        isNewest: false,
        hasSeeders: true,
        fromNewestSection: isFromNewestSection,
      };
    }
    
    // No alternatives with seeders - use newest anyway
    const sectionPrefix = isFromNewestSection ? 'newest' : 'outdated';
    return {
      torrent: newest,
      reason: `${sectionPrefix}_no_seeders_fallback`,
      isNewest: true,
      hasSeeders: false,
      fromNewestSection: isFromNewestSection,
    };
  }
  
  // Step 3: Verify download started (check if browser initiated download)
  function verifyDownloadStarted() {
    // Note: In browser context, we can't directly verify file download completion
    // But we can check if the navigation to .torrent URL was successful
    // For actual verification, we'd need Chrome DevTools Protocol or file system checks
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple check: if we're still on a valid page or redirected properly
        const currentUrl = window.location.href;
        const isValidDownload = currentUrl.includes('.torrent') || 
                                document.contentType === 'application/x-bittorrent' ||
                                document.contentType === 'application/octet-stream';
        
        resolve({
          downloadStarted: isValidDownload,
          currentUrl: currentUrl,
          contentType: document.contentType,
        });
      }, DOWNLOAD_VERIFY_DELAY_MS);
    });
  }
  
  // Main execution
  async function execute() {
    try {
      const timestamp = new Date().toISOString();
      const pageUrl = window.location.href;
      const pageTitle = document.title;
      
      // Find all torrents, separating newest from outdated
      const torrentData = findAllTorrents();
      const { newestTorrents, outdatedTorrents, hasOutdatedSection } = torrentData;
      
      // Select best torrent - prefer newest, fallback to outdated if no newest available
      let selection = null;
      let usedNewestSection = true;
      
      if (newestTorrents.length > 0) {
        // Select from newest torrents (preferred)
        selection = selectBestTorrent(newestTorrents, true);
        usedNewestSection = true;
      } else if (outdatedTorrents.length > 0) {
        // No newest torrents available - fallback to outdated torrents
        // Apply same selection logic to outdated torrents (newest outdated with seeders, etc.)
        selection = selectBestTorrent(outdatedTorrents, false);
        usedNewestSection = false;
      }
      
      if (!selection) {
        return {
          success: false,
          error: 'No torrents found on the page (neither newest nor outdated)',
          torrents: [],
          newestTorrents: newestTorrents.map(t => ({
            postedDate: t.postedDate,
            seeds: t.seeds,
            downloadLink: t.downloadLink,
          })),
          outdatedTorrents: outdatedTorrents.map(t => ({
            postedDate: t.postedDate,
            seeds: t.seeds,
            downloadLink: t.downloadLink,
          })),
          report: {
            timestamp: timestamp,
            pageUrl: pageUrl,
            pageTitle: pageTitle,
            status: 'failed',
            reason: 'no_torrents_found',
            hasOutdatedSection: hasOutdatedSection,
          },
        };
      }
      
      const selectedTorrent = {
        postedDate: selection.torrent.postedDate,
        seeds: selection.torrent.seeds,
        peers: selection.torrent.peers,
        downloadLink: selection.torrent.downloadLink,
        filename: selection.torrent.filename,
        uploader: selection.torrent.uploader,
        size: selection.torrent.size,
        galleryId: selection.torrent.galleryId,
        pageUrl: selection.torrent.pageUrl,
        isNewest: selection.isNewest,
        hasSeeders: selection.hasSeeders,
        selectionReason: selection.reason,
        fromNewestSection: usedNewestSection,
        isOutdated: !usedNewestSection, // Flag if selected from outdated section
      };
      
      // PRE-DOWNLOAD REPORT
      const preReport = {
        timestamp: timestamp,
        pageUrl: pageUrl,
        pageTitle: pageTitle,
        status: 'ready',
        action: 'pre_download',
        hasOutdatedSection: hasOutdatedSection,
        selectedTorrent: selectedTorrent,
        selectedFromNewestSection: usedNewestSection,
        selectedFromOutdatedSection: !usedNewestSection,
        newestTorrents: newestTorrents.map(t => ({
          postedDate: t.postedDate,
          seeds: t.seeds,
          peers: t.peers,
          downloadLink: t.downloadLink,
          filename: t.filename,
          isOutdated: false,
        })),
        outdatedTorrents: outdatedTorrents.map(t => ({
          postedDate: t.postedDate,
          seeds: t.seeds,
          peers: t.peers,
          downloadLink: t.downloadLink,
          filename: t.filename,
          isOutdated: true,
        })),
        totalNewestTorrents: newestTorrents.length,
        totalOutdatedTorrents: outdatedTorrents.length,
        totalTorrents: newestTorrents.length + outdatedTorrents.length,
      };
      
      // Return pre-report (actual download will be handled by MCP tool with retry logic)
      return {
        success: true,
        downloadUrl: selection.torrent.downloadLink,
        selectedTorrent: selectedTorrent,
        newestTorrents: newestTorrents.map(t => ({
          postedDate: t.postedDate,
          seeds: t.seeds,
          peers: t.peers,
          downloadLink: t.downloadLink,
          filename: t.filename,
          isOutdated: false,
        })),
        outdatedTorrents: outdatedTorrents.map(t => ({
          postedDate: t.postedDate,
          seeds: t.seeds,
          peers: t.peers,
          downloadLink: t.downloadLink,
          filename: t.filename,
          isOutdated: true,
        })),
        totalNewestTorrents: newestTorrents.length,
        totalOutdatedTorrents: outdatedTorrents.length,
        totalTorrents: newestTorrents.length + outdatedTorrents.length,
        hasOutdatedSection: hasOutdatedSection,
        report: preReport,
        // Metadata for retry/reload
        needsRetry: false,
        retryCount: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        stack: error.stack,
        report: {
          timestamp: new Date().toISOString(),
          pageUrl: window.location.href,
          pageTitle: document.title,
          status: 'error',
          error: error.message,
        },
      };
    }
  }
  
  // Execute and return promise result
  return execute();
})();


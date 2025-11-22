/**
 * Reusable script to find and download the newest torrent from ExHentai torrent pages
 * 
 * Logic:
 * 1. Find all torrents on the page sorted by posted date (newest first)
 * 2. Select the newest torrent if it has seeders > 0
 * 3. If newest has 0 seeders, find the oldest torrent that has seeders
 * 4. If no torrents have seeders, use the newest anyway
 * 
 * Returns: { downloadUrl, selectedTorrent, allTorrents }
 */

(function downloadNewestTorrent() {
  'use strict';
  
  // Step 1: Find all torrents on the page
  function findAllTorrents() {
    const torrents = [];
    const forms = document.querySelectorAll('form');
    
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
      
      torrents.push({
        index: index,
        postedDate: postedDate,
        postedTimestamp: postedTimestamp,
        seeds: seeds,
        peers: peers,
        downloadLink: downloadLink,
        filename: filename,
        uploader: uploader,
        size: size,
      });
    });
    
    return torrents;
  }
  
  // Step 2: Select the best torrent based on criteria
  function selectBestTorrent(torrents) {
    if (torrents.length === 0) {
      return null;
    }
    
    // Sort by date (newest first)
    torrents.sort((a, b) => b.postedTimestamp - a.postedTimestamp);
    
    const newest = torrents[0];
    
    // If newest has seeders, use it
    if (newest.seeds > 0) {
      return {
        torrent: newest,
        reason: 'newest_with_seeders',
        isNewest: true,
        hasSeeders: true,
      };
    }
    
    // Newest has 0 seeders - find an older one with seeders
    const alternative = torrents.find(t => t.seeds > 0);
    
    if (alternative) {
      return {
        torrent: alternative,
        reason: 'alternative_with_seeders',
        isNewest: false,
        hasSeeders: true,
      };
    }
    
    // No alternatives with seeders - use newest anyway
    return {
      torrent: newest,
      reason: 'newest_no_seeders_fallback',
      isNewest: true,
      hasSeeders: false,
    };
  }
  
  // Main execution
  try {
    const allTorrents = findAllTorrents();
    
    if (allTorrents.length === 0) {
      return {
        success: false,
        error: 'No torrents found on the page',
        torrents: [],
      };
    }
    
    const selection = selectBestTorrent(allTorrents);
    
    if (!selection) {
      return {
        success: false,
        error: 'Failed to select torrent',
        torrents: allTorrents.map(t => ({
          postedDate: t.postedDate,
          seeds: t.seeds,
          downloadLink: t.downloadLink,
        })),
      };
    }
    
    // Return result without navigating (let the caller handle download)
    return {
      success: true,
      downloadUrl: selection.torrent.downloadLink,
      selectedTorrent: {
        postedDate: selection.torrent.postedDate,
        seeds: selection.torrent.seeds,
        peers: selection.torrent.peers,
        downloadLink: selection.torrent.downloadLink,
        filename: selection.torrent.filename,
        uploader: selection.torrent.uploader,
        size: selection.torrent.size,
        isNewest: selection.isNewest,
        hasSeeders: selection.hasSeeders,
        selectionReason: selection.reason,
      },
      allTorrents: allTorrents.map(t => ({
        postedDate: t.postedDate,
        seeds: t.seeds,
        peers: t.peers,
        downloadLink: t.downloadLink,
        filename: t.filename,
      })),
      totalTorrents: allTorrents.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      stack: error.stack,
    };
  }
})();


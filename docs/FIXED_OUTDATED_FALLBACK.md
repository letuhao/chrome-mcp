# Fixed: Outdated Torrent Fallback

## Problem
When a tab only has outdated torrents (no newest torrents), the script was failing with "No newest torrents found on the page".

## Solution
Updated the script to fall back to outdated torrents when no newest torrents are available, using the same selection logic.

## Behavior

### Priority Order:
1. **Newest torrents** (if available)
   - Select newest with seeders
   - If newest has 0 seeders, find alternative with seeders from newest
   - If no seeders in newest, use newest anyway

2. **Outdated torrents** (fallback if no newest available)
   - Select newest outdated with seeders
   - If newest outdated has 0 seeders, find alternative outdated with seeders
   - If no seeders in outdated, use newest outdated anyway

### Selection Reasons:
- `newest_with_seeders` - Newest torrent with seeders
- `outdated_with_seeders` - Newest outdated torrent with seeders (fallback)
- `alternative_from_newest_with_seeders` - Alternative from newest section
- `alternative_from_outdated_with_seeders` - Alternative from outdated section
- `newest_no_seeders_fallback` - Newest torrent without seeders
- `outdated_no_seeders_fallback` - Newest outdated torrent without seeders

## Reports

Both before and after reports now include:
- `selectedFromNewestSection` - true if selected from newest
- `selectedFromOutdatedSection` - true if selected from outdated
- `isOutdated` - flag in selectedTorrent indicating outdated status

## Example

**Tab with only outdated torrents:**
- Before: Script failed with "No newest torrents found"
- After: Script selects newest outdated torrent with seeders (or applies same logic)

This ensures all tabs can be processed automatically, not just those with newest torrents.


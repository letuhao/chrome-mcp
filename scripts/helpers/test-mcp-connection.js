#!/usr/bin/env node
/**
 * Test script to verify MCP server and Chrome connection
 */

console.log('Testing MCP Server Connection...\n');

// Test 1: Check if Chrome remote debugging is accessible
console.log('1. Testing Chrome Remote Debugging (port 9222)...');
try {
  const response = await fetch('http://localhost:9222/json');
  if (!response.ok) {
    console.log('   ✗ Chrome remote debugging NOT accessible');
    console.log('   Error: HTTP', response.status);
  } else {
    const tabs = await response.json();
    console.log('   ✓ Chrome remote debugging is accessible');
    console.log('   Found', tabs.length, 'tabs');
    if (tabs.length > 0) {
      console.log('   Sample tab:', tabs[0].title?.substring(0, 50) || 'N/A');
    }
  }
} catch (error) {
  console.log('   ✗ Cannot connect to Chrome');
  console.log('   Error:', error.message);
  console.log('   Make sure Chrome is running with: --remote-debugging-port=9222');
}

// Test 2: Check if MCP server module loads
console.log('\n2. Testing MCP Server Module...');
try {
  const serverModule = await import('./dist/index.js');
  console.log('   ✓ MCP server module loads successfully');
} catch (error) {
  console.log('   ✗ MCP server module failed to load');
  console.log('   Error:', error.message);
  console.log('   Try running: npm run build');
}

// Test 3: Check if dist/index.js exists
console.log('\n3. Checking compiled files...');
import { existsSync } from 'fs';
if (existsSync('./dist/index.js')) {
  console.log('   ✓ dist/index.js exists');
} else {
  console.log('   ✗ dist/index.js does not exist');
  console.log('   Run: npm run build');
}

console.log('\n=== Summary ===');
console.log('If all tests pass, the issue is likely with Cursor\'s MCP connection.');
console.log('Try restarting Cursor or toggling the MCP server off/on in settings.');


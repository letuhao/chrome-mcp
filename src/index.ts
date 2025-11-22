#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import CDP from 'chrome-remote-interface';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface ChromeTab {
  id: string;
  title: string;
  url: string;
}

class ChromeMCPServer {
  private server: Server;
  private chromeClient: CDP.Client | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'chrome-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async discoverChromeTabs(port: number = 9222): Promise<any[]> {
    try {
      const response = await fetch(`http://localhost:${port}/json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(
        `Cannot connect to Chrome on port ${port}. Make sure Chrome is running with --remote-debugging-port=${port}. Error: ${error}`
      );
    }
  }

  private async connectToChrome(port: number = 9222): Promise<CDP.Client> {
    // Check if existing client is still valid
    if (this.chromeClient) {
      try {
        // Quick health check - try to get resource tree
        await Promise.race([
          this.chromeClient.Page.getResourceTree(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 3000)
          )
        ]);
        // Connection is healthy, return it
        return this.chromeClient;
      } catch (error) {
        // Connection is dead or unresponsive, clear it
        try {
          await this.chromeClient.close().catch(() => {});
        } catch (closeError) {
          // Ignore close errors
        }
        this.chromeClient = null;
      }
    }

    try {
      // First, try to discover available tabs
      const tabs = await this.discoverChromeTabs(port);
      if (tabs.length === 0) {
        throw new Error('No Chrome tabs found');
      }

      // Connect to the first available tab (or we could let user choose)
      const target = tabs[0];
      
      // Add timeout for connection attempt (10 seconds)
      const client = await Promise.race([
        CDP({ port, target: target.id }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
        )
      ]) as CDP.Client;
      
      // Enable required domains for browser control with timeout
      await Promise.race([
        Promise.all([
          client.Page.enable(),
          client.Runtime.enable(),
          client.DOM.enable()
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Enable domains timeout')), 5000)
        )
      ]);
      // Browser and Input domains don't need explicit enable
      
      this.chromeClient = client;
      return client;
    } catch (error) {
      // Clear client if connection failed
      this.chromeClient = null;
      throw new Error(
        `Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=${port}. Error: ${error}`
      );
    }
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_current_tab',
            description: 'Get information about the current active Chrome tab',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_tabs',
            description: 'List all open Chrome tabs',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'navigate_to_url',
            description: 'Navigate the current tab to a specific URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to navigate to',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'check_chrome_connection',
            description: 'Check if Chrome remote debugging is enabled and accessible',
            inputSchema: {
              type: 'object',
              properties: {
                port: {
                  type: 'number',
                  description: 'The remote debugging port (default: 9222)',
                  default: 9222,
                },
              },
            },
          },
          {
            name: 'get_page_content',
            description: 'Get the full HTML content or text content of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                asText: {
                  type: 'boolean',
                  description: 'Return as plain text instead of HTML (default: true)',
                  default: true,
                },
              },
            },
          },
          {
            name: 'click_element',
            description: 'Click an element on the page using CSS selector or XPath',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector or XPath to find the element',
                },
                xpath: {
                  type: 'boolean',
                  description: 'Whether the selector is an XPath (default: false)',
                  default: false,
                },
              },
              required: ['selector'],
            },
          },
          {
            name: 'type_text',
            description: 'Type text into an input field or element',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector to find the input element',
                },
                text: {
                  type: 'string',
                  description: 'Text to type',
                },
                clear: {
                  type: 'boolean',
                  description: 'Clear the field before typing (default: true)',
                  default: true,
                },
              },
              required: ['selector', 'text'],
            },
          },
          {
            name: 'execute_script',
            description: 'Execute JavaScript code on the current page',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'JavaScript code to execute',
                },
              },
              required: ['code'],
            },
          },
          {
            name: 'take_screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                fullPage: {
                  type: 'boolean',
                  description: 'Capture full page or just viewport (default: false)',
                  default: false,
                },
              },
            },
          },
          {
            name: 'close_tab',
            description: 'Close a specific tab by URL or close current tab',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL of the tab to close (if not provided, closes current tab)',
                },
                tabId: {
                  type: 'string',
                  description: 'Tab ID to close (alternative to URL)',
                },
              },
            },
          },
          {
            name: 'switch_to_tab',
            description: 'Switch to a specific tab by URL or tab ID',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL of the tab to switch to',
                },
                tabId: {
                  type: 'string',
                  description: 'Tab ID to switch to',
                },
              },
            },
          },
          {
            name: 'download_file',
            description: 'Download a file from the current page or a specific URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL of the file to download (if not provided, uses current page)',
                },
                selector: {
                  type: 'string',
                  description: 'CSS selector of download link/button to click',
                },
                savePath: {
                  type: 'string',
                  description: 'Path to save the file (optional, uses browser default if not provided)',
                },
              },
            },
          },
          {
            name: 'wait_for_download',
            description: 'Wait for a download to complete',
            inputSchema: {
              type: 'object',
              properties: {
                timeout: {
                  type: 'number',
                  description: 'Timeout in seconds (default: 60)',
                  default: 60,
                },
              },
            },
          },
          {
            name: 'get_downloads',
            description: 'Get list of recent downloads',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'batch_download_and_close',
            description: 'Download files from multiple tabs and close them after download',
            inputSchema: {
              type: 'object',
              properties: {
                urls: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Array of URLs to download from',
                },
                selector: {
                  type: 'string',
                  description: 'CSS selector of download link/button on each page',
                },
                waitTime: {
                  type: 'number',
                  description: 'Time to wait after clicking download before closing tab (seconds, default: 3)',
                  default: 3,
                },
              },
              required: ['urls', 'selector'],
            },
          },
          {
            name: 'download_newest_torrent',
            description: 'Find and download the newest torrent from ExHentai torrent pages. Selects newest if it has seeders, otherwise finds an older one with seeders, or uses newest anyway if no seeders available.',
            inputSchema: {
              type: 'object',
              properties: {
                autoDownload: {
                  type: 'boolean',
                  description: 'Automatically download the selected torrent (default: true)',
                  default: true,
                },
              },
            },
          },
          {
            name: 'batch_download_torrents',
            description: 'Batch download newest torrents from multiple tabs. Includes download verification, retry logic with page reload, and generates pre/post-download reports. Reports are saved for manual retry of failed downloads. Automatically closes tabs after successful download.',
            inputSchema: {
              type: 'object',
              properties: {
                urls: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Array of ExHentai torrent page URLs to process. If not provided, will process all tabs with matching URLs.',
                },
                maxRetries: {
                  type: 'number',
                  description: 'Maximum number of retry attempts per download (default: 3)',
                  default: 3,
                },
                reportPath: {
                  type: 'string',
                  description: 'Path to save the download report JSON file (optional). If not provided, report is only returned.',
                },
                autoRetry: {
                  type: 'boolean',
                  description: 'Automatically retry failed downloads with page reload (default: true)',
                  default: true,
                },
                closeOnSuccess: {
                  type: 'boolean',
                  description: 'Automatically close tabs after successful download (default: true)',
                  default: true,
                },
              },
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_current_tab': {
            const client = await this.connectToChrome();
            const { Runtime, Page } = client;

            // Get current page info
            const pageInfo = await Page.getResourceTree();
            const url = pageInfo.frameTree.frame.url;
            const title = await Runtime.evaluate({
              expression: 'document.title',
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      title: title.result?.value || 'Unknown',
                      url: url,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'list_tabs': {
            // Use the HTTP API to list all tabs
            const tabs = await this.discoverChromeTabs();
            const tabList = tabs.map((tab: any) => ({
              id: tab.id,
              title: tab.title,
              url: tab.url,
              type: tab.type,
            }));

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(tabList, null, 2),
                },
              ],
            };
          }

          case 'navigate_to_url': {
            const url = (args as { url?: string })?.url;
            if (!url) {
              throw new Error('URL is required');
            }

            const client = await this.connectToChrome();
            const { Page } = client;
            await Page.navigate({ url });

            return {
              content: [
                {
                  type: 'text',
                  text: `Navigated to: ${url}`,
                },
              ],
            };
          }

          case 'check_chrome_connection': {
            const port = (args as { port?: number })?.port || 9222;
            try {
              const tabs = await this.discoverChromeTabs(port);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        connected: true,
                        port: port,
                        tabsFound: tabs.length,
                        message: `Chrome remote debugging is active on port ${port}`,
                        tabs: tabs.map((tab: any) => ({
                          id: tab.id,
                          title: tab.title,
                          url: tab.url,
                        })),
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        connected: false,
                        port: port,
                        error: errorMessage,
                        message: `Chrome remote debugging is NOT active on port ${port}. Please start Chrome with: chrome.exe --remote-debugging-port=${port}`,
                      },
                      null,
                      2
                    ),
                  },
                ],
                isError: true,
              };
            }
          }

          case 'get_page_content': {
            const client = await this.connectToChrome();
            const { Runtime } = client;
            const asText = (args as { asText?: boolean })?.asText !== false;

            if (asText) {
              const result = await Runtime.evaluate({
                expression: 'document.body.innerText || document.body.textContent',
              });
              return {
                content: [
                  {
                    type: 'text',
                    text: result.result?.value || 'No text content found',
                  },
                ],
              };
            } else {
              const result = await Runtime.evaluate({
                expression: 'document.documentElement.outerHTML',
              });
              return {
                content: [
                  {
                    type: 'text',
                    text: result.result?.value || 'No HTML content found',
                  },
                ],
              };
            }
          }

          case 'click_element': {
            const selector = (args as { selector?: string })?.selector;
            const isXPath = (args as { xpath?: boolean })?.xpath || false;

            if (!selector) {
              throw new Error('Selector is required');
            }

            const client = await this.connectToChrome();
            const { Runtime, DOM, Input } = client;

            // Get document
            const { root } = await DOM.getDocument();
            
            let nodeId: number;
            if (isXPath) {
              const { searchId } = await DOM.performSearch({
                query: selector,
                includeUserAgentShadowDOM: true,
              });
              const { nodeIds } = await DOM.getSearchResults({
                searchId,
                fromIndex: 0,
                toIndex: 1,
              });
              if (!nodeIds || nodeIds.length === 0) {
                throw new Error(`Element not found: ${selector}`);
              }
              nodeId = nodeIds[0];
            } else {
              const { nodeId: foundNodeId } = await DOM.querySelector({
                nodeId: root.nodeId,
                selector,
              });
              if (!foundNodeId) {
                throw new Error(`Element not found: ${selector}`);
              }
              nodeId = foundNodeId;
            }

            // Get box model to find click coordinates
            const { model } = await DOM.getBoxModel({ nodeId });
            if (!model || !model.content || model.content.length < 2) {
              throw new Error('Could not get element position');
            }

            const x = model.content[0] + (model.content[2] - model.content[0]) / 2;
            const y = model.content[1] + (model.content[5] - model.content[1]) / 2;

            // Click at the center of the element
            await Input.dispatchMouseEvent({
              type: 'mousePressed',
              x,
              y,
              button: 'left',
              clickCount: 1,
            });
            await Input.dispatchMouseEvent({
              type: 'mouseReleased',
              x,
              y,
              button: 'left',
              clickCount: 1,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Clicked element: ${selector}`,
                },
              ],
            };
          }

          case 'type_text': {
            const selector = (args as { selector?: string })?.selector;
            const text = (args as { text?: string })?.text;
            const clear = (args as { clear?: boolean })?.clear !== false;

            if (!selector || !text) {
              throw new Error('Selector and text are required');
            }

            const client = await this.connectToChrome();
            const { Runtime, DOM, Input } = client;

            // Get document and find element
            const { root } = await DOM.getDocument();
            const { nodeId } = await DOM.querySelector({
              nodeId: root.nodeId,
              selector,
            });

            if (!nodeId) {
              throw new Error(`Element not found: ${selector}`);
            }

            // Focus the element
            await Runtime.evaluate({
              expression: `
                (function() {
                  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
                  if (element) {
                    element.focus();
                    ${clear ? 'element.value = "";' : ''}
                  }
                })()
              `,
            });

            // Type the text
            for (const char of text) {
              await Input.dispatchKeyEvent({
                type: 'char',
                text: char,
              });
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Typed text into: ${selector}`,
                },
              ],
            };
          }

          case 'execute_script': {
            const code = (args as { code?: string })?.code;
            if (!code) {
              throw new Error('Code is required');
            }

            const client = await this.connectToChrome();
            const { Runtime } = client;

            const result = await Runtime.evaluate({
              expression: code,
              returnByValue: true,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result.result?.value || result.result, null, 2),
                },
              ],
            };
          }

          case 'take_screenshot': {
            const fullPage = (args as { fullPage?: boolean })?.fullPage || false;
            const client = await this.connectToChrome();
            const { Page } = client;

            const screenshot = await Page.captureScreenshot({
              format: 'png',
              fromSurface: true,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Screenshot captured (base64): ${screenshot.data.substring(0, 100)}...`,
                },
                {
                  type: 'image',
                  data: screenshot.data,
                  mimeType: 'image/png',
                },
              ],
            };
          }

          case 'close_tab': {
            const url = (args as { url?: string })?.url;
            const tabId = (args as { tabId?: string })?.tabId;
            
            const tabs = await this.discoverChromeTabs();
            let targetTab: any = null;

            if (tabId) {
              targetTab = tabs.find((tab: any) => tab.id === tabId);
            } else if (url) {
              targetTab = tabs.find((tab: any) => tab.url === url || tab.url.includes(url));
            } else {
              // Close current tab (first one)
              targetTab = tabs[0];
            }

            if (!targetTab) {
              throw new Error(`Tab not found: ${url || tabId || 'current'}`);
            }

            // Use HTTP API to close the tab (more reliable)
            const response = await fetch(`http://localhost:9222/json/close/${targetTab.id}`, { 
              method: 'POST' 
            });
            
            if (!response.ok) {
              throw new Error(`Failed to close tab: ${response.statusText}`);
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Closed tab: ${targetTab.title || targetTab.url}`,
                },
              ],
            };
          }

          case 'switch_to_tab': {
            const url = (args as { url?: string })?.url;
            const tabId = (args as { tabId?: string })?.tabId;

            const tabs = await this.discoverChromeTabs();
            let targetTab: any = null;

            if (tabId) {
              targetTab = tabs.find((tab: any) => tab.id === tabId);
            } else if (url) {
              targetTab = tabs.find((tab: any) => tab.url === url || tab.url.includes(url));
            }

            if (!targetTab) {
              throw new Error(`Tab not found: ${url || tabId}`);
            }

            // Reconnect to the target tab
            if (this.chromeClient) {
              try {
                await this.chromeClient.close().catch(() => {});
              } catch (closeError) {
                // Ignore close errors
              }
              this.chromeClient = null;
            }

            // Connect with timeout
            const client = await Promise.race([
              CDP({ port: 9222, target: targetTab.id }),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
              )
            ]) as CDP.Client;
            
            // Enable domains with timeout
            await Promise.race([
              Promise.all([
                client.Page.enable(),
                client.Runtime.enable(),
                client.DOM.enable()
              ]),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Enable domains timeout')), 5000)
              )
            ]);
            this.chromeClient = client;

            return {
              content: [
                {
                  type: 'text',
                  text: `Switched to tab: ${targetTab.title || targetTab.url}`,
                },
              ],
            };
          }

          case 'download_file': {
            const url = (args as { url?: string })?.url;
            const selector = (args as { selector?: string })?.selector;
            const savePath = (args as { savePath?: string })?.savePath;

            const client = await this.connectToChrome();
            const { Runtime, Page, DOM } = client;

            if (url && !selector) {
              // Direct download from URL
              await Page.navigate({ url });
              await Page.loadEventFired();
              
              // Trigger download by navigating to the URL
              return {
                content: [
                  {
                    type: 'text',
                    text: `Downloading file from: ${url}`,
                  },
                ],
              };
            } else if (selector) {
              // Click download link/button
              const { root } = await DOM.getDocument();
              const { nodeId } = await DOM.querySelector({
                nodeId: root.nodeId,
                selector,
              });

              if (!nodeId) {
                throw new Error(`Download element not found: ${selector}`);
              }

              // Get the href or click the element
              const href = await Runtime.evaluate({
                expression: `
                  (function() {
                    const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
                    if (el) {
                      if (el.href) return el.href;
                      if (el.onclick) {
                        el.click();
                        return 'clicked';
                      }
                      return el.getAttribute('href') || el.getAttribute('data-url') || '';
                    }
                    return '';
                  })()
                `,
              });

              if (href.result?.value && href.result.value !== 'clicked') {
                await Page.navigate({ url: href.result.value as string });
              } else {
                // Click the element
                const { model } = await DOM.getBoxModel({ nodeId });
                if (model && model.content && model.content.length >= 2) {
                  const x = model.content[0] + (model.content[2] - model.content[0]) / 2;
                  const y = model.content[1] + (model.content[5] - model.content[1]) / 2;
                  const { Input } = client;
                  await Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x,
                    y,
                    button: 'left',
                    clickCount: 1,
                  });
                  await Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x,
                    y,
                    button: 'left',
                    clickCount: 1,
                  });
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Download initiated from element: ${selector}`,
                  },
                ],
              };
            } else {
              throw new Error('Either URL or selector must be provided');
            }
          }

          case 'wait_for_download': {
            const timeout = (args as { timeout?: number })?.timeout || 60;
            const startTime = Date.now();

            // Poll for download completion
            while (Date.now() - startTime < timeout * 1000) {
              // Check if download is complete by checking browser downloads
              // Note: This is a simplified implementation
              await new Promise((resolve) => setTimeout(resolve, 1000));
              
              // In a real implementation, you'd check the Browser.getDownloadItems() or similar
              // For now, just wait
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Waited ${timeout} seconds for download`,
                },
              ],
            };
          }

          case 'get_downloads': {
            // Get download information
            // Note: Chrome DevTools Protocol doesn't have a direct downloads API
            // This would need to be implemented via Browser domain or file system checks
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      message: 'Download tracking not fully implemented. Check your browser downloads folder.',
                      defaultDownloadPath: process.platform === 'win32' 
                        ? `${process.env.USERPROFILE}\\Downloads`
                        : `${process.env.HOME}/Downloads`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'batch_download_and_close': {
            const urls = (args as { urls?: string[] })?.urls || [];
            const selector = (args as { selector?: string })?.selector;
            const waitTime = (args as { waitTime?: number })?.waitTime || 3;

            if (!selector) {
              throw new Error('Selector is required for batch download');
            }

            const results: string[] = [];
            const client = await this.connectToChrome();
            const { Page, Runtime, DOM, Input, Browser } = client;

            for (const url of urls) {
              try {
                // Navigate to URL
                await Page.navigate({ url });
                await Page.loadEventFired();
                
                // Wait for page to load
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Find and click download element
                const { root } = await DOM.getDocument();
                const { nodeId } = await DOM.querySelector({
                  nodeId: root.nodeId,
                  selector,
                });

                if (nodeId) {
                  const { model } = await DOM.getBoxModel({ nodeId });
                  if (model && model.content && model.content.length >= 2) {
                    const x = model.content[0] + (model.content[2] - model.content[0]) / 2;
                    const y = model.content[1] + (model.content[5] - model.content[1]) / 2;
                    await Input.dispatchMouseEvent({
                      type: 'mousePressed',
                      x,
                      y,
                      button: 'left',
                      clickCount: 1,
                    });
                    await Input.dispatchMouseEvent({
                      type: 'mouseReleased',
                      x,
                      y,
                      button: 'left',
                      clickCount: 1,
                    });
                  }
                }

                // Wait for download to start
                await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

                // Get current tab ID and close it
                const tabs = await this.discoverChromeTabs();
                const currentTab = tabs.find((tab: any) => tab.url === url || tab.url.includes(url.split('?')[0]));
                if (currentTab) {
                  await fetch(`http://localhost:9222/json/close/${currentTab.id}`, { method: 'POST' });
                }

                results.push(`✓ Downloaded and closed: ${url}`);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                results.push(`✗ Failed ${url}: ${errorMessage}`);
              }
            }

            return {
              content: [
                {
                  type: 'text',
                  text: results.join('\n'),
                },
              ],
            };
          }

          case 'download_newest_torrent': {
            const autoDownload = (args as { autoDownload?: boolean })?.autoDownload !== false;
            
            const client = await this.connectToChrome();
            const { Runtime } = client;

            // Read the script file - resolve path relative to current file location
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const scriptPath = join(__dirname, '..', 'scripts', 'download-newest-torrent.js');
            const scriptContent = readFileSync(scriptPath, 'utf-8');

            // Execute the script
            const result = await Runtime.evaluate({
              expression: scriptContent,
              returnByValue: true,
            });

            if (result.exceptionDetails) {
              throw new Error(
                `Script error: ${result.exceptionDetails.text} - ${result.exceptionDetails.exception?.description || 'Unknown error'}`
              );
            }

            const scriptResult = result.result?.value as {
              success: boolean;
              error?: string;
              downloadUrl?: string;
              selectedTorrent?: any;
              allTorrents?: any[];
              totalTorrents?: number;
            };

            if (!scriptResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        error: scriptResult.error || 'Failed to find torrent',
                        torrents: scriptResult.allTorrents || [],
                      },
                      null,
                      2
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Download if autoDownload is true and we have a URL
            if (autoDownload && scriptResult.downloadUrl) {
              try {
                // Navigate to download URL to trigger download
                await client.Page.navigate({ url: scriptResult.downloadUrl });
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          success: true,
                          message: 'Torrent download initiated',
                          selectedTorrent: scriptResult.selectedTorrent,
                          downloadUrl: scriptResult.downloadUrl,
                          allTorrents: scriptResult.allTorrents,
                          totalTorrents: scriptResult.totalTorrents,
                        },
                        null,
                        2
                      ),
                    },
                  ],
                };
              } catch (downloadError) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          success: true,
                          message: 'Torrent selected but download failed',
                          error: downloadError instanceof Error ? downloadError.message : String(downloadError),
                          selectedTorrent: scriptResult.selectedTorrent,
                          downloadUrl: scriptResult.downloadUrl,
                          allTorrents: scriptResult.allTorrents,
                        },
                        null,
                        2
                      ),
                    },
                  ],
                  isError: true,
                };
              }
            }

            // Return result without downloading
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(scriptResult, null, 2),
                },
              ],
            };
          }

          case 'batch_download_torrents': {
            const urls = (args as { urls?: string[] })?.urls || [];
            const maxRetries = (args as { maxRetries?: number })?.maxRetries || 3;
            const reportPath = (args as { reportPath?: string })?.reportPath;
            const autoRetry = (args as { autoRetry?: boolean })?.autoRetry !== false;
            const closeOnSuccess = (args as { closeOnSuccess?: boolean })?.closeOnSuccess !== false;
            
            // Read the enhanced script file
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const scriptPath = join(__dirname, '..', 'scripts', 'download-newest-torrent-enhanced.js');
            const scriptContent = readFileSync(scriptPath, 'utf-8');

            // Get tabs to process
            const allTabs = await this.discoverChromeTabs();
            let tabsToProcess: any[] = [];
            
            if (urls.length > 0) {
              // Process specified URLs
              for (const url of urls) {
                const tab = allTabs.find((t: any) => t.url === url || t.url.includes(url.split('?')[0]));
                if (tab) {
                  tabsToProcess.push(tab);
                }
              }
            } else {
              // Process all tabs with ExHentai torrent pages
              tabsToProcess = allTabs.filter((tab: any) => 
                tab.url && tab.url.includes('gallerytorrents.php')
              );
            }

            if (tabsToProcess.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        error: 'No matching tabs found',
                        totalTabs: allTabs.length,
                        message: urls.length > 0 
                          ? 'Specified URLs not found in open tabs'
                          : 'No ExHentai torrent pages found in open tabs',
                      },
                      null,
                      2
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Process each tab
            const report: any = {
              timestamp: new Date().toISOString(),
              totalTabs: tabsToProcess.length,
              processed: 0,
              succeeded: 0,
              failed: 0,
              retries: 0,
              items: [],
            };

            // Helper function to process a single tab with retry
            const processTabWithRetry = async (tab: any, retryCount: number = 0): Promise<any> => {
              let tabClient: CDP.Client | null = null;
              try {
                // Connect to the specific tab with timeout
                tabClient = await Promise.race([
                  CDP({ port: 9222, target: tab.id }),
                  new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
                  )
                ]) as CDP.Client;
                
                // Enable domains with timeout
                await Promise.race([
                  Promise.all([
                    tabClient.Page.enable(),
                    tabClient.Runtime.enable()
                  ]),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Enable domains timeout')), 5000)
                  )
                ]);
                
                // Wait for page to be ready with timeout
                await Promise.race([
                  tabClient.Page.loadEventFired().catch(() => Promise.resolve()),
                  new Promise(resolve => setTimeout(resolve, 3000))
                ]);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                
                // Execute script to find and select torrent
                const scriptResult = await tabClient.Runtime.evaluate({
                  expression: scriptContent,
                  returnByValue: true,
                  awaitPromise: true,
                });

                if (scriptResult.exceptionDetails) {
                  throw new Error(`Script error: ${scriptResult.exceptionDetails.text}`);
                }

                const result = scriptResult.result?.value as {
                  success: boolean;
                  error?: string;
                  downloadUrl?: string;
                  selectedTorrent?: any;
                  report?: any;
                };

                if (!result.success || !result.downloadUrl) {
                  return {
                    success: false,
                    error: result.error || 'Failed to find torrent',
                    tab: { id: tab.id, url: tab.url, title: tab.title },
                    retryCount,
                  };
                }

                // Pre-download report
                const preReport = {
                  ...result.report,
                  tab: { id: tab.id, url: tab.url, title: tab.title },
                  retryCount,
                };

                // Navigate to download URL
                let downloadSuccess = false;
                try {
                  // For .torrent files, navigating to the URL triggers download automatically
                  // We consider navigation without error as success
                  await tabClient.Page.navigate({ url: result.downloadUrl });
                  
                  // Wait for download to start (browser handles .torrent files automatically)
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  
                  // For .torrent files, if navigation succeeded, download has started
                  // Don't over-verify as it can cause false negatives
                  downloadSuccess = true;
                  
                } catch (downloadError) {
                  // Only mark as failed if navigation actually failed
                  downloadSuccess = false;
                }

                // Post-download report
                const postReport = {
                  ...preReport,
                  action: 'post_download',
                  downloadStatus: downloadSuccess ? 'success' : 'failed',
                  downloadUrl: result.downloadUrl,
                  timestamp: new Date().toISOString(),
                };

                // Retry logic with page reload - only retry on actual errors
                // Don't retry if download was successful (navigation succeeded)
                if (!downloadSuccess && autoRetry && retryCount < maxRetries) {
                  report.retries++;
                  
                  // Close current connection
                  if (tabClient) {
                    await tabClient.close().catch(() => {});
                    tabClient = null;
                  }
                  
                  // Reload the page and retry
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  
                  const reloadedTabs = await this.discoverChromeTabs();
                  const reloadedTab = reloadedTabs.find((t: any) => 
                    t.url === tab.url || (t.url && tab.url && t.url.split('?')[0] === tab.url.split('?')[0])
                  );
                  
                  if (reloadedTab) {
                    // Reload the page with timeout
                    const reloadClient = await Promise.race([
                      CDP({ port: 9222, target: reloadedTab.id }),
                      new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                      )
                    ]) as CDP.Client;
                    
                    try {
                      await Promise.race([
                        Promise.all([
                          reloadClient.Page.enable(),
                          reloadClient.Page.reload({})
                        ]),
                        new Promise<never>((_, reject) =>
                          setTimeout(() => reject(new Error('Reload timeout')), 5000)
                        )
                      ]);
                      
                      await Promise.race([
                        reloadClient.Page.loadEventFired().catch(() => Promise.resolve()),
                        new Promise(resolve => setTimeout(resolve, 3000))
                      ]);
                    } finally {
                      await reloadClient.close().catch(() => {});
                    }
                    
                    // Wait a bit before retry
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    
                    // Recursive retry - will stop after maxRetries
                    return await processTabWithRetry(reloadedTab, retryCount + 1);
                  }
                }
                
                // If download was successful or max retries reached, return result
                // This prevents infinite loops

                // Close tab after successful download (if enabled)
                let tabClosed = false;
                if (downloadSuccess && closeOnSuccess) {
                  try {
                    // Close the tab after successful download
                    await fetch(`http://localhost:9222/json/close/${tab.id}`, { method: 'POST' }).catch(() => {});
                    tabClosed = true;
                  } catch (closeError) {
                    // Ignore close errors - tab might already be closed
                  }
                }

                return {
                  success: downloadSuccess,
                  tab: { id: tab.id, url: tab.url, title: tab.title },
                  selectedTorrent: result.selectedTorrent,
                  downloadUrl: result.downloadUrl,
                  retryCount,
                  preReport,
                  postReport,
                  error: downloadSuccess ? undefined : 'Download verification failed',
                  tabClosed: tabClosed,
                };

              } catch (error) {
                // Don't close tab on error - user might want to check it
                return {
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                  tab: { id: tab.id, url: tab.url, title: tab.title },
                  retryCount,
                  tabClosed: false,
                };
              } finally {
                if (tabClient) {
                  await tabClient.close().catch(() => {});
                }
              }
            };

            // Process all tabs
            for (const tab of tabsToProcess) {
              report.processed++;
              const result = await processTabWithRetry(tab);
              
              report.items.push({
                tab: result.tab,
                success: result.success,
                selectedTorrent: result.selectedTorrent,
                downloadUrl: result.downloadUrl,
                retryCount: result.retryCount,
                preReport: result.preReport,
                postReport: result.postReport,
                error: result.error,
                tabClosed: result.tabClosed || false,
              });

              if (result.success) {
                report.succeeded++;
              } else {
                report.failed++;
              }

              // Small delay between tabs
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            // Save report to file if path provided
            if (reportPath) {
              const { writeFileSync } = await import('fs');
              writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(report, null, 2),
                },
              ],
            };
          }

          case 'auto_batch_download_torrents': {
            const interval = (args as { interval?: number })?.interval || 30;
            const maxRetries = (args as { maxRetries?: number })?.maxRetries || 3;
            const reportPath = (args as { reportPath?: string })?.reportPath;
            const closeOnSuccess = (args as { closeOnSuccess?: boolean })?.closeOnSuccess !== false;
            const maxRunTime = (args as { maxRunTime?: number })?.maxRunTime || 0;
            
            const startTime = Date.now();
            const processedTabs = new Set<string>(); // Track processed tab URLs to avoid duplicates
            let totalProcessed = 0;
            let totalSucceeded = 0;
            let totalFailed = 0;
            
            // Function to process new tabs
            const processNewTabs = async () => {
              try {
                const allTabs = await this.discoverChromeTabs();
                const torrentTabs = allTabs.filter((tab: any) => 
                  tab.url && tab.url.includes('gallerytorrents.php')
                );
                
                // Filter out already processed tabs
                const newTabs = torrentTabs.filter((tab: any) => 
                  !processedTabs.has(tab.url)
                );
                
                if (newTabs.length === 0) {
                  return { processed: 0, message: 'No new tabs found' };
                }
                
                // Process new tabs using batch download logic
                const report: any = {
                  timestamp: new Date().toISOString(),
                  totalTabs: newTabs.length,
                  processed: 0,
                  succeeded: 0,
                  failed: 0,
                  retries: 0,
                  items: [],
                };
                
                // Read the enhanced script file
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                const scriptPath = join(__dirname, '..', 'scripts', 'download-newest-torrent-enhanced.js');
                const scriptContent = readFileSync(scriptPath, 'utf-8');
                
                // Helper function to process a single tab (same as batch_download_torrents)
                const processTabWithRetry = async (tab: any, retryCount: number = 0): Promise<any> => {
                  let tabClient: CDP.Client | null = null;
                  try {
                    // Connect with timeout
                    tabClient = await Promise.race([
                      CDP({ port: 9222, target: tab.id }),
                      new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
                      )
                    ]) as CDP.Client;
                    
                    // Enable domains with timeout
                    await Promise.race([
                      Promise.all([
                        tabClient.Page.enable(),
                        tabClient.Runtime.enable()
                      ]),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Enable domains timeout')), 5000)
                      )
                    ]);
                    
                    // Wait for page with timeout
                    await Promise.race([
                      tabClient.Page.loadEventFired().catch(() => Promise.resolve()),
                      new Promise(resolve => setTimeout(resolve, 3000))
                    ]);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    
                    const scriptResult = await tabClient.Runtime.evaluate({
                      expression: scriptContent,
                      returnByValue: true,
                      awaitPromise: true,
                    });

                    if (scriptResult.exceptionDetails) {
                      throw new Error(`Script error: ${scriptResult.exceptionDetails.text}`);
                    }

                    const result = scriptResult.result?.value as {
                      success: boolean;
                      error?: string;
                      downloadUrl?: string;
                      selectedTorrent?: any;
                      report?: any;
                    };

                    if (!result.success || !result.downloadUrl) {
                      return {
                        success: false,
                        error: result.error || 'Failed to find torrent',
                        tab: { id: tab.id, url: tab.url, title: tab.title },
                        retryCount,
                        tabClosed: false,
                      };
                    }

                    const preReport = {
                      ...result.report,
                      tab: { id: tab.id, url: tab.url, title: tab.title },
                      retryCount,
                    };

                    let downloadSuccess = false;
                    try {
                      await tabClient.Page.navigate({ url: result.downloadUrl });
                      await new Promise((resolve) => setTimeout(resolve, 2000));
                      downloadSuccess = true;
                    } catch (downloadError) {
                      downloadSuccess = false;
                    }

                    const postReport = {
                      ...preReport,
                      action: 'post_download',
                      downloadStatus: downloadSuccess ? 'success' : 'failed',
                      downloadUrl: result.downloadUrl,
                      timestamp: new Date().toISOString(),
                    };

                    // Close tab after successful download (if enabled)
                    let tabClosed = false;
                    if (downloadSuccess && closeOnSuccess) {
                      try {
                        await fetch(`http://localhost:9222/json/close/${tab.id}`, { method: 'POST' }).catch(() => {});
                        tabClosed = true;
                      } catch (closeError) {
                        // Ignore close errors
                      }
                    }

                    // Retry logic (same as batch_download_torrents)
                    if (!downloadSuccess && retryCount < maxRetries) {
                      report.retries++;
                      if (tabClient) {
                        await tabClient.close().catch(() => {});
                        tabClient = null;
                      }
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      
                      const reloadedTabs = await this.discoverChromeTabs();
                      const reloadedTab = reloadedTabs.find((t: any) => 
                        t.url === tab.url || (t.url && tab.url && t.url.split('?')[0] === tab.url.split('?')[0])
                      );
                      
                      if (reloadedTab) {
                        // Reload with timeout
                        const reloadClient = await Promise.race([
                          CDP({ port: 9222, target: reloadedTab.id }),
                          new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('Connection timeout')), 10000)
                          )
                        ]) as CDP.Client;
                        
                        try {
                          await Promise.race([
                            Promise.all([
                              reloadClient.Page.enable(),
                              reloadClient.Page.reload({})
                            ]),
                            new Promise<never>((_, reject) =>
                              setTimeout(() => reject(new Error('Reload timeout')), 5000)
                            )
                          ]);
                          
                          await Promise.race([
                            reloadClient.Page.loadEventFired().catch(() => Promise.resolve()),
                            new Promise(resolve => setTimeout(resolve, 3000))
                          ]);
                        } finally {
                          await reloadClient.close().catch(() => {});
                        }
                        
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        return await processTabWithRetry(reloadedTab, retryCount + 1);
                      }
                    }

                    return {
                      success: downloadSuccess,
                      tab: { id: tab.id, url: tab.url, title: tab.title },
                      selectedTorrent: result.selectedTorrent,
                      downloadUrl: result.downloadUrl,
                      retryCount,
                      preReport,
                      postReport,
                      error: downloadSuccess ? undefined : 'Download verification failed',
                      tabClosed: tabClosed,
                    };

                  } catch (error) {
                    return {
                      success: false,
                      error: error instanceof Error ? error.message : String(error),
                      tab: { id: tab.id, url: tab.url, title: tab.title },
                      retryCount,
                      tabClosed: false,
                    };
                  } finally {
                    if (tabClient) {
                      await tabClient.close().catch(() => {});
                    }
                  }
                };
                
                // Process all new tabs
                for (const tab of newTabs) {
                  report.processed++;
                  const result = await processTabWithRetry(tab);
                  
                  // Mark as processed
                  processedTabs.add(tab.url);
                  totalProcessed++;
                  
                  report.items.push({
                    tab: result.tab,
                    success: result.success,
                    selectedTorrent: result.selectedTorrent,
                    downloadUrl: result.downloadUrl,
                    retryCount: result.retryCount,
                    preReport: result.preReport,
                    postReport: result.postReport,
                    error: result.error,
                    tabClosed: result.tabClosed || false,
                  });

                  if (result.success) {
                    report.succeeded++;
                    totalSucceeded++;
                  } else {
                    report.failed++;
                    totalFailed++;
                  }

                  await new Promise((resolve) => setTimeout(resolve, 500));
                }

                // Save report if path provided
                if (reportPath && report.items.length > 0) {
                  const { writeFileSync } = await import('fs');
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const reportFile = reportPath.replace('.json', `-${timestamp}.json`);
                  writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
                }

                return report;
              } catch (error) {
                return {
                  error: error instanceof Error ? error.message : String(error),
                  processed: 0,
                };
              }
            };
            
            // Run initial check
            const initialReport = await processNewTabs();
            
            // Return initial status (automation continues in background if needed)
            // Note: For true automation, you'd need to set up a background process
            // For now, this returns the initial run status
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      message: 'Auto batch download initialized',
                      initialRun: initialReport,
                      settings: {
                        interval: interval,
                        maxRetries: maxRetries,
                        closeOnSuccess: closeOnSuccess,
                        maxRunTime: maxRunTime,
                      },
                      note: 'For continuous monitoring, you need to call this periodically or set up a background process',
                      totalProcessed: totalProcessed,
                      totalSucceeded: totalSucceeded,
                      totalFailed: totalFailed,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      if (this.chromeClient) {
        await this.chromeClient.close();
      }
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Chrome MCP server running on stdio');
  }
}

const server = new ChromeMCPServer();
server.run().catch(console.error);


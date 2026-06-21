/**
 * Background Service Worker
 * Handles cross-component communication and Chrome API interactions
 */

const COPY_MARKDOWN_MENU_ID = 'copy-page-as-markdown'
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/index.html'

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

async function ensureContextMenu() {
  await chrome.contextMenus.removeAll()
  await chrome.contextMenus.create({
    id: COPY_MARKDOWN_MENU_ID,
    title: 'Copy Page as Markdown',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  })
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)

  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    })

    if (contexts.length > 0) {
      return
    }
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['CLIPBOARD'],
    justification: 'Copy extracted markdown to clipboard from the extension context menu.',
  })
}

async function copyHtmlAsMarkdownToClipboard(html: string, url: string): Promise<number> {
  await ensureOffscreenDocument()

  const response = await chrome.runtime.sendMessage({
    action: 'COPY_MARKDOWN_HTML_TO_CLIPBOARD',
    html,
    url,
  }) as { success?: boolean; error?: string; length?: number }

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to copy markdown to clipboard')
  }

  return response.length || 0
}

async function notify(title: string, message: string) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'public/logo_48.png',
    title,
    message,
  })
}

async function waitForTabComplete(tabId: number, timeoutMs = 5000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId)
    if (tab.status === 'complete') {
      return
    }
    await sleep(200)
  }
}

async function handleCopyPageAsMarkdown(tabId: number) {
  await waitForTabComplete(tabId)

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      html: document.documentElement.outerHTML,
      url: window.location.href,
    }),
  })

  if (!result?.html) {
    throw new Error('Failed to read page HTML')
  }

  const markdownLength = await copyHtmlAsMarkdownToClipboard(result.html, result.url)
  await notify('OrangeSideBar', `Markdown copied to clipboard (${markdownLength.toLocaleString()} chars)`)
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureContextMenu()
})

chrome.runtime.onStartup.addListener(() => {
  void ensureContextMenu()
})

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== COPY_MARKDOWN_MENU_ID || !tab?.id) {
    return
  }

  void (async () => {
    try {
      await handleCopyPageAsMarkdown(tab.id as number)
    } catch (error) {
      await notify(
        'OrangeSideBar',
        `Copy Markdown failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  })()
})

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'GET_TAB_INFO':
      handleGetTabInfo(sendResponse)
      return true // Async response

    case 'EXECUTE_SCRIPT':
      handleExecuteScript(message, sendResponse)
      return true

    case 'getYouTubeSubtitles':
      handleGetYouTubeSubtitles(sendResponse)
      return true

    case 'openSettings':
      chrome.runtime.openOptionsPage()
      return false

    default:
      console.log('Unknown action:', message.action)
  }
})

async function handleGetTabInfo(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    sendResponse({ success: true, data: tab })
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
}

async function handleExecuteScript(
  message: { tabId?: number; func: string; args?: unknown[] },
  sendResponse: (response: unknown) => void
) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = message.tabId || tab.id

    if (!tabId) {
      sendResponse({ success: false, error: 'No active tab' })
      return
    }

    // Note: In production, you'd need to execute actual functions
    // This is a placeholder for the scripting API usage
    sendResponse({ success: true, tabId })
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
}

async function handleGetYouTubeSubtitles(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id) {
      sendResponse({ success: false, error: 'No active tab' })
      return
    }

    // Read subtitle cache directly from the page (MAIN world), mirroring the legacy implementation.
    // This avoids relying on MAIN-world content scripts having access to extension messaging APIs.
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        const win = window as unknown as {
          __ytSubtitleCache?: Record<string, unknown>
          __ytSubDownloaderInstalled?: boolean
        }
        return {
          cache: win.__ytSubtitleCache || {},
          installed: !!win.__ytSubDownloaderInstalled,
          title: document.title.replace(' - YouTube', ''),
        }
      },
    })

    sendResponse({ success: true, data: results[0]?.result })
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
}

// Proxy LLM requests from renderer to avoid browser-injected Sec-Fetch-* headers
let _proxyRuleId = 2000

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'llm-proxy') return
  port.onMessage.addListener(async ({ url, options }: { url: string; options: RequestInit & { headers?: Record<string, string> } }) => {
    const ruleId = _proxyRuleId++
    const { hostname } = new URL(url)

    // Strip browser-injected headers that third-party API servers use to detect and block browser requests
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [],
      addRules: [{
        id: ruleId,
        priority: 2,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            { header: 'sec-fetch-mode', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            { header: 'sec-fetch-site', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            { header: 'sec-fetch-dest', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            { header: 'origin', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
          ],
        },
        condition: { requestDomains: [hostname] },
      }],
    })

    try {
      const res = await fetch(url, options)
      const hdrs: Record<string, string> = {}
      res.headers.forEach((v, k) => { hdrs[k] = v })
      port.postMessage({ type: 'status', status: res.status, statusText: res.statusText, headers: hdrs })
      if (!res.body) { port.postMessage({ type: 'done' }); return }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) { port.postMessage({ type: 'done' }); break }
        port.postMessage({ type: 'chunk', data: dec.decode(value, { stream: true }) })
      }
    } catch (e) {
      port.postMessage({ type: 'error', message: String(e) })
    } finally {
      void chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId], addRules: [] })
    }
  })
})

// Log when service worker is activated
console.log('OrangeSideBar background service worker activated')

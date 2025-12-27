/**
 * Background Service Worker
 * Handles cross-component communication and Chrome API interactions
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
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

    // Send message to content script to get cached subtitles
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'GET_YOUTUBE_SUBTITLES',
    })

    if (response?.success) {
      sendResponse({ success: true, data: response.data })
    } else {
      sendResponse({ success: false, error: response?.error || 'Failed to get subtitles' })
    }
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
}

// Log when service worker is activated
console.log('OrangeSideBar background service worker activated')

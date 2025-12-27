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

// Log when service worker is activated
console.log('OrangeSideBar background service worker activated')

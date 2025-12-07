chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "openSettings") {
    chrome.tabs.create({ 'url': 'settings.html' });
  } else if (message.action === "getPageTitle") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        // 如果出现错误，返回错误信息
        sendResponse({ title: null, error: chrome.runtime.lastError.message });
      } else if (tabs && tabs[0]) {
        sendResponse({ title: tabs[0].title });
      } else {
        sendResponse({ title: null });
      }
    });
    return true; // Keep the message channel open to send the response asynchronously
  } else if (message.action === "getYouTubeSubtitles") {
    // 获取YouTube字幕缓存
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: '无法获取当前标签页' });
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: () => {
            return {
              cache: window.__ytSubtitleCache || {},
              title: document.title.replace(' - YouTube', ''),
              installed: !!window.__ytSubDownloaderInstalled
            };
          }
        });

        sendResponse({ success: true, data: results[0]?.result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    });
    return true;
  }
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  await chrome.sidePanel.setOptions({
    tabId,
    path: 'side_panel.html',
    enabled: true
  });
});
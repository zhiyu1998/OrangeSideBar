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


// chrome.runtime.onInstalled.addListener(function () {
//   chrome.contextMenus.create({
//     id: "mainMenu",
//     title: "OrangeSideBar",
//     contexts: ["all"]
//   });
// chrome.contextMenus.create({
//   id: "copyPurePageContent",
//   title: "复制网页正文(纯文本)",
//   contexts: ["all"],
//   parentId: "mainMenu"
// });
// chrome.contextMenus.create({
//   id: "copyPageContent",
//   title: "复制网页正文(HTML)",
//   contexts: ["all"],
//   parentId: "mainMenu"
// });

// });

// 监听菜单项的点击事件
// chrome.contextMenus.onClicked.addListener(function (info, tab) {
// if (info.menuItemId === "copyPageContent") {
//   chrome.tabs.sendMessage(tab.id, { action: 'copyPageContent' });
// } else if (info.menuItemId === "copyPurePageContent") {
//   chrome.tabs.sendMessage(tab.id, { action: 'copyPurePageContent' });
// }
// });

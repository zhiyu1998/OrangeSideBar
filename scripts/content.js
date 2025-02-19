// 监听获取正文请求
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  if (request.action === ACTION_FETCH_PAGE_CONTENT) {
    // 获取网页html
    sendResponse({ content: extractContent() || "No content" });
  } else if (request.action === ACTION_FETCH_TEXT_CONTENT) {
    // 获取网页文本
    sendResponse({ content: extractContent(FORMAT_TEXT) || "No content" });
  } else if (request.action === ACTION_COPY_PAGE_CONTENT) {
    // 网页html到剪切板
    const content = extractContent();
    navigator.clipboard.writeText(content).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err });
    });
  } else if (request.action === ACTION_COPY_PURE_PAGE_CONTENT) {
    // 网页文本到剪切板
    const content = extractContent(FORMAT_TEXT);
    navigator.clipboard.writeText(content).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err });
    });
  } else if (request.action === ACTION_GET_PAGE_URL) {
    // 获取当前网页地址
    sendResponse({ url: window.location.href });
  }
});


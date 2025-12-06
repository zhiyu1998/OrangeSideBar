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
    return true; // 表示异步响应
  } else if (request.action === ACTION_COPY_PURE_PAGE_CONTENT) {
    // 网页文本到剪切板
    const content = extractContent(FORMAT_TEXT);
    navigator.clipboard.writeText(content).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err });
    });
    return true; // 表示异步响应
  } else if (request.action === ACTION_GET_PAGE_URL) {
    // 获取当前网页地址
    sendResponse({ url: window.location.href });
  } else if (request.action === ACTION_FETCH_VIDEO_SUBTITLE_INFO) {
    // 获取视频字幕信息
    const url = window.location.href;
    const isBilibili = url.includes('bilibili.com');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    if (isBilibili || isYouTube) {
      // 返回视频信息
      sendResponse({
        url: url,
        isBilibili: isBilibili,
        isYouTube: isYouTube
      });
    } else {
      sendResponse({
        url: url,
        isBilibili: false,
        isYouTube: false,
        error: '不支持的网站，仅支持Bilibili和YouTube'
      });
    }
  }
});


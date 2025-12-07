/**
 * YouTube 字幕拦截器
 * 直接在页面上下文运行，拦截所有字幕请求
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__ytSubDownloaderInstalled) return;
  window.__ytSubDownloaderInstalled = true;

  // 字幕缓存
  window.__ytSubtitleCache = {};

  // 判断是否是字幕请求
  function isSubtitleUrl(url) {
    return url && url.includes('timedtext');
  }

  // 提取语言信息
  function getLangKey(url) {
    try {
      const u = new URL(url, location.origin);
      const lang = u.searchParams.get('lang') || 'unknown';
      const kind = u.searchParams.get('kind');
      return kind === 'asr' ? lang + '_auto' : lang;
    } catch {
      return 'unknown';
    }
  }

  // 保存到缓存
  function saveSubtitle(url, data) {
    const key = getLangKey(url);
    window.__ytSubtitleCache[key] = {
      data: data,
      url: url,
      time: Date.now()
    };
  }

  // 拦截 Fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    const url = args[0]?.url || args[0];
    if (isSubtitleUrl(url)) {
      try {
        const clone = response.clone();
        const text = await clone.text();
        if (text.length > 100) {
          const json = JSON.parse(text);
          if (json.events) {
            saveSubtitle(url, json);
          }
        }
      } catch (e) {}
    }

    return response;
  };

  // 拦截 XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    if (isSubtitleUrl(this._url)) {
      this.addEventListener('load', function() {
        try {
          if (this.responseText.length > 100) {
            const json = JSON.parse(this.responseText);
            if (json.events) {
              saveSubtitle(this._url, json);
            }
          }
        } catch (e) {}
      });
    }
    return originalSend.apply(this, arguments);
  };
})();

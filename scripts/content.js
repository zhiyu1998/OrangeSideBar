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
  } else if (request.action === ACTION_DOWNLOAD_SUBTITLES) {
    // 下载字幕文件
    const subtitles = await extractSubtitles(window.location.href);
    downloadSubtitles(subtitles);
  } else if (request.action === ACTION_GET_PAGE_URL) {
    // 获取当前网页地址
    sendResponse({ url: window.location.href });
  }
});

const QUICK_TRANS = "quick-trans";

// 是否开启快捷翻译
chrome.storage.local.get(QUICK_TRANS, function (config) {
  const enabled = config[QUICK_TRANS].enabled;
  if (enabled == false) {
    return;
  }

  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'fisherai-buttons-container';
  buttonContainer.style.cssText = `
    display: none;
    position: absolute;
    z-index: 999999;
    background-color: #ffffff;
    border-radius: 8px;
    padding: 6px;
    gap: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease;
    opacity: 0;
    transform: translateY(10px);
  `;

  // 创建logo图片
  const logoImg = document.createElement('img');
  logoImg.src = chrome.runtime.getURL('images/logo_48.png');
  logoImg.style.cssText = `
    width: 16px;
    height: 16px;
    margin-right: 4px;
  `;

  // 创建按钮组
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    display: flex;
    gap: 4px;
    align-items: center;
  `;

  // 创建总结按钮
  const summaryButton = document.createElement('button');
  summaryButton.textContent = '总结';
  summaryButton.className = 'fisherai-action-button';
  summaryButton.style.cssText = `
    color: #374151;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background-color: transparent;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
  `;

  // 创建翻译按钮
  const translateButton = document.createElement('button');
  translateButton.textContent = '翻译';
  translateButton.className = 'fisherai-action-button';
  translateButton.style.cssText = summaryButton.style.cssText;

  // 添加hover效果
  const buttons = [summaryButton, translateButton];
  buttons.forEach(button => {
    button.addEventListener('mouseover', function () {
      this.style.backgroundColor = '#F3F4F6';
    });
    button.addEventListener('mouseout', function () {
      this.style.backgroundColor = 'transparent';
    });
  });

  // 组装按钮组
  buttonGroup.appendChild(summaryButton);
  buttonGroup.appendChild(translateButton);
  buttonContainer.appendChild(logoImg);
  buttonContainer.appendChild(buttonGroup);
  document.body.appendChild(buttonContainer);

  // 创建翻译结果浮窗元素
  const translationPopup = document.createElement('div');
  if (translationPopup) {
    translationPopup.id = 'fisherai-transpop-id';
    translationPopup.style.cssText = `
      display: none;
      position: absolute;
      z-index: 9999;
      background-color: #ffffff;
      color: #1F2937;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      max-width: 600px;
      min-width: 300px;
      max-height: 400px;
      overflow-y: auto;
      line-height: 1.6;
      font-size: 14px;
      word-wrap: break-word;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(10px);
    `;

    // 添加滚动条样式
    const style = document.createElement('style');
    style.textContent = `
      #fisherai-transpop-id::-webkit-scrollbar {
        width: 8px;
      }
      #fisherai-transpop-id::-webkit-scrollbar-track {
        background: #F3F4F6;
        border-radius: 4px;
      }
      #fisherai-transpop-id::-webkit-scrollbar-thumb {
        background: #D1D5DB;
        border-radius: 4px;
      }
      #fisherai-transpop-id::-webkit-scrollbar-thumb:hover {
        background: #9CA3AF;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(translationPopup);
  }

  // 监听选中事件
  let selectionTimeout;
  document.addEventListener('mouseup', function (event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 当用户选中了文本
    if (selectedText) {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const rects = selection.getRangeAt(0).getClientRects();
        if (rects.length > 0) {
          const rect = rects[0];
          buttonContainer.style.top = `${rect.bottom + window.scrollY + 10}px`;
          buttonContainer.style.left = `${rect.left + window.scrollX}px`;
          buttonContainer.style.display = 'flex';
          // 添加淡入效果
          requestAnimationFrame(() => {
            buttonContainer.style.opacity = '1';
            buttonContainer.style.transform = 'translateY(0)';
          });
        }
      }, 200); // 添加小延迟，使交互更流畅
    } else {
      hideUI();
    }
  });

  // 监听点击事件
  document.addEventListener('mousedown', function (event) {
    if (!buttonContainer.contains(event.target) && !translationPopup.contains(event.target)) {
      hideUI();
    }
  });

  // 隐藏UI元素的函数
  function hideUI() {
    // 添加淡出效果
    buttonContainer.style.opacity = '0';
    buttonContainer.style.transform = 'translateY(10px)';
    translationPopup.style.opacity = '0';
    translationPopup.style.transform = 'translateY(10px)';

    setTimeout(() => {
      buttonContainer.style.display = 'none';
      translationPopup.style.display = 'none';
    }, 200);
  }

  // 处理按钮点击事件的函数
  async function handleButtonClick(promptTemplate) {
    chrome.storage.local.get([QUICK_TRANS], async function (config) {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText === '') {
        return;
      }

      translationPopup.innerHTML = '';
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      let minX = Infinity;
      let maxX = -Infinity;

      for (const rect of rects) {
        minX = Math.min(minX, rect.left);
        maxX = Math.max(maxX, rect.right);
      }

      const middleX = (minX + maxX) / 2;
      const lastRect = rects[rects.length - 1];
      const topY = lastRect.bottom + window.scrollY;

      translationPopup.style.top = `${topY + 10}px`;
      translationPopup.style.left = `${middleX + window.scrollX - 150}px`; // 居中显示
      translationPopup.style.display = 'block';

      // 添加淡入效果
      requestAnimationFrame(() => {
        translationPopup.style.opacity = '1';
        translationPopup.style.transform = 'translateY(0)';
      });

      buttonContainer.style.display = 'none';

      try {
        let model = config[QUICK_TRANS].selectedModel;
        if (!model) {
          translationPopup.innerHTML = '请先在设置中选择模型';
          return;
        }
        const { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);
        if (baseUrl && apiKey) {
          translationPopup.innerHTML = '<div style="color: #6B7280; display: flex; align-items: center; gap: 8px;"><svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/></svg>正在处理中...</div>';
          chatWithLLM(model, promptTemplate + selectedText, null, HUACI_TRANS_TYPE);
        } else {
          translationPopup.innerHTML = DEFAULT_TIPS;
        }
      } catch (error) {
        console.error('Error retrieving model or API information:', error);
        translationPopup.innerHTML = DEFAULT_TIPS;
      }
    });
  }

  // 绑定按钮点击事件
  summaryButton.addEventListener('click', () => handleButtonClick(SUMMARY_PROMPT));
  translateButton.addEventListener('click', () => handleButtonClick(TRANSLATE2CHN_PROMPT));
});


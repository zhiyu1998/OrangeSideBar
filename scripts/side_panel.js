/**
 * 判断是否设置api key
 * @returns
 */
async function verifyApiKeyConfigured(model) {
  // 根据模型名称判断使用哪个供应商的配置
  let provider = '';

  // 先检查精确匹配的前缀
  const mapping = MODEL_MAPPINGS.find(m =>
    m.prefix.some(p => model.startsWith(p))
  );

  if (mapping) {
    provider = mapping.provider;
  } else if (model.includes(MISTRAL_MODEL)) {
    provider = 'mistral';
  } else if (model.includes(OLLAMA_MODEL)) {
    provider = 'ollama';
  } else if (model.includes(GROQ_MODEL)) {
    provider = 'groq';
  } else if (model.includes(SILICONFLOW_MODEL)) {
    provider = 'siliconflow';
  }

  const { baseUrl, apiKey } = await getBaseUrlAndApiKey(provider);

  // 检查是否需要 API Key（Ollama 不需要）
  const needsApiKey = !model.includes(OLLAMA_MODEL);

  // 如果是 Claude 模型，使用 OpenAI 的 baseUrl
  let effectiveBaseUrl = baseUrl;

  // 检查配置是否完整
  if (effectiveBaseUrl == null || (needsApiKey && apiKey == null)) {
    // 隐藏初始推荐内容
    const sloganDiv = document.querySelector('.my-extension-slogan');
    sloganDiv.style.display = 'none';
    const featureDiv = document.querySelector('.feature-container');
    featureDiv.style.display = 'none';

    // 获取供应商的显示名称
    const providerDisplayName = {
      gpt: 'OpenAI',
      azure: 'Azure OpenAI',
      gemini: 'Google Gemini',
      anthropic: 'Anthropic',
      groq: 'Groq',
      mistral: 'Mistral AI',
      ollama: 'Ollama',
      siliconflow: 'Siliconflow'
    }[provider] || provider.toUpperCase();

    // 初始化对话内容
    var contentDiv = document.querySelector('.chat-content');
    contentDiv.innerHTML = `请先去设置 ${providerDisplayName} Model 和 API KEY.<br><br>Note: API KEY仅缓存在 Chrome 本地存储空间，不会上传服务器，以保证安全和隐私.`;
    return false;
  }
  return true;
}

/**
 * 隐藏初始推荐内容
 */
function hideRecommandContent() {
  const sloganDiv = document.querySelector('.my-extension-slogan');
  sloganDiv.style.display = 'none';
  const featureDiv = document.querySelector('.feature-container');
  featureDiv.style.display = 'none';
}

/**
 * 展示初始推荐内容
 */
function showRecommandContent() {
  const sloganDiv = document.querySelector('.my-extension-slogan');
  sloganDiv.style.display = '';
  const featureDiv = document.querySelector('.feature-container');
  featureDiv.style.display = '';
}

/**
 * 定义清空并加载内容的函数
 */
async function clearAndGenerate(model, inputText, base64Images) {
  // 隐藏初始推荐内容
  hideRecommandContent();

  // clean
  const contentDiv = document.querySelector('.chat-content');
  contentDiv.innerHTML = '';

  // generate
  await chatLLMAndUIUpdate(model, inputText, base64Images);
}

/**
 * 调用模型 & 更新ui
 * @param {string} model
 * @param {string} inputText
 * @param {Array} base64Images
 */
async function chatLLMAndUIUpdate(model, inputText, base64Images) {
  // loading
  displayLoading();

  // submit & generating button
  hideSubmitBtnAndShowGenBtn();

  // 创建或获取AI回答div
  const contentDiv = document.querySelector('.chat-content');
  let aiMessageDiv = contentDiv.lastElementChild;
  if (!aiMessageDiv || !aiMessageDiv.classList.contains('ai-message')) {
    aiMessageDiv = document.createElement('div');
    aiMessageDiv.className = 'ai-message';
    contentDiv.appendChild(aiMessageDiv);
  } else {
    aiMessageDiv.innerHTML = ''; // Clear existing content if regenerating
  }

  try {
    const completeText = await chatWithLLM(model, inputText, base64Images, CHAT_TYPE);
    createCopyButton(completeText);
  } catch (error) {
    hiddenLoadding();
    displayErrorMessage(`${error.message}`);
    console.error('请求异常:', error);
  } finally {
    // submit & generating button
    showSubmitBtnAndHideGenBtn();
  }
}

/**
 * 生成复制按钮
 * @param {string} completeText
 */
function createCopyButton(completeText) {
  const copySvg = document.querySelector('.icon-copy').cloneNode(true);
  copySvg.style.display = 'block';

  copySvg.addEventListener('click', function () {
    navigator.clipboard.writeText(completeText).then(() => {
      // 复制成功，替换为对号 SVG
      const originalSvg = copySvg.innerHTML;
      copySvg.innerHTML = rightSvgString;
      // 在几秒后恢复为原始复制按钮
      setTimeout(() => {
        copySvg.innerHTML = originalSvg;
      }, 2000);
    }).catch(err => {
      console.error('复制失败:', err);
    });
  });

  const contentDiv = document.querySelector('.chat-content');
  let lastDiv = contentDiv.lastElementChild;
  lastDiv.appendChild(copySvg);
}


/**
 * 隐藏提交按钮 & 展示生成按钮
 */
function hideSubmitBtnAndShowGenBtn() {
  const submitBtn = document.querySelector('#my-extension-submit-btn');
  submitBtn.style.cssText = 'display: none !important';
  const generateBtn = document.querySelector('#my-extension-generate-btn');
  generateBtn.style.cssText = 'display: flex !important';
  const inputBtn = document.querySelector('#my-extension-user-input');
  inputBtn.disabled = true;
}

/**
 * 展示提交按钮 & 隐藏生成按钮
 */
function showSubmitBtnAndHideGenBtn() {
  const submitBtn = document.querySelector('#my-extension-submit-btn');
  submitBtn.style.cssText = 'display: flex !important';
  updateSubmitButton();
  const generateBtn = document.querySelector('#my-extension-generate-btn');
  generateBtn.style.cssText = 'display: none !important';
  const inputBtn = document.querySelector('#my-extension-user-input');
  inputBtn.disabled = false;
}

/**
 * 根据选择的模型判断是否支持上传图像或文件
 * @param {string} selectedModel
 */
function toggleImageUpload(selectedModel) {
  const imageUploadDiv = document.getElementById('image-upload-div');
  const imageUpload = document.getElementById('image-upload');
  const imageUploadLabel = document.getElementById('image-upload-label');
  if (IMAGE_SUPPORT_MODELS.includes(selectedModel)) {
    // 如果模型支持图像，启用上传区域
    imageUploadDiv.style.opacity = '1';
    imageUpload.disabled = false;
    imageUploadLabel.style.pointerEvents = 'auto';
    imageUpload.setAttribute('accept', 'image/*');
    if (ANY_FILE_SUPPORT_MODELS.includes(selectedModel)) {
      imageUpload.removeAttribute('accept');
    }
  } else {
    // 如果模型不支持图像，禁用上传区域
    imageUploadDiv.style.opacity = '0.5';
    imageUpload.disabled = true;
    imageUploadLabel.style.pointerEvents = 'none';
  }
}

function loadImage(imgElement) {
  return new Promise((resolve, reject) => {
    if (imgElement.complete && imgElement.naturalHeight !== 0) {
      resolve();
    } else {
      imgElement.onload = () => resolve();
      imgElement.onerror = () => reject(new Error('Image failed to load: ' + imgElement.src));
    }
  });
}

async function loadAllImages(element) {
  const imgElements = element.querySelectorAll('img');
  const loadPromises = Array.from(imgElements).map(img => loadImage(img));
  return Promise.all(loadPromises);
}

/**
 * 更新提交按钮状态
 */
function updateSubmitButton() {
  const userInput = document.getElementById('my-extension-user-input');
  const submitButton = document.getElementById('my-extension-submit-btn');
  const previewArea = document.querySelector('.image-preview-area');
  const hasUploadedImages = previewArea.querySelectorAll('.uploaded-image-preview[data-uploaded-url]').length > 0;

  if (userInput.value.trim() !== '' || hasUploadedImages) {
    submitButton.disabled = false;
    submitButton.classList.remove('disabled');
  } else {
    submitButton.disabled = true;
    submitButton.classList.add('disabled');
  }
}

function toggleShortcutMenu(inputField, shortcutMenu) {
  if (inputField.value === '/') {
    shortcutMenu.style.display = 'block';
  } else {
    shortcutMenu.style.display = 'none';
  }
}

function handleUploadFiles(event) {
  var files = event.target.files;
  var previewArea = document.querySelector('.image-preview-area');
  const submitButton = document.getElementById('my-extension-submit-btn');

  // 禁用提交按钮
  submitButton.disabled = true;
  submitButton.classList.add('disabled');

  // 追踪未完成的上传数量
  let uploadCount = files.length;

  Array.from(files).forEach(file => {
    var imgContainer = document.createElement('div');
    imgContainer.classList.add('img-container');

    var img = document.createElement('img');
    img.classList.add('uploaded-image-preview');

    // 删除按钮
    var deleteBtn = document.getElementById('delete-icon-template').cloneNode(true);
    deleteBtn.style.display = 'block';
    deleteBtn.classList.add('delete-image-btn');
    deleteBtn.removeAttribute('id');
    deleteBtn.addEventListener('click', function () {
      previewArea.removeChild(imgContainer);
    });

    // 预览
    var reader = new FileReader();
    reader.onload = function (e) {
      if (file.type.startsWith('image/')) {
        img.src = e.target.result;
      } else {
        img.src = DEFAULT_FILE_LOGO_PATH;
      }
      img.setAttribute('data-base64', e.target.result);
      uploadCount--;
      if (uploadCount === 0) {
        updateSubmitButton();
      }
    };
    reader.readAsDataURL(file);

    imgContainer.appendChild(img);
    imgContainer.appendChild(deleteBtn);
    previewArea.appendChild(imgContainer);
  });

  // 清空文件输入
  var uploadInput = document.getElementById('image-upload');
  uploadInput.value = '';
  updateSubmitButton();
}


// 检测是否启用ollama，拉去ollama模型列表并追加到模型选择列表中
function loadOllamaModels(callback) {
  chrome.storage.local.get(OLLAMA_MODEL, function (result) {
    const modelInfo = result[OLLAMA_MODEL];
    if (modelInfo) {
      const baseUrl = modelInfo.baseUrl || OLLAMA_CHAT_BASE_URL;
      const apiUrl = baseUrl + OLLAMA_LIST_MODEL_PATH;
      fetch(apiUrl)
        .then(response => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error('Network response was not ok.');
          }
        })
        .then(data => {
          const models = data.models;
          const selection = document.getElementById('model-selection');
          models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.model + OLLAMA_MODEL_POSTFIX;
            option.textContent = model.name + OLLAMA_MODEL_POSTFIX;
            selection.appendChild(option);
          });
          if (callback) callback();
        })
        .catch(error => {
          if (callback) callback();
        });
    } else {
      if (callback) callback();
    }
  });
}


// 模型选择变更逻辑
function handleModelSelection() {
  const modelSelection = document.getElementById('model-selection');
  chrome.storage.local.get(['selectedModel'], function (result) {
    if (result.selectedModel) {
      modelSelection.value = result.selectedModel;
    }
    toggleImageUpload(modelSelection.value);
  });

  modelSelection.addEventListener('change', function () {
    toggleImageUpload(this.value);
    chrome.storage.local.set({ 'selectedModel': this.value });
  });
}


// 保存自定义模型参数
function saveModelParams() {
  const temperature = document.getElementById('temperature').value;
  const top_p = document.getElementById('top_p').value;
  const max_tokens = document.getElementById('max_tokens').value;
  const frequency_penalty = document.getElementById('frequency_penalty').value;
  const presence_penalty = document.getElementById('presence_penalty').value;

  chrome.storage.local.set({
    temperature: temperature,
    top_p: top_p,
    max_tokens: max_tokens,
    frequency_penalty: frequency_penalty,
    presence_penalty: presence_penalty
  }, function () {
    // console.log('model params saved');
  });
}


// 从chrome storage 加载自定义的模型参数
function loadModelParams() {
  chrome.storage.local.get(['temperature', 'top_p', 'max_tokens'], function (items) {
    if (items.temperature !== undefined) {
      document.getElementById('temperature').value = items.temperature;
    }
    if (items.top_p !== undefined) {
      document.getElementById('top_p').value = items.top_p;
    }
    if (items.max_tokens !== undefined) {
      document.getElementById('max_tokens').value = items.max_tokens;
    }
    if (items.frequency_penalty !== undefined) {
      document.getElementById('frequency_penalty').value = items.frequency_penalty;
    }
    if (items.max_tokens !== undefined) {
      document.getElementById('presence_penalty').value = items.presence_penalty;
    }
  });
}

function loadToolsSelectedStatus() {
  chrome.storage.local.get([SERPAPI, DALLE], (result) => {
    if (result.serpapi !== undefined) {
      document.getElementById(SERPAPI).checked = result.serpapi;
    }
    if (result.dalle !== undefined) {
      document.getElementById(DALLE).checked = result.dalle;
    }
  });
}

/**
 * 获取当前页面标题
 * @returns {Promise<string>}
 */
function getPageTitle() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getPageTitle" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.title) {
        resolve(response.title);
      } else {
        reject(new Error("Unable to get page title"));
      }
    });
  });
}

function updateModelSelection(globalModels) {
  const modelSelection = document.getElementById('model-selection');
  modelSelection.innerHTML = ''; // 清空现有选项

  console.log('Updating model selection with:', globalModels); // 添加日志

  // 按照特定顺序排列供应商
  const providerOrder = [
    'gpt',           // OpenAI
    'azure',         // Azure OpenAI
    'gemini',        // Google Gemini
    'anthropic',     // Anthropic (Claude)
    'siliconflow',   // Siliconflow AI
    'groq',          // Groq
    'mistral',       // Mistral AI
    'ollama'         // Ollama
  ];

  // 获取供应商的显示名称
  const providerDisplayName = {
    gpt: 'OpenAI',
    azure: 'Azure OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic',
    siliconflow: '硅基流动',
    groq: 'Groq',
    mistral: 'Mistral AI',
    ollama: 'Ollama'
  };

  // 按照指定顺序遍历供应商
  providerOrder.forEach(provider => {
    const models = globalModels[provider];
    if (models && models.length > 0) {
      console.log(`Adding models for provider ${provider}:`, models); // 添加日志

      // 创建分组
      const group = document.createElement('optgroup');
      group.label = providerDisplayName[provider] || provider.toUpperCase();

      // 添加该提供商的所有模型
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.value;
        group.appendChild(option);
      });

      modelSelection.appendChild(group);
    }
  });

  // 恢复之前选择的模型
  chrome.storage.local.get(['selectedModel'], function (result) {
    if (result.selectedModel) {
      modelSelection.value = result.selectedModel;
    }
  });
}

/**
 * 初始化结果页面
 */
function initResultPage() {
  // 加载全局模型列表
  chrome.storage.local.get('globalModels', function (result) {
    console.log('Loaded global models:', result.globalModels); // 添加日志
    if (result.globalModels) {
      updateModelSelection(result.globalModels);
    }
  });

  // 加载 Ollama 模型并处理模型选择
  loadOllamaModels(function () {
    handleModelSelection();
  });

  // 加载模型参数
  loadModelParams();

  // 加载工具选择状态
  loadToolsSelectedStatus();

  // 初始化按钮状态
  updateSubmitButton();

  // 检测输入框内容变化以更新提交按钮状态
  var userInput = document.getElementById('my-extension-user-input');
  userInput.addEventListener('input', updateSubmitButton);

  // 快捷输入
  const shortcutMenu = document.getElementById('shortcut-menu');
  userInput.addEventListener('input', function (e) {
    toggleShortcutMenu(userInput, shortcutMenu);
  });
  userInput.addEventListener('keydown', function (e) {
    if (e.key === '/' && userInput.value.length === 0) {
      toggleShortcutMenu(userInput, shortcutMenu);
    }
  });
  userInput.addEventListener('blur', function () {
    setTimeout(() => {
      shortcutMenu.style.display = 'none';
    }, 200); // delay to allow click event on menu items
  });
  const menuItems = shortcutMenu.querySelectorAll('div');
  menuItems.forEach(item => {
    item.addEventListener('click', function () {
      userInput.value = this.getAttribute('data-command');
      shortcutMenu.style.display = 'none';
      userInput.focus();
    });
  });

  // 模型参数设置
  const paramsBtn = document.getElementById('params-div');
  const modelParamsPopupDiv = document.getElementById('model-params');
  paramsBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    modelParamsPopupDiv.style.display = 'block';
    toolStorePopupDiv.style.display = 'none';
  });
  modelParamsPopupDiv.addEventListener('click', function (event) {
    event.stopPropagation(); // Prevent this click from triggering the document click event
  });

  // 保存模型参数设置
  document.getElementById('temperature').addEventListener('change', saveModelParams);
  document.getElementById('top_p').addEventListener('change', saveModelParams);
  document.getElementById('max_tokens').addEventListener('change', saveModelParams);

  // 工具箱
  const toolsBtn = document.getElementById('tools-div');
  const toolStorePopupDiv = document.getElementById('tool-store');
  toolsBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    toolStorePopupDiv.style.display = 'block';
    modelParamsPopupDiv.style.display = 'none';
  });

  // 保存工具选择状态
  const toolCheckboxes = document.querySelectorAll('#tool-store input[type="checkbox"]');
  toolCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const toolId = event.target.id;
      const isChecked = event.target.checked;

      let storageObject = {};
      storageObject[toolId] = isChecked;
      chrome.storage.local.set(storageObject, () => {
        // console.log(`Saved ${toolId} state: ${isChecked}`);
      });
    });
  });

  // 点击事件
  document.addEventListener('click', function (event) {
    if (!modelParamsPopupDiv.contains(event.target) && event.target !== paramsBtn) {
      modelParamsPopupDiv.style.display = 'none';
    }
    if (!toolStorePopupDiv.contains(event.target) && event.target !== toolsBtn) {
      toolStorePopupDiv.style.display = 'none';
    }
  });

  // 图片上传预览
  document.getElementById('image-upload').addEventListener('change', function (event) {
    handleUploadFiles(event);
  });

  // 粘贴
  document.addEventListener('paste', async (event) => {

    const modelSelection = document.getElementById('model-selection');
    const selectedModel = modelSelection.value;
    if (!IMAGE_SUPPORT_MODELS.includes(selectedModel)) {
      return;
    }

    const items = event.clipboardData.items;
    let files = [];
    for (let item of items) {
      if (item.type.startsWith('image')) {
        const file = item.getAsFile();
        files.push(file);
      }
    }
    if (files.length > 0) {
      handleUploadFiles({ target: { files: files } });
    }
  });

  // 清空历史记录逻辑
  var label = document.getElementById('newchat-label');
  label.addEventListener('click', function () {
    // 清空聊天记录
    const contentDiv = document.querySelector('.chat-content');
    contentDiv.innerHTML = '';
    // 清空上传图片预览界面
    const previewArea = document.querySelector('.image-preview-area');
    previewArea.innerHTML = '';
    // 清空历史记录
    initChatHistory();
    // 展示推荐内容
    showRecommandContent();
  });

  // 摘要逻辑
  var summaryButton = document.querySelector('#my-extension-summary-btn');
  summaryButton.addEventListener('click', async function () {
    const modelSelection = document.getElementById('model-selection');
    const model = modelSelection.value;
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }
    let inputText = '';
    const currentURL = await getCurrentURL();

    try {
      if (isVideoUrl(currentURL)) {
        // 视频摘要
        displayLoading('正在获取字幕...');
        inputText = await extractSubtitles(currentURL, FORMAT_TEXT);
      } else if (isPDFUrl(currentURL)) {
        // PDF摘要
        displayLoading('正在提取PDF内容...');
        inputText = await extractPDFText(currentURL);
      } else {
        // 网页摘要
        displayLoading('正在提取网页内容...');
        inputText = await fetchPageContent(FORMAT_TEXT);
      }
    } catch (error) {
      hiddenLoadding();
      console.error('智能摘要失败', error);
      displayErrorMessage(`智能摘要失败: ${error.message}`);
      return;
    }

    await clearAndGenerate(model, SUMMARY_PROMPT + inputText, null);
  });

  // 网页翻译
  var translateButton = document.querySelector('#my-extension-translate-btn');
  translateButton.addEventListener('click', async function () {
    const modelSelection = document.getElementById('model-selection');
    const model = modelSelection.value;
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }
    let inputText = '';
    const currentURL = await getCurrentURL();

    try {
      if (isVideoUrl(currentURL)) {
        // 视频翻译
        displayLoading('正在获取字幕...');
        inputText = await extractSubtitles(currentURL, FORMAT_TEXT);
      } else if (isPDFUrl(currentURL)) {
        // PDF 翻译
        displayLoading('正在提取PDF内容...');
        inputText = await extractPDFText(currentURL);
      } else {
        // 网页翻译
        displayLoading('正在提取网页内容...');
        inputText = await fetchPageContent();
      }
    } catch (error) {
      hiddenLoadding();
      console.error('网页翻译失败', error);
      displayErrorMessage(`网页翻译失败: ${error.message}`);
      return;
    }

    await clearAndGenerate(model, TRANSLATE2CHN_PROMPT + inputText, null);
  });

  // 视频翻译
  var videoTranslateButton = document.querySelector('#my-extension-videotrans-btn');
  videoTranslateButton.addEventListener('click', async function () {
    const modelSelection = document.getElementById('model-selection');
    const model = modelSelection.value;
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }
    const currentURL = await getCurrentURL();
    if (!isVideoUrl(currentURL)) {
      return;
    }

    let inputText = '';
    try {
      // 视频翻译
      displayLoading('正在获取字幕...');
      inputText = await extractSubtitles(currentURL, FORMAT_TEXT);
    } catch (error) {
      hiddenLoadding();
      console.error('视频翻译失败', error);
      displayErrorMessage(`视频翻译失败: ${error.message}`);
      return;
    }

    await clearAndGenerate(model, SUBTITLE2CHN_PROMPT + inputText, null);
  });


  // 停止生成逻辑
  var cancelBtn = document.querySelector('#my-extension-generate-btn');
  cancelBtn.addEventListener('click', function () {
    cancelRequest();
    showSubmitBtnAndHideGenBtn();
  });

  // 设置逻辑
  var settingsButton = document.querySelector('.my-extension-settings-btn');
  if (settingsButton) {
    settingsButton.addEventListener('click', function () {
      // 发送消息到background script打开新标签页
      chrome.runtime.sendMessage({ action: "openSettings" });
    });
  }

  // 分享逻辑
  var shareButton = document.querySelector('.my-extension-share-btn');
  if (shareButton) {
    shareButton.addEventListener('click', async function () {
      const contentDiv = document.querySelector('.my-extension-content');

      // 等待所有图片加载完成
      try {
        const chatDiv = document.querySelector('.chat-content');
        await loadAllImages(chatDiv);
      } catch (error) {
        console.error('Some images failed to load:', error);
        return;
      }

      // 保存原始样式
      var originalStyle = {
        height: contentDiv.style.height,
        width: contentDiv.style.width
      };

      const pageTitle = await getPageTitle();

      // Create a new div element off-screen
      const newDiv = document.createElement('div');
      newDiv.innerHTML = contentDiv.innerHTML;
      newDiv.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: ${contentDiv.offsetWidth}px;
        background-color: #FAF8F6;
        border-radius: 16px;
        padding: 15px 25px;
      `;

      // Remove the first h1 element (summary title)
      const firstH1 = newDiv.querySelector('h1');
      if (firstH1) {
        firstH1.remove();
      }
      // 添加标题
      const titleElement = document.createElement('h1');
      titleElement.textContent = pageTitle;
      titleElement.style.cssText = `
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 24px;
        font-weight: 600;
        color: #2c3e50;
        margin: 0 0 25px 0;
        padding: 20px 15px;
        text-align: center;
        letter-spacing: 0.5px;
        line-height: 1.4;
        max-width: 90%;
        margin-left: auto;
        margin-right: auto;
        border-bottom: 2px solid #ecf0f1;
        transition: all 0.3s ease;
      `;
      newDiv.insertBefore(titleElement, newDiv.firstChild);

      // 修改文本样式
      newDiv.querySelectorAll('p, li').forEach(element => {
        element.style.cssText = `
          font-family: 'Open Sans', Arial, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #34495e;
          margin-bottom: 12px;
        `;
      });

      // 加载二维码图片
      const qrCode = new Image();
      qrCode.src = chrome.runtime.getURL('images/chromestore.png');
      qrCode.onload = function () {
        const footerDiv = document.createElement('div');
        footerDiv.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 0;
          color: #333;
          font-size: 14px;
          margin-top: 20px;
          border-top: 1px solid #ddd;
        `;

        const explanationText = document.createElement('p');
        explanationText.textContent = '🐈 OrangeSideBar';
        explanationText.style.cssText = `
          margin: 0;
          color: #2c3e50;
          font-family: 'Roboto', sans-serif;
          font-size: 18px;
          font-weight: 500;
          letter-spacing: 0.7px;
          text-align: center;
        `;

        qrCode.style.width = '70px';
        qrCode.style.height = '70px';
        qrCode.style.marginLeft = '5px';

        const textQrWrapper = document.createElement('div');
        textQrWrapper.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        textQrWrapper.appendChild(explanationText);
        textQrWrapper.appendChild(qrCode);
        footerDiv.appendChild(textQrWrapper);

        newDiv.appendChild(footerDiv);

        // Append the new div to body
        document.body.appendChild(newDiv);

        // Render the new div
        html2canvas(newDiv, {
          backgroundColor: '#1F2937',
          useCORS: true
        }).then(canvas => {
          canvas.toBlob(function (blob) {
            var url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          }, 'image/png');
        }).catch(error => {
          console.error('Error rendering canvas:', error);
        }).finally(() => {
          // Remove the temporary div
          document.body.removeChild(newDiv);
        });
      };
    });
  }

  // 对话逻辑
  var userInput = document.getElementById('my-extension-user-input');
  var submitButton = document.getElementById('my-extension-submit-btn');
  if (submitButton) {
    submitButton.addEventListener('click', async function () {
      const modelSelection = document.getElementById('model-selection');
      const model = modelSelection.value;
      const apiKeyValid = await verifyApiKeyConfigured(model);
      if (!apiKeyValid) {
        return;
      }
      if (userInput.value.trim() !== '') {
        // 隐藏初始推荐内容
        hideRecommandContent();

        const inputText = userInput.value;

        // 获取图像url
        var images = document.querySelectorAll('.uploaded-image-preview');
        var base64Images = [];
        images.forEach(img => {
          var imageBase64 = img.getAttribute('data-base64');
          if (imageBase64) {
            base64Images.push(imageBase64);
          }
        });

        // 创建用户问题div
        const userQuestionDiv = document.createElement('div');
        userQuestionDiv.className = 'user-message';
        let userMessage = '';
        if (base64Images) {
          base64Images.forEach(url => {
            if (!url.includes('image')) {
              url = DEFAULT_FILE_LOGO_PATH;
            }
            userMessage += "<img src='" + url + "' />"
          });
        }
        userMessage += inputText;
        userQuestionDiv.innerHTML = userMessage;

        // Add edit button
        const editButton = document.createElement('button');
        editButton.className = 'edit-message-btn';
        editButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          `;
        editButton.onclick = () => editUserMessage(userQuestionDiv, inputText);
        userQuestionDiv.appendChild(editButton);

        const contentDiv = document.querySelector('.chat-content');
        contentDiv.appendChild(userQuestionDiv);

        // 构造content
        let newInputText = '';
        if (inputText.startsWith(SHORTCUT_SUMMAY)) {
          newInputText = SUMMARY_PROMPT + inputText.replace(SHORTCUT_SUMMAY, '');
        } else if (inputText.startsWith(SHORTCUT_DICTION)) {
          newInputText = DICTION_PROMPT + inputText.replace(SHORTCUT_DICTION, '');
        } else if (inputText.startsWith(SHORTCUT_TRANSLATION)) {
          newInputText = TRANSLATION_PROMPT + inputText.replace(SHORTCUT_TRANSLATION, '');
        } else if (inputText.startsWith(SHORTCUT_POLISH)) {
          newInputText = TEXT_POLISH_PROMTP + inputText.replace(SHORTCUT_POLISH, '');
        } else if (inputText.startsWith(SHORTCUT_CODE_EXPLAIN)) {
          newInputText = CODE_EXPLAIN_PROMTP + inputText.replace(SHORTCUT_CODE_EXPLAIN, '');
        } else if (inputText.startsWith(SHORTCUT_IMAGE2TEXT)) {
          newInputText = IMAGE2TEXT_PROMPT + inputText.replace(SHORTCUT_IMAGE2TEXT, '');
        } else {
          newInputText = inputText;
        }

        // 滚动到底部
        contentDiv.scrollTop = contentDiv.scrollHeight;

        // 清空输入框内容
        userInput.value = "";

        // 清空上传图片预览界面
        const previewArea = document.querySelector('.image-preview-area');
        previewArea.innerHTML = '';

        // AI 回答
        chatLLMAndUIUpdate(model, newInputText, base64Images);
      }
    });
  }

  // 使回车键触发提交按钮点击
  if (userInput) {
    userInput.addEventListener('keypress', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault(); // 阻止默认事件
        if (userInput.value.trim() !== '') {
          submitButton.click();
        }
      }
    });
  }
}


/**
 * 是否是视频页面
 * @returns
 */
function isVideoUrl(url) {
  const patterns = [
    /^https?:\/\/(?:www\.)?youtube\.com\/watch/, // 匹配 YouTube 观看页面
    /^https?:\/\/(?:www\.)?bilibili\.com\/video\//, // 匹配 Bilibili 视频页面
    /^https?:\/\/(?:www\.)?bilibili\.com\/list\/watchlater/ // 匹配 Bilibili 稍后再看页
  ];

  return patterns.some(pattern => pattern.test(url));
}

/**
 * 显示错误信息
 * @param {string} message
 */
function displayErrorMessage(message) {
  hideRecommandContent();
  const contentDiv = document.querySelector('.chat-content');
  contentDiv.innerHTML = `<div class="error-message">${message}</div>`;
}


/**
 * 主程序
 */
document.addEventListener('DOMContentLoaded', function () {
  initResultPage();
});


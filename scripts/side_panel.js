/**
 * 判断是否设置api key
 * @returns
 */
async function verifyApiKeyConfigured(model) {
  console.log('Verifying API key for model:', model);
  // 根据模型名称判断使用哪个供应商的配置
  let provider = '';

  // 先检查精确匹配的前缀
  const mapping = MODEL_MAPPINGS.find(m =>
    m.prefix.some(p => model.startsWith(p))
  );

  if (mapping) {
    provider = mapping.provider;
  } else if (model.includes(PROVIDERS.OLLAMA)) {
    provider = 'ollama';
  } else if (model.includes(PROVIDERS.GROQ)) {
    provider = 'groq';
  } else if (model.includes(PROVIDERS.SILICONFLOW)) {
    provider = 'siliconflow';
  } else if (model.includes(PROVIDERS.OPENROUTER)) {
    provider = 'openrouter';
  }

  const { baseUrl, apiKey } = await getBaseUrlAndApiKey(provider);

  console.log('Provider:', provider);
  console.log('Base URL:', baseUrl);
  console.log('API Key:', apiKey ? '已设置' : '未设置');

  // 检查是否需要 API Key（Ollama 不需要）
  const needsApiKey = !model.includes(PROVIDERS.OLLAMA);

  // 如果是 Claude 模型，使用 OpenAI 的 baseUrl
  let effectiveBaseUrl = baseUrl;

  // 获取供应商的显示名称
  const providerDisplayName = getProviderDisplayName(provider);

  // 检查配置是否完整
  if (effectiveBaseUrl == null || (needsApiKey && apiKey == null)) {
    // 隐藏初始推荐内容
    const sloganDiv = document.querySelector('.my-extension-slogan');
    sloganDiv.style.display = 'none';
    const featureDiv = document.querySelector('.feature-container');
    featureDiv.style.display = 'none';

    var contentDiv = document.querySelector('.chat-content');
    contentDiv.innerHTML = `请先去设置 ${providerDisplayName} Model 和 API KEY.<br><br>Note: API KEY仅缓存在 Chrome 本地存储空间，不会上传服务器，以保证安全和隐私.`;
    return false;
  }
  return true;
}

/**
 * 获取供应商的显示名称
 */
function getProviderDisplayName(provider) {
  return PROVIDER_DISPLAY_NAMES[provider] || provider.toUpperCase();
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
async function clearAndGenerate(model, inputText, base64Images, useKbContext = true) {
  // 隐藏初始推荐内容
  hideRecommandContent();

  // clean
  const contentDiv = document.querySelector('.chat-content');
  contentDiv.innerHTML = '';

  // generate
  await chatLLMAndUIUpdate(model, inputText, base64Images, null, useKbContext);
}

/**
 * 调用模型 & 更新ui
 * @param {string} model
 * @param {string} inputText
 * @param {Array} base64Images
 * @param {string} customSystemPrompt - 可选的自定义系统提示词
 */
async function chatLLMAndUIUpdate(model, inputText, base64Images, customSystemPrompt = null, useKbContext = true) {
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
    // 获取当前工具状态
    const tools = [];
    const webSearchBtn = document.querySelector('#web-search-label');
    if (webSearchBtn && webSearchBtn.classList.contains('active')) {
      // 只有当联网搜索按钮处于激活状态时，才添加搜索工具
      tools.push(WEB_SEARCH_TOOL);
    }

    // 知识库检索并拼接上下文（仅在允许时开启）
    const promptWithKb = useKbContext
      ? (await buildKbAugmentedPrompt(inputText)).text || inputText
      : inputText;

    const completeText = await chatWithLLM(
      model,
      promptWithKb,
      base64Images,
      CHAT_TYPE,
      tools,
      customSystemPrompt
    );
    createCopyButton(completeText);
    // 自动保存到知识库（如果已启用）
    await autoSaveIfEnabled(completeText, model);
  } catch (error) {
    hiddenLoadding();
    displayErrorMessage(`${error.message}`);
    console.error('请求异常:', error);
  } finally {
    showSubmitBtnAndHideGenBtn();
  }
}

/**
 * 生成复制按钮
 * @param {string} completeText
 */
function createCopyButton(completeText) {
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '12px';
  buttonContainer.style.alignItems = 'center';
  buttonContainer.style.justifyContent = 'flex-end';
  buttonContainer.style.marginTop = '15px';
  buttonContainer.style.padding = '8px 0';

  // 创建Save Note按钮（文字形式，融入现有设计风格）
  const saveNoteBtn = document.createElement('button');
  saveNoteBtn.textContent = 'Save Note';
  saveNoteBtn.style.cursor = 'pointer';
  saveNoteBtn.style.padding = '8px 14px';
  saveNoteBtn.style.fontSize = '13px';
  saveNoteBtn.style.border = 'none';
  saveNoteBtn.style.borderRadius = '0';
  saveNoteBtn.style.backgroundColor = 'transparent';
  saveNoteBtn.style.color = 'var(--text-secondary)';
  saveNoteBtn.style.transition = 'all 0.2s ease';
  saveNoteBtn.style.fontFamily = "'FZB', Arial, sans-serif";
  saveNoteBtn.style.fontWeight = '500';
  saveNoteBtn.style.boxShadow = 'none';

  // 添加悬停效果，透明背景下的颜色变化
  saveNoteBtn.addEventListener('mouseenter', function () {
    saveNoteBtn.style.color = 'var(--accent-color)';
    saveNoteBtn.style.transform = 'translateY(-1px)';
  });
  saveNoteBtn.addEventListener('mouseleave', function () {
    saveNoteBtn.style.color = 'var(--text-secondary)';
    saveNoteBtn.style.transform = 'translateY(0)';
  });

  saveNoteBtn.addEventListener('click', function () {
    saveNoteAsMarkdown(completeText);
  });

  // 创建保存到知识库按钮
  const saveToKbBtn = document.createElement('button');
  saveToKbBtn.textContent = '保存到知识库';
  saveToKbBtn.style.cursor = 'pointer';
  saveToKbBtn.style.padding = '8px 14px';
  saveToKbBtn.style.fontSize = '13px';
  saveToKbBtn.style.border = 'none';
  saveToKbBtn.style.borderRadius = '0';
  saveToKbBtn.style.backgroundColor = 'transparent';
  saveToKbBtn.style.color = 'var(--text-secondary)';
  saveToKbBtn.style.transition = 'all 0.2s ease';
  saveToKbBtn.style.fontFamily = "'FZB', Arial, sans-serif";
  saveToKbBtn.style.fontWeight = '500';
  saveToKbBtn.style.boxShadow = 'none';
  saveToKbBtn.title = '保存当前内容到知识库';

  saveToKbBtn.addEventListener('mouseenter', function () {
    saveToKbBtn.style.color = 'var(--accent-color)';
    saveToKbBtn.style.transform = 'translateY(-1px)';
  });
  saveToKbBtn.addEventListener('mouseleave', function () {
    saveToKbBtn.style.color = 'var(--text-secondary)';
    saveToKbBtn.style.transform = 'translateY(0)';
  });

  saveToKbBtn.addEventListener('click', async function () {
    await handleSaveToKnowledgeBase(completeText, saveToKbBtn);
  });

  // 创建复制按钮容器，透明背景
  const copyBtnContainer = document.createElement('div');
  copyBtnContainer.style.cursor = 'pointer';
  copyBtnContainer.style.padding = '8px';
  copyBtnContainer.style.borderRadius = '0';
  copyBtnContainer.style.transition = 'all 0.2s ease';
  copyBtnContainer.style.border = 'none';
  copyBtnContainer.style.backgroundColor = 'transparent';
  copyBtnContainer.style.boxShadow = 'none';
  copyBtnContainer.style.display = 'flex';
  copyBtnContainer.style.alignItems = 'center';
  copyBtnContainer.style.justifyContent = 'center';

  // 创建复制按钮
  const copySvg = document.querySelector('.icon-copy').cloneNode(true);
  copySvg.style.display = 'block';
  copySvg.style.width = '16px';
  copySvg.style.height = '16px';
  copySvg.style.stroke = 'var(--text-secondary)';
  copySvg.title = '复制';

  copyBtnContainer.addEventListener('mouseenter', function () {
    copySvg.style.stroke = 'var(--accent-color)';
    copyBtnContainer.style.transform = 'translateY(-1px)';
  });
  copyBtnContainer.addEventListener('mouseleave', function () {
    copySvg.style.stroke = 'var(--text-secondary)';
    copyBtnContainer.style.transform = 'translateY(0)';
  });

  copyBtnContainer.addEventListener('click', function () {
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

  // 将复制SVG添加到容器
  copyBtnContainer.appendChild(copySvg);

  // 将按钮添加到主容器
  buttonContainer.appendChild(saveNoteBtn);
  buttonContainer.appendChild(saveToKbBtn);
  buttonContainer.appendChild(copyBtnContainer);

  const contentDiv = document.querySelector('.chat-content');
  let lastDiv = contentDiv.lastElementChild;
  lastDiv.appendChild(buttonContainer);

  // 渲染数学公式
  renderKatexMath(lastDiv);
}

/**
 * 渲染数学公式
 * @param {HTMLElement} element 需要渲染的元素
 */
function renderKatexMath(element) {
  if (typeof window.renderMathInElement === 'function') {
    try {
      // 使用KaTeX自动渲染函数
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false,
        errorColor: '#f00',
        strict: false,
        trust: true,
        macros: {
          // 添加常用宏，帮助修复一些常见错误
          "\\E": "\\mathbb{E}"
        }
      });
    } catch (e) {
      console.error("KaTeX rendering error:", e);
    }
  }
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
 * 设置图像上传控件
 */
function toggleImageUpload() {
  const imageUploadDiv = document.getElementById('image-upload-div');
  const imageUpload = document.getElementById('image-upload');
  const imageUploadLabel = document.getElementById('image-upload-label');

  // 始终启用上传区域
  imageUploadDiv.style.opacity = '1';
  imageUpload.disabled = false;
  imageUploadLabel.style.pointerEvents = 'auto';

  // 接受所有文件类型
  imageUpload.removeAttribute('accept');
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
    setTimeout(() => {
      shortcutMenu.classList.add('show');
    }, 10);
  } else {
    shortcutMenu.classList.remove('show');
    setTimeout(() => {
      shortcutMenu.style.display = 'none';
    }, 300);
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
  chrome.storage.local.get(PROVIDERS.OLLAMA, function (result) {
    const modelInfo = result[PROVIDERS.OLLAMA];
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
          // 将 Ollama 模型添加到全局数组
          models.forEach(model => {
            const displayName = `OLLAMA - ${model.name}${OLLAMA_MODEL_POSTFIX}`;
            allModels.push({
              value: model.model + OLLAMA_MODEL_POSTFIX,
              name: displayName,
              provider: 'ollama'
            });
          });
          
          // 如果全局数组已有数据，刷新显示
          if (allModels.length > 0) {
            filterAndDisplayModels('');
          }
          
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


// 全局变量存储模型数据
let allModels = [];
let selectedModel = '';
// 知识库问答配置
const KB_TOP_K = 5;
let kbRetrievalEnabled = false;
let kbRetrievalCollections = [];

// 双栏模式状态管理对象
const DualColumnState = {
  isActive: false,
  leftModel: '',
  rightModel: '',
  leftHistory: [],
  rightHistory: [],
  leftGeminiHistory: [],
  rightGeminiHistory: [],

  // 初始化双栏状态
  init() {
    this.isActive = false;
    this.leftModel = '';
    this.rightModel = '';
    this.leftHistory = [];
    this.rightHistory = [];
    this.leftGeminiHistory = [];
    this.rightGeminiHistory = [];
  },

  // 激活双栏模式
  activate() {
    this.isActive = true;
  },

  // 关闭双栏模式
  deactivate() {
    this.isActive = false;
  },

  // 设置栏位模型
  setModel(column, model) {
    if (column === 'left') {
      this.leftModel = model;
    } else if (column === 'right') {
      this.rightModel = model;
    }
  },

  // 获取栏位模型
  getModel(column) {
    return column === 'left' ? this.leftModel : this.rightModel;
  },

  // 获取栏位对话历史
  getHistory(column) {
    return column === 'left' ? this.leftHistory : this.rightHistory;
  },

  // 获取栏位Gemini对话历史
  getGeminiHistory(column) {
    return column === 'left' ? this.leftGeminiHistory : this.rightGeminiHistory;
  },

  // 清空所有历史
  clearAllHistory() {
    this.leftHistory = [];
    this.rightHistory = [];
    this.leftGeminiHistory = [];
    this.rightGeminiHistory = [];
  },

  // 保存状态到存储
  async saveToStorage() {
    const stateData = {
      layoutMode: this.isActive ? 'dual' : 'single',
      leftColumnModel: this.leftModel,
      rightColumnModel: this.rightModel
    };
    return chrome.storage.local.set(stateData);
  },

  // 从存储加载状态
  async loadFromStorage() {
    const result = await chrome.storage.local.get(['layoutMode', 'leftColumnModel', 'rightColumnModel']);
    
    this.isActive = result.layoutMode === 'dual';
    this.leftModel = result.leftColumnModel || '';
    this.rightModel = result.rightColumnModel || '';
    
    return result;
  }
};

// 保持向后兼容的全局变量（将逐步移除）
let isDualColumnMode = false;
let leftColumnModel = '';
let rightColumnModel = '';
let leftDialogueHistory = [];
let rightDialogueHistory = [];
let leftGeminiDialogueHistory = [];
let rightGeminiDialogueHistory = [];

// 模型选择变更逻辑
function handleModelSelection() {
  initModelSearchDropdown();
  
  chrome.storage.local.get(['selectedModel'], function (result) {
    if (result.selectedModel) {
      selectedModel = result.selectedModel;
      updateSelectedModel(result.selectedModel);
    }
    toggleImageUpload();
  });
}

// 初始化模型搜索下拉框
function initModelSearchDropdown() {
  const searchInput = document.getElementById('model-search');
  const dropdown = document.getElementById('model-dropdown');
  const wrapper = document.getElementById('model-selection-wrapper');
  
  // 搜索输入事件
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    filterAndDisplayModels(query);
    showDropdown();
  });

  // 点击输入框显示下拉
  searchInput.addEventListener('click', function() {
    filterAndDisplayModels('');
    showDropdown();
  });

  // 点击外部隐藏下拉
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      hideDropdown();
    }
  });

  // 键盘导航
  searchInput.addEventListener('keydown', function(e) {
    const items = dropdown.querySelectorAll('.model-option');
    const activeItem = dropdown.querySelector('.model-option.active');
    let activeIndex = activeItem ? Array.from(items).indexOf(activeItem) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      setActiveItem(items, activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      setActiveItem(items, activeIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeItem) {
        const model = allModels.find(m => m.value === activeItem.dataset.value);
        if (model) {
          selectModel(activeItem.dataset.value, model.name);
        }
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });
}

// 过滤并显示模型（支持分组）
function filterAndDisplayModels(query) {
  const dropdown = document.getElementById('model-dropdown');
  dropdown.innerHTML = '';
  
  // 按供应商分组过滤模型
  const groupedModels = {};
  const filteredModels = allModels.filter(model => 
    model.name.toLowerCase().includes(query) || 
    model.value.toLowerCase().includes(query)
  );

  // 将过滤后的模型按供应商重新分组
  filteredModels.forEach(model => {
    if (!groupedModels[model.provider]) {
      groupedModels[model.provider] = [];
    }
    groupedModels[model.provider].push(model);
  });

  if (filteredModels.length === 0) {
    dropdown.innerHTML = '<div class="model-no-results">未找到匹配的模型</div>';
    return;
  }

  let activeIndex = 0;
  let totalItems = 0;

  // 使用 constants.js 中的供应商顺序和显示名称
  const providerOrder = Object.values(PROVIDERS);
  const providerDisplayName = PROVIDER_DISPLAY_NAMES;

  providerOrder.forEach(provider => {
    const models = groupedModels[provider];
    if (models && models.length > 0) {
      // 添加分组标题
      const groupTitle = document.createElement('div');
      groupTitle.className = 'model-group-title';
      groupTitle.textContent = providerDisplayName[provider] || provider.toUpperCase();
      dropdown.appendChild(groupTitle);

      // 添加该分组的模型选项
      models.forEach((model, index) => {
        const item = document.createElement('div');
        item.className = 'model-option';
        if (totalItems === 0) item.classList.add('active');
        item.dataset.value = model.value;
        // 显示时去掉供应商前缀，因为已经有分组标题了
        const displayName = model.name.replace(/^[A-Z]+ - /, '');
        item.textContent = displayName;
        
        item.addEventListener('click', function() {
          selectModel(model.value, model.name);
        });
        
        dropdown.appendChild(item);
        totalItems++;
      });
    }
  });
}

// 设置激活项（跳过分组标题）
function setActiveItem(items, index) {
  items.forEach(item => item.classList.remove('active'));
  if (items[index]) {
    items[index].classList.add('active');
    items[index].scrollIntoView({ block: 'nearest' });
  }
}

// 选择模型（改进显示名称处理）
function selectModel(value, displayName) {
  selectedModel = value;
  const searchInput = document.getElementById('model-search');
  // 使用完整的显示名称（包含供应商信息）
  const fullDisplayName = allModels.find(m => m.value === value)?.name || displayName;
  searchInput.value = fullDisplayName;
  hideDropdown();
  toggleImageUpload();
  chrome.storage.local.set({ 'selectedModel': value });
}

// 更新选中的模型显示（改进）
function updateSelectedModel(value) {
  const model = allModels.find(m => m.value === value);
  if (model) {
    const searchInput = document.getElementById('model-search');
    searchInput.value = model.name;
  }
}

// 显示下拉
function showDropdown() {
  const dropdown = document.getElementById('model-dropdown');
  dropdown.style.display = 'block';
}

// 隐藏下拉
function hideDropdown() {
  const dropdown = document.getElementById('model-dropdown');
  dropdown.style.display = 'none';
}

/**
 * 切换单栏/双栏模式（修复版本 - 移除状态覆盖问题）
 */
function toggleLayoutMode() {
  // 切换状态
  if (DualColumnState.isActive) {
    DualColumnState.deactivate();
  } else {
    DualColumnState.activate();
  }
  
  isDualColumnMode = DualColumnState.isActive; // 保持向后兼容
  
  const singleLayout = document.getElementById('single-layout');
  const dualLayout = document.getElementById('dual-layout');
  const layoutToggleBtn = document.getElementById('layout-toggle-label');
  
  if (DualColumnState.isActive) {
    // 切换到双栏模式
    if (singleLayout) singleLayout.style.display = 'none';
    if (dualLayout) dualLayout.style.display = 'block';
    if (layoutToggleBtn) layoutToggleBtn.classList.add('active');
    
    // 直接初始化双栏模型选择器（使用DualColumnState中已有的选择）
    if (allModels.length > 0) {
      initDualColumnModelSelectors();
    } else {
      // 如果模型还没加载，等待一下
      setTimeout(() => {
        if (allModels.length > 0) {
          initDualColumnModelSelectors();
        }
      }, 500);
    }
    
    // 清空双栏的聊天内容
    const leftContent = document.getElementById('left-chat-content');
    const rightContent = document.getElementById('right-chat-content');
    if (leftContent) leftContent.innerHTML = '';
    if (rightContent) rightContent.innerHTML = '';
    
    // 清空聊天历史
    DualColumnState.clearAllHistory();
    
    // 保持向后兼容
    leftDialogueHistory = [];
    rightDialogueHistory = [];
    leftGeminiDialogueHistory = [];
    rightGeminiDialogueHistory = [];
    
  } else {
    // 切换到单栏模式
    if (singleLayout) singleLayout.style.display = 'block';
    if (dualLayout) dualLayout.style.display = 'none';
    if (layoutToggleBtn) layoutToggleBtn.classList.remove('active');
    
    // 显示推荐内容
    showRecommandContent();
  }
  
  // 保存布局偏好
  DualColumnState.saveToStorage();
}

/**
 * 初始化双栏模型选择器（修复版本 - 优先使用保存的选择）
 */
function initDualColumnModelSelectors() {
  // 为左栏初始化模型选择器
  initColumnModelSelector('left');
  
  // 为右栏初始化模型选择器
  initColumnModelSelector('right');
  
  // 设置模型选择 - 优先使用保存的选择
  if (allModels.length > 0) {
    // 左栏模型：优先使用 DualColumnState 中保存的，然后是全局变量，最后是默认值
    if (DualColumnState.leftModel) {
      leftColumnModel = DualColumnState.leftModel;
    } else if (!leftColumnModel) {
      leftColumnModel = selectedModel || allModels[0].value;
      DualColumnState.setModel('left', leftColumnModel);
    }
    updateColumnModelDisplay('left', leftColumnModel);
    
    // 右栏模型：优先使用 DualColumnState 中保存的，然后是全局变量，最后是默认值
    if (DualColumnState.rightModel) {
      rightColumnModel = DualColumnState.rightModel;
    } else if (!rightColumnModel) {
      rightColumnModel = allModels.length > 1 ? allModels[1].value : leftColumnModel;
      DualColumnState.setModel('right', rightColumnModel);
    }
    updateColumnModelDisplay('right', rightColumnModel);
    
    // 保存当前状态
    DualColumnState.saveToStorage();
  }
}

/**
 * 初始化指定栏的模型选择器
 */
function initColumnModelSelector(column) {
  const searchInput = document.getElementById(`model-search-${column}`);
  const dropdown = document.getElementById(`model-dropdown-${column}`);
  const wrapper = document.getElementById(`model-selection-wrapper-${column}`);
  
  if (!searchInput || !dropdown || !wrapper) return;
  
  // 搜索输入事件
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    filterAndDisplayModelsForColumn(column, query);
    showColumnDropdown(column);
  });

  // 点击输入框显示下拉
  searchInput.addEventListener('click', function() {
    filterAndDisplayModelsForColumn(column, '');
    showColumnDropdown(column);
  });

  // 键盘导航
  searchInput.addEventListener('keydown', function(e) {
    const items = dropdown.querySelectorAll('.model-option');
    const activeItem = dropdown.querySelector('.model-option.active');
    let activeIndex = activeItem ? Array.from(items).indexOf(activeItem) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      setActiveItem(items, activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      setActiveItem(items, activeIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeItem) {
        const model = allModels.find(m => m.value === activeItem.dataset.value);
        if (model) {
          selectColumnModel(column, activeItem.dataset.value, model.name);
        }
      }
    } else if (e.key === 'Escape') {
      hideColumnDropdown(column);
    }
  });
  
  // 点击外部隐藏下拉
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      hideColumnDropdown(column);
    }
  });
  
  // 窗口滚动和大小改变时重新定位下拉菜单
  window.addEventListener('scroll', function() {
    if (dropdown.style.display === 'block') {
      showColumnDropdown(column);
    }
  });
  
  window.addEventListener('resize', function() {
    if (dropdown.style.display === 'block') {
      showColumnDropdown(column);
    }
  });
}

/**
 * 为指定栏过滤并显示模型
 */
function filterAndDisplayModelsForColumn(column, query) {
  const dropdown = document.getElementById(`model-dropdown-${column}`);
  dropdown.innerHTML = '';
  
  // 按供应商分组过滤模型
  const groupedModels = {};
  const filteredModels = allModels.filter(model => 
    model.name.toLowerCase().includes(query) || 
    model.value.toLowerCase().includes(query)
  );

  // 将过滤后的模型按供应商重新分组
  filteredModels.forEach(model => {
    if (!groupedModels[model.provider]) {
      groupedModels[model.provider] = [];
    }
    groupedModels[model.provider].push(model);
  });

  if (filteredModels.length === 0) {
    dropdown.innerHTML = '<div class="model-no-results">未找到匹配的模型</div>';
    return;
  }

  // 使用 constants.js 中的供应商顺序和显示名称
  const providerOrder = Object.values(PROVIDERS);
  const providerDisplayName = PROVIDER_DISPLAY_NAMES;

  providerOrder.forEach(provider => {
    const models = groupedModels[provider];
    if (models && models.length > 0) {
      // 添加分组标题
      const groupTitle = document.createElement('div');
      groupTitle.className = 'model-group-title';
      groupTitle.textContent = providerDisplayName[provider] || provider.toUpperCase();
      dropdown.appendChild(groupTitle);

      // 添加该分组的模型选项
      models.forEach((model, index) => {
        const item = document.createElement('div');
        item.className = 'model-option';
        if (dropdown.children.length === 1) item.classList.add('active'); // 第一个选项激活
        item.dataset.value = model.value;
        // 显示时去掉供应商前缀，因为已经有分组标题了
        const displayName = model.name.replace(/^[A-Z]+ - /, '');
        item.textContent = displayName;
        
        item.addEventListener('click', function() {
          selectColumnModel(column, model.value, model.name);
        });
        
        dropdown.appendChild(item);
      });
    }
  });
}

/**
 * 选择指定栏的模型（使用新状态管理）
 */
function selectColumnModel(column, value, displayName) {
  const searchInput = document.getElementById(`model-search-${column}`);
  const fullDisplayName = allModels.find(m => m.value === value)?.name || displayName;
  
  searchInput.value = fullDisplayName;
  hideColumnDropdown(column);
  
  // 更新状态管理对象
  DualColumnState.setModel(column, value);
  
  // 保持向后兼容
  if (column === 'left') {
    leftColumnModel = value;
  } else {
    rightColumnModel = value;
  }
  
  // 保存状态
  DualColumnState.saveToStorage();
}

/**
 * 更新指定栏的模型显示
 */
function updateColumnModelDisplay(column, value) {
  const model = allModels.find(m => m.value === value);
  if (model) {
    const searchInput = document.getElementById(`model-search-${column}`);
    if (searchInput) {
      searchInput.value = model.name;
    }
  }
}

/**
 * 显示指定栏的下拉菜单
 */
function showColumnDropdown(column) {
  const dropdown = document.getElementById(`model-dropdown-${column}`);
  const wrapper = document.getElementById(`model-selection-wrapper-${column}`);
  if (dropdown && wrapper) {
    // 获取wrapper的位置信息
    const rect = wrapper.getBoundingClientRect();
    
    // 设置下拉菜单的位置
    dropdown.style.display = 'block';
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 2) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.zIndex = '999999999';
  }
}

/**
 * 隐藏指定栏的下拉菜单
 */
function hideColumnDropdown(column) {
  const dropdown = document.getElementById(`model-dropdown-${column}`);
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

// 获取当前选中的模型（用于替换原来的model-selection.value调用）
function getSelectedModel() {
  return selectedModel;
}

/**
 * 在双栏模式下同时调用两个模型并更新UI
 */
async function dualColumnChatLLMAndUIUpdate(inputText, base64Images, customSystemPrompt = null, useKbContext = true) {
  if (!leftColumnModel || !rightColumnModel) {
    displayErrorMessage('请为两个栏位选择模型');
    return;
  }

  // 显示加载状态
  displayLoading();
  hideSubmitBtnAndShowGenBtn();

  // 创建用户消息显示到两栏
  const leftContentDiv = document.getElementById('left-chat-content');
  const rightContentDiv = document.getElementById('right-chat-content');
  
  // 创建左栏用户消息
  const leftUserDiv = createUserMessageDiv(inputText, base64Images);
  leftContentDiv.appendChild(leftUserDiv);
  
  // 创建右栏用户消息
  const rightUserDiv = createUserMessageDiv(inputText, base64Images);
  rightContentDiv.appendChild(rightUserDiv);

  // 创建AI回答容器
  const leftAiMessageDiv = document.createElement('div');
  leftAiMessageDiv.className = 'ai-message';
  leftContentDiv.appendChild(leftAiMessageDiv);
  
  const rightAiMessageDiv = document.createElement('div');
  rightAiMessageDiv.className = 'ai-message';
  rightContentDiv.appendChild(rightAiMessageDiv);

  try {
    // 获取当前工具状态
    const tools = [];
    const webSearchBtn = document.querySelector('#web-search-label');
    if (webSearchBtn && webSearchBtn.classList.contains('active')) {
      tools.push(WEB_SEARCH_TOOL);
    }

    // 知识库上下文
    const promptForLLM = useKbContext
      ? (await buildKbAugmentedPrompt(inputText)).text || inputText
      : inputText;

    // 异步并行启动两个流式输出
    const leftPromise = streamingChatForColumn('left', leftColumnModel, leftAiMessageDiv, promptForLLM, base64Images, tools, customSystemPrompt);
    const rightPromise = streamingChatForColumn('right', rightColumnModel, rightAiMessageDiv, promptForLLM, base64Images, tools, customSystemPrompt);

    // 等待两个流式输出都完成（独立进行，不会互相阻塞）
    await Promise.allSettled([leftPromise, rightPromise]);

    // 滚动到底部
    leftContentDiv.scrollTop = leftContentDiv.scrollHeight;
    rightContentDiv.scrollTop = rightContentDiv.scrollHeight;

  } catch (error) {
    hiddenLoadding(); // 确保在错误时也隐藏加载提示
    console.error('双栏请求异常:', error);
    leftAiMessageDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
    rightAiMessageDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  } finally {
    showSubmitBtnAndHideGenBtn();
  }
}

/**
 * 为指定栏进行流式输出聊天（重构版本 - 使用通用处理器）
 */
async function streamingChatForColumn(column, model, aiMessageDiv, inputText, base64Images, tools = [], customSystemPrompt = null) {
  // 设置对应栏的对话历史
  const originalDialogueHistory = dialogueHistory;
  const originalGeminiDialogueHistory = geminiDialogueHistory;
  
  if (column === 'left') {
    dialogueHistory = leftDialogueHistory;
    geminiDialogueHistory = leftGeminiDialogueHistory;
  } else {
    dialogueHistory = rightDialogueHistory;
    geminiDialogueHistory = rightGeminiDialogueHistory;
  }

  try {
    var { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);

    if (!baseUrl) {
      throw new Error('模型 ' + model + ' 的 API 代理地址为空，请检查！');
    }

    if (!apiKey) {
      throw new Error('模型 ' + model + ' 的 API Key 为空，请检查！');
    }

    // 获取要使用的系统提示词
    let systemPromptToUse = customSystemPrompt;
    if (!systemPromptToUse) {
      const promptModeResult = await new Promise(resolve => {
        chrome.storage.local.get(['promptMode'], resolve);
      });
      const currentMode = promptModeResult.promptMode || 'default';

      if (currentMode === 'paper') {
        systemPromptToUse = PAPER_SYSTEM_PROMPT;
      } else if (currentMode === 'learning') {
        const learningModePromptResult = await new Promise(resolve => {
          chrome.storage.local.get(['learningModePrompt'], resolve);
        });
        systemPromptToUse = learningModePromptResult.learningModePrompt || LEARNING_MODE_PROMPT;
      } else {
        const defaultSystemPromptResult = await new Promise(resolve => {
          chrome.storage.local.get(['defaultSystemPrompt'], resolve);
        });
        systemPromptToUse = defaultSystemPromptResult.defaultSystemPrompt || SYSTEM_PROMPT;
      }
    }

    // 使用通用的流式输出处理器，根据模型类型路由
    const config = {
      column,
      model,
      baseUrl,
      apiKey,
      aiMessageDiv,
      inputText,
      base64Images,
      systemPrompt: systemPromptToUse,
      tools
    };

    if (model.includes(PROVIDERS.GEMINI)) {
      await universalStreamingChat(config, 'gemini');
    } else if (model.includes(PROVIDERS.ANTHROPIC)) {
      await universalStreamingChat(config, 'anthropic');
    } else {
      await universalStreamingChat(config, 'openai');
    }

  } catch (error) {
    aiMessageDiv.innerHTML = `<div class="error-message">${column === 'left' ? '左' : '右'}栏模型请求失败: ${error.message}</div>`;
    throw error;
  } finally {
    // 恢复原始对话历史
    dialogueHistory = originalDialogueHistory;
    geminiDialogueHistory = originalGeminiDialogueHistory;
  }
}

/**
 * 通用流式输出处理器
 * @param {Object} config 配置对象，包含所有必需的参数
 * @param {string} provider 提供商类型：'openai'、'gemini'、'anthropic'
 */
async function universalStreamingChat(config, provider) {
  const { column, model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools } = config;

  // 根据提供商类型选择对应的处理器
  switch (provider) {
    case 'openai':
      return await handleOpenAIStream(config);
    case 'gemini':
      return await handleGeminiStream(config);
    case 'anthropic':
      return await handleAnthropicStream(config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * 处理OpenAI格式的流式输出
 */
async function handleOpenAIStream({ model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools }) {
  const messages = [];
  
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  dialogueHistory.forEach(item => {
    messages.push({
      role: 'user',
      content: item.user
    });
    messages.push({
      role: 'assistant', 
      content: item.assistant
    });
  });

  const userMessage = { role: 'user', content: inputText };
  if (base64Images && base64Images.length > 0) {
    userMessage.content = [
      { type: 'text', text: inputText },
      ...base64Images.map(base64 => ({
        type: 'image_url',
        image_url: { url: base64 }
      }))
    ];
  }
  messages.push(userMessage);

  const requestBody = {
    model: model,
    messages: messages,
    stream: true,
    temperature: parseFloat(document.getElementById('temperature')?.value) || 0.7
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeText = '';
  let buffer = '';
  let hasStartedOutput = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              if (!hasStartedOutput) {
                hasStartedOutput = true;
                hiddenLoadding();
              }
              
              completeText += delta;
              aiMessageDiv.innerHTML = marked.parse(completeText);
              aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
            }
          } catch (e) {
            console.log('解析响应失败:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  dialogueHistory.push({
    user: inputText,
    assistant: completeText
  });

  aiMessageDiv.innerHTML = marked.parse(completeText);
  createCopyButtonForColumn(completeText, aiMessageDiv);
  renderKatexMath(aiMessageDiv);
}

/**
 * 处理Gemini格式的流式输出
 */
async function handleGeminiStream({ model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools }) {
  const messages = [];
  
  let firstUserContent = systemPrompt ? `${systemPrompt}\n\n${inputText}` : inputText;
  
  geminiDialogueHistory.forEach(item => {
    messages.push({
      role: 'user',
      parts: [{ text: item.user }]
    });
    messages.push({
      role: 'model',
      parts: [{ text: item.assistant }]
    });
  });

  const userParts = [{ text: firstUserContent }];
  if (base64Images && base64Images.length > 0) {
    base64Images.forEach(base64 => {
      const mimeType = base64.split(';')[0].split(':')[1];
      const base64Data = base64.split(',')[1];
      userParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    });
  }
  
  messages.push({
    role: 'user',
    parts: userParts
  });

  const requestBody = {
    contents: messages,
    generationConfig: {
      temperature: parseFloat(document.getElementById('temperature')?.value) || 0.7
    }
  };

  const apiPath = GEMINI_CHA_API_PATH.replace('{MODEL_NAME}', model).replace('{API_KEY}', apiKey);
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeText = '';
  let buffer = '';
  let hasStartedOutput = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (delta) {
            if (!hasStartedOutput) {
              hasStartedOutput = true;
              hiddenLoadding();
            }
            
            completeText += delta;
            aiMessageDiv.innerHTML = marked.parse(completeText);
            aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
          }
        } catch (e) {
          console.log('解析Gemini响应失败:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  geminiDialogueHistory.push({
    user: inputText,
    assistant: completeText
  });

  aiMessageDiv.innerHTML = marked.parse(completeText);
  createCopyButtonForColumn(completeText, aiMessageDiv);
  renderKatexMath(aiMessageDiv);
}

/**
 * 处理Anthropic格式的流式输出
 */
async function handleAnthropicStream({ model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools }) {
  const messages = [];
  
  dialogueHistory.forEach(item => {
    messages.push({
      role: 'user',
      content: item.user
    });
    messages.push({
      role: 'assistant',
      content: item.assistant
    });
  });

  const userMessage = { role: 'user', content: inputText };
  if (base64Images && base64Images.length > 0) {
    userMessage.content = [
      { type: 'text', text: inputText },
      ...base64Images.map(base64 => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: base64.split(';')[0].split(':')[1],
          data: base64.split(',')[1]
        }
      }))
    ];
  }
  messages.push(userMessage);

  const requestBody = {
    model: model,
    messages: messages,
    stream: true,
    max_tokens: 4096,
    temperature: parseFloat(document.getElementById('temperature')?.value) || 0.7
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeText = '';
  let buffer = '';
  let hasStartedOutput = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              if (!hasStartedOutput) {
                hasStartedOutput = true;
                hiddenLoadding();
              }
              
              completeText += parsed.delta.text;
              aiMessageDiv.innerHTML = marked.parse(completeText);
              aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
            }
          } catch (e) {
            console.log('解析Anthropic响应失败:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  dialogueHistory.push({
    user: inputText,
    assistant: completeText
  });

  aiMessageDiv.innerHTML = marked.parse(completeText);
  createCopyButtonForColumn(completeText, aiMessageDiv);
  renderKatexMath(aiMessageDiv);
}


/**
 * Gemini模型的流式输出（双栏版本）
 */
async function streamingChatWithGeminiForColumn(column, model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools) {
  // 构建Gemini消息格式
  const messages = [];
  
  // 添加系统提示词到第一条消息
  let firstUserContent = systemPrompt ? `${systemPrompt}\n\n${inputText}` : inputText;
  
  // 添加历史对话
  geminiDialogueHistory.forEach(item => {
    messages.push({
      role: 'user',
      parts: [{ text: item.user }]
    });
    messages.push({
      role: 'model',
      parts: [{ text: item.assistant }]
    });
  });

  // 添加当前用户输入
  const userParts = [{ text: firstUserContent }];
  if (base64Images && base64Images.length > 0) {
    base64Images.forEach(base64 => {
      const mimeType = base64.split(';')[0].split(':')[1];
      const base64Data = base64.split(',')[1];
      userParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    });
  }
  
  messages.push({
    role: 'user',
    parts: userParts
  });

  // 构建请求体
  const requestBody = {
    contents: messages,
    generationConfig: {
      temperature: parseFloat(document.getElementById('temperature')?.value) || 0.7
    }
  };

  // 发送流式请求
  const apiPath = GEMINI_CHA_API_PATH.replace('{MODEL_NAME}', model).replace('{API_KEY}', apiKey);
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeText = '';
  let buffer = '';
  let hasStartedOutput = false; // 跟踪是否已开始输出

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (delta) {
            // 第一次收到内容时隐藏加载提示
            if (!hasStartedOutput) {
              hasStartedOutput = true;
              hiddenLoadding();
            }
            
            completeText += delta;
            // 实时更新UI
            aiMessageDiv.innerHTML = marked.parse(completeText);
            // 滚动到底部
            aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
          }
        } catch (e) {
          console.log('解析Gemini响应失败:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 添加到对话历史
  geminiDialogueHistory.push({
    user: inputText,
    assistant: completeText
  });

  // 最终渲染和处理
  aiMessageDiv.innerHTML = marked.parse(completeText);
  createCopyButtonForColumn(completeText, aiMessageDiv);
  renderKatexMath(aiMessageDiv);
}

/**
 * Anthropic模型的流式输出（双栏版本）
 */
async function streamingChatWithAnthropicForColumn(column, model, baseUrl, apiKey, aiMessageDiv, inputText, base64Images, systemPrompt, tools) {
  // 构建Anthropic消息格式
  const messages = [];
  
  // 添加历史对话
  dialogueHistory.forEach(item => {
    messages.push({
      role: 'user',
      content: item.user
    });
    messages.push({
      role: 'assistant',
      content: item.assistant
    });
  });

  // 添加当前用户输入
  const userMessage = { role: 'user', content: inputText };
  if (base64Images && base64Images.length > 0) {
    userMessage.content = [
      { type: 'text', text: inputText },
      ...base64Images.map(base64 => {
        const mimeType = base64.split(';')[0].split(':')[1];
        const base64Data = base64.split(',')[1];
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data
          }
        };
      })
    ];
  }
  messages.push(userMessage);

  // 构建请求体
  const requestBody = {
    model: model,
    messages: messages,
    stream: true,
    max_tokens: parseInt(document.getElementById('max_tokens')?.value) || 1024,
    temperature: parseFloat(document.getElementById('temperature')?.value) || 0.7
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  // 发送流式请求 - 修复：baseUrl已经包含完整路径
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeText = '';
  let buffer = '';
  let hasStartedOutput = false; // 跟踪是否已开始输出

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            // 第一次收到内容时隐藏加载提示
            if (!hasStartedOutput) {
              hasStartedOutput = true;
              hiddenLoadding();
            }
            
            completeText += parsed.delta.text;
            // 实时更新UI
            aiMessageDiv.innerHTML = marked.parse(completeText);
            // 滚动到底部
            aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
          }
        } catch (e) {
          console.log('解析Anthropic响应失败:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 添加到对话历史
  dialogueHistory.push({
    user: inputText,
    assistant: completeText
  });

  // 最终渲染和处理
  aiMessageDiv.innerHTML = marked.parse(completeText);
  createCopyButtonForColumn(completeText, aiMessageDiv);
  renderKatexMath(aiMessageDiv);
}
async function chatWithLLMForColumn(column, model, inputText, base64Images, tools = [], customSystemPrompt = null) {
  // 使用对应栏的对话历史
  const originalDialogueHistory = dialogueHistory;
  const originalGeminiDialogueHistory = geminiDialogueHistory;
  
  if (column === 'left') {
    dialogueHistory = leftDialogueHistory;
    geminiDialogueHistory = leftGeminiDialogueHistory;
  } else {
    dialogueHistory = rightDialogueHistory;
    geminiDialogueHistory = rightGeminiDialogueHistory;
  }

  try {
    var { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);

    if (!baseUrl) {
      throw new Error('模型 ' + model + ' 的 API 代理地址为空，请检查！');
    }

    if (!apiKey) {
      throw new Error('模型 ' + model + ' 的 API Key 为空，请检查！');
    }

    // 获取要使用的系统提示词
    let systemPromptToUse = customSystemPrompt;
    if (!systemPromptToUse) {
      const promptModeResult = await new Promise(resolve => {
        chrome.storage.local.get(['promptMode'], resolve);
      });
      const currentMode = promptModeResult.promptMode || 'default';

      if (currentMode === 'paper') {
        systemPromptToUse = PAPER_SYSTEM_PROMPT;
      } else if (currentMode === 'learning') {
        const learningModePromptResult = await new Promise(resolve => {
          chrome.storage.local.get(['learningModePrompt'], resolve);
        });
        systemPromptToUse = learningModePromptResult.learningModePrompt || LEARNING_MODE_PROMPT;
      } else {
        const systemPromptResult = await new Promise(resolve => {
          chrome.storage.local.get(['systemPrompt'], resolve);
        });
        systemPromptToUse = systemPromptResult.systemPrompt || SYSTEM_PROMPT;
      }
    }

    const openaiDialogueEntry = createDialogueEntry('user', 'content', inputText, base64Images, model);
    const geminiDialogueEntry = createDialogueEntry('user', 'parts', inputText, base64Images, model);

    // 将用户提问更新到对话历史
    dialogueHistory.push(openaiDialogueEntry);
    geminiDialogueHistory.push(geminiDialogueEntry);

    // 取最近的 X 条对话记录
    if (dialogueHistory.length > MAX_DIALOG_LEN) {
      dialogueHistory = dialogueHistory.slice(-MAX_DIALOG_LEN);
    }

    // 直接调用API而不通过llm.js的UI更新函数
    let completeText = '';
    if (model.includes(PROVIDERS.GEMINI) && !model.startsWith("openai-")) {
      baseUrl = baseUrl.replace('{MODEL_NAME}', model).replace('{API_KEY}', apiKey);
      completeText = await callGeminiAPIDirectly(baseUrl, model, tools, systemPromptToUse);
    } else if (model.includes(PROVIDERS.NVIDIA)) {
      completeText = await callOpenAIAPIDirectly(baseUrl, apiKey, model, tools, systemPromptToUse);
    } else if (model.includes(PROVIDERS.ANTHROPIC) || model.startsWith('claude-')) {
      completeText = await callAnthropicAPIDirectly(baseUrl, apiKey, model, tools, systemPromptToUse);
    } else {
      completeText = await callOpenAIAPIDirectly(baseUrl, apiKey, model, tools, systemPromptToUse);
    }
    
    // 更新对应栏的对话历史
    if (column === 'left') {
      leftDialogueHistory = [...dialogueHistory];
      leftGeminiDialogueHistory = [...geminiDialogueHistory];
    } else {
      rightDialogueHistory = [...dialogueHistory];
      rightGeminiDialogueHistory = [...geminiDialogueHistory];
    }
    
    return completeText;
  } finally {
    // 恢复原始对话历史
    dialogueHistory = originalDialogueHistory;
    geminiDialogueHistory = originalGeminiDialogueHistory;
  }
}

/**
 * 直接调用OpenAI兼容API（不更新UI）
 */
async function callOpenAIAPIDirectly(baseUrl, apiKey, model, tools, systemPrompt) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...dialogueHistory
    ],
    stream: false, // 不使用流式输出，简化处理
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
  };

  // 添加模型参数
  const modelParams = await new Promise(resolve => {
    chrome.storage.local.get(['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty'], resolve);
  });

  if (modelParams.temperature) body.temperature = parseFloat(modelParams.temperature);
  if (modelParams.top_p) body.top_p = parseFloat(modelParams.top_p);
  if (modelParams.max_tokens) body.max_tokens = parseInt(modelParams.max_tokens);
  if (modelParams.frequency_penalty) body.frequency_penalty = parseFloat(modelParams.frequency_penalty);
  if (modelParams.presence_penalty) body.presence_penalty = parseFloat(modelParams.presence_penalty);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const content = data.choices[0].message.content;
    
    // 将AI回答添加到对话历史
    dialogueHistory.push({
      role: 'assistant',
      content: content
    });
    
    return content;
  } else {
    throw new Error('Invalid API response format');
  }
}

/**
 * 直接调用Gemini API（不更新UI）
 */
async function callGeminiAPIDirectly(baseUrl, model, tools, systemPrompt) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const body = {
    contents: [
      ...geminiDialogueHistory
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    }
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const content = data.candidates[0].content.parts[0].text;
    
    // 将AI回答添加到对话历史
    geminiDialogueHistory.push({
      role: 'model',
      parts: [{ text: content }]
    });
    
    return content;
  } else {
    throw new Error('Invalid Gemini API response format');
  }
}

/**
 * 直接调用Anthropic API（不更新UI）
 */
async function callAnthropicAPIDirectly(baseUrl, apiKey, model, tools, systemPrompt) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'anthropic-version': '2023-06-01'
  };

  // 转换对话格式为Anthropic格式
  const messages = dialogueHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content || msg.parts?.[0]?.text || ''
  }));

  const body = {
    model: model,
    system: systemPrompt,
    messages: messages,
    max_tokens: 4000,
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.content && data.content[0] && data.content[0].text) {
    const content = data.content[0].text;
    
    // 将AI回答添加到对话历史
    dialogueHistory.push({
      role: 'assistant',
      content: content
    });
    
    return content;
  } else {
    throw new Error('Invalid Anthropic API response format');
  }
}

/**
 * 创建用户消息div
 */
function createUserMessageDiv(inputText, base64Images) {
  const userQuestionDiv = document.createElement('div');
  userQuestionDiv.className = 'user-message';
  let userMessage = '';
  
  if (base64Images && base64Images.length > 0) {
    base64Images.forEach(url => {
      if (!url.includes('image')) {
        url = DEFAULT_FILE_LOGO_PATH;
      }
      userMessage += `<img src='${url}' />`;
    });
  }
  
  // 如果是双栏模式，显示简化的标题
  if (isDualColumnMode) {
    let shortTitle = '';
    
    // 根据内容类型生成简短标题
    if (inputText.includes('摘要') || inputText.includes('任务目标')) {
      shortTitle = '智能摘要';
    } else if (inputText.includes('翻译') || inputText.includes('translate')) {
      shortTitle = '网页翻译';
    } else if (inputText.includes('PDF') || inputText.includes('分析')) {
      shortTitle = 'PDF分析';
    } else if (inputText.length > 50) {
      shortTitle = inputText.substring(0, 50) + '...';
    } else {
      shortTitle = inputText;
    }
    
    userMessage += shortTitle;
    userQuestionDiv.setAttribute('title', inputText); // 悬停时显示完整内容
  } else {
    userMessage += inputText;
  }
  
  userQuestionDiv.innerHTML = userMessage;
  
  return userQuestionDiv;
}

/**
 * 为指定栏创建复制按钮
 */
function createCopyButtonForColumn(completeText, targetElement) {
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.alignItems = 'center';
  buttonContainer.style.justifyContent = 'flex-end';
  buttonContainer.style.marginTop = '12px';
  buttonContainer.style.padding = '6px 0';

  // 创建Save Note按钮（文字形式，适应双栏模式，融入设计风格）
  const saveNoteBtn = document.createElement('button');
  saveNoteBtn.textContent = 'Save';
  saveNoteBtn.style.cursor = 'pointer';
  saveNoteBtn.style.padding = '5px 9px';
  saveNoteBtn.style.fontSize = '11px';
  saveNoteBtn.style.border = 'none';
  saveNoteBtn.style.borderRadius = '0';
  saveNoteBtn.style.backgroundColor = 'transparent';
  saveNoteBtn.style.color = 'var(--text-secondary)';
  saveNoteBtn.style.transition = 'all 0.2s ease';
  saveNoteBtn.style.flexShrink = '0';
  saveNoteBtn.style.fontFamily = "'FZB', Arial, sans-serif";
  saveNoteBtn.style.fontWeight = '500';
  saveNoteBtn.style.boxShadow = 'none';

  // 添加悬停效果，透明背景下的颜色变化
  saveNoteBtn.addEventListener('mouseenter', function () {
    saveNoteBtn.style.color = 'var(--accent-color)';
    saveNoteBtn.style.transform = 'translateY(-1px)';
  });
  saveNoteBtn.addEventListener('mouseleave', function () {
    saveNoteBtn.style.color = 'var(--text-secondary)';
    saveNoteBtn.style.transform = 'translateY(0)';
  });

  saveNoteBtn.addEventListener('click', function () {
    saveNoteAsMarkdown(completeText);
  });

  // 创建复制按钮容器，与Save Note按钮风格一致（双栏模式）
  const copyBtnContainer = document.createElement('div');
  copyBtnContainer.style.cursor = 'pointer';
  copyBtnContainer.style.padding = '6px';
  copyBtnContainer.style.borderRadius = '0';
  copyBtnContainer.style.transition = 'all 0.2s ease';
  copyBtnContainer.style.border = 'none';
  copyBtnContainer.style.backgroundColor = 'transparent';
  copyBtnContainer.style.boxShadow = 'none';
  copyBtnContainer.style.flexShrink = '0';
  copyBtnContainer.style.display = 'flex';
  copyBtnContainer.style.alignItems = 'center';
  copyBtnContainer.style.justifyContent = 'center';

  // 创建复制按钮
  const copySvg = document.querySelector('.icon-copy').cloneNode(true);
  copySvg.style.display = 'block';
  copySvg.style.width = '14px';
  copySvg.style.height = '14px';
  copySvg.style.stroke = 'var(--text-secondary)';
  copySvg.title = '复制';

  copyBtnContainer.addEventListener('mouseenter', function () {
    copySvg.style.stroke = 'var(--accent-color)';
    copyBtnContainer.style.transform = 'translateY(-1px)';
  });
  copyBtnContainer.addEventListener('mouseleave', function () {
    copySvg.style.stroke = 'var(--text-secondary)';
    copyBtnContainer.style.transform = 'translateY(0)';
  });

  copyBtnContainer.addEventListener('click', function () {
    navigator.clipboard.writeText(completeText).then(() => {
      const originalSvg = copySvg.innerHTML;
      copySvg.innerHTML = rightSvgString;
      setTimeout(() => {
        copySvg.innerHTML = originalSvg;
      }, 2000);
    }).catch(err => {
      console.error('复制失败:', err);
    });
  });

  // 将复制SVG添加到容器
  copyBtnContainer.appendChild(copySvg);

  // 将按钮添加到主容器
  buttonContainer.appendChild(saveNoteBtn);
  buttonContainer.appendChild(copyBtnContainer);

  targetElement.appendChild(buttonContainer);
}

/**
 * 初始化布局模式（修复版本 - 避免状态混乱）
 */
function initLayoutMode() {
  // 使用新的状态管理对象加载保存的布局模式
  DualColumnState.loadFromStorage().then(result => {
    if (result.layoutMode === 'dual') {
      // 直接设置UI到双栏模式，而不调用toggle
      const singleLayout = document.getElementById('single-layout');
      const dualLayout = document.getElementById('dual-layout');
      const layoutToggleBtn = document.getElementById('layout-toggle-label');
      
      // 设置状态
      DualColumnState.activate();
      isDualColumnMode = true;
      
      // 直接设置UI
      if (singleLayout) singleLayout.style.display = 'none';
      if (dualLayout) dualLayout.style.display = 'block';
      if (layoutToggleBtn) layoutToggleBtn.classList.add('active');
      
      // 等待UI设置完成后再初始化模型选择器
      setTimeout(() => {
        // 确保模型列表已加载完成
        if (allModels.length > 0) {
          initDualColumnModelSelectors();
          
          // 恢复模型选择
          if (result.leftColumnModel) {
            leftColumnModel = result.leftColumnModel;
            DualColumnState.setModel('left', result.leftColumnModel);
            updateColumnModelDisplay('left', result.leftColumnModel);
          }
          if (result.rightColumnModel) {
            rightColumnModel = result.rightColumnModel;
            DualColumnState.setModel('right', result.rightColumnModel);
            updateColumnModelDisplay('right', result.rightColumnModel);
          }
        } else {
          // 如果模型列表还没加载完，等待一段时间后重试
          const retryInitModels = () => {
            if (allModels.length > 0) {
              initDualColumnModelSelectors();
              
              if (result.leftColumnModel) {
                leftColumnModel = result.leftColumnModel;
                DualColumnState.setModel('left', result.leftColumnModel);
                updateColumnModelDisplay('left', result.leftColumnModel);
              }
              if (result.rightColumnModel) {
                rightColumnModel = result.rightColumnModel;
                DualColumnState.setModel('right', result.rightColumnModel);
                updateColumnModelDisplay('right', result.rightColumnModel);
              }
            } else {
              // 继续等待
              setTimeout(retryInitModels, 500);
            }
          };
          setTimeout(retryInitModels, 500);
        }
      }, 200);
    } else {
      // 确保是单栏模式
      const singleLayout = document.getElementById('single-layout');
      const dualLayout = document.getElementById('dual-layout');
      const layoutToggleBtn = document.getElementById('layout-toggle-label');
      
      DualColumnState.deactivate();
      isDualColumnMode = false;
      
      if (singleLayout) singleLayout.style.display = 'block';
      if (dualLayout) dualLayout.style.display = 'none';
      if (layoutToggleBtn) layoutToggleBtn.classList.remove('active');
    }
  });

  // 添加布局切换按钮事件监听器
  const layoutToggleBtn = document.getElementById('layout-toggle-label');
  if (layoutToggleBtn) {
    layoutToggleBtn.addEventListener('click', function() {
      toggleLayoutMode();
    });
  }

  // 初始化双栏快速功能按钮
  initDualColumnActionButtons();
}

/**
 * 初始化抽屉切换功能
 */
function initDrawerToggle() {
  const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
  const drawerHeader = document.querySelector('.drawer-header');
  const drawer = document.querySelector('.dual-column-drawer');
  
  // 从localStorage加载抽屉状态
  chrome.storage.local.get(['drawerCollapsed'], function(result) {
    if (result.drawerCollapsed) {
      drawer.classList.add('collapsed');
      drawerHeader.classList.add('collapsed');
    }
  });
  
  // 添加点击事件
  const toggleDrawer = () => {
    const isCollapsed = drawer.classList.toggle('collapsed');
    drawerHeader.classList.toggle('collapsed');
    
    // 保存状态
    chrome.storage.local.set({ 'drawerCollapsed': isCollapsed });
  };
  
  if (drawerToggleBtn) {
    drawerToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer();
    });
  }
  
  if (drawerHeader) {
    drawerHeader.addEventListener('click', toggleDrawer);
  }
}

/**
 * 初始化双栏快速功能按钮
 */
function initDualColumnActionButtons() {
  // 初始化抽屉切换功能
  initDrawerToggle();
  
  // 双栏摘要按钮
  const dualSummaryBtn = document.getElementById('dual-summary-btn');
  if (dualSummaryBtn) {
    dualSummaryBtn.addEventListener('click', async function() {
      await handleDualColumnSummary();
    });
  }

  // 双栏翻译按钮
  const dualTranslateBtn = document.getElementById('dual-translate-btn');
  if (dualTranslateBtn) {
    dualTranslateBtn.addEventListener('click', async function() {
      await handleDualColumnTranslate();
    });
  }

  // 双栏本地PDF按钮
  const dualLocalPdfBtn = document.getElementById('dual-local-pdf-btn');
  if (dualLocalPdfBtn) {
    dualLocalPdfBtn.addEventListener('click', async function() {
      await handleDualColumnLocalPDF();
    });
  }

  // 双栏视频字幕总结按钮
  const dualSubtitleSummaryBtn = document.getElementById('dual-subtitle-summary-btn');
  if (dualSubtitleSummaryBtn) {
    dualSubtitleSummaryBtn.addEventListener('click', async function() {
      await handleDualColumnSubtitleSummary();
    });
  }
}

/**
 * 处理双栏模式摘要
 */
async function handleDualColumnSummary() {
  if (!leftColumnModel || !rightColumnModel) {
    showToast('请先为两个栏位选择模型', 'error');
    return;
  }

  const leftApiKeyValid = await verifyApiKeyConfigured(leftColumnModel);
  const rightApiKeyValid = await verifyApiKeyConfigured(rightColumnModel);
  
  if (!leftApiKeyValid || !rightApiKeyValid) {
    return;
  }

  let inputText = '';
  const currentURL = await getCurrentURL();

  try {
    if (isPDFUrl(currentURL)) {
      displayLoading('正在提取PDF内容...');
      inputText = await extractPDFText(currentURL);
    } else {
      displayLoading('正在提取网页内容...');
      inputText = await fetchPageContent(FORMAT_TEXT);
    }
  } catch (error) {
    hiddenLoadding();
    console.error('智能摘要失败', error);
    showToast(`智能摘要失败: ${error.message}`, 'error');
    return;
  }

  // 获取当前提示词模式和相应的提示词
  chrome.storage.local.get(['promptMode', 'summaryPrompt', 'paperReadingPrompt', 'systemPrompt'], async function (result) {
    const currentMode = result.promptMode || 'default';
    let promptToUse;
    let systemPromptToUse;

    if (currentMode === 'paper') {
      promptToUse = result.paperReadingPrompt || PAPER_READING_PROMPT;
      systemPromptToUse = PAPER_SYSTEM_PROMPT;
    } else if (currentMode === 'learning') {
      promptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
      systemPromptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
    } else {
      promptToUse = result.summaryPrompt || SUMMARY_PROMPT;
      systemPromptToUse = result.systemPrompt || SYSTEM_PROMPT;
    }

    const fullPrompt = promptToUse + inputText;

    // 清空聊天内容并开始双栏摘要
    document.getElementById('left-chat-content').innerHTML = '';
    document.getElementById('right-chat-content').innerHTML = '';
    
    await dualColumnChatLLMAndUIUpdate(fullPrompt, [], systemPromptToUse, false);
  });
}

/**
 * 处理双栏模式翻译
 */
async function handleDualColumnTranslate() {
  if (!leftColumnModel || !rightColumnModel) {
    showToast('请先为两个栏位选择模型', 'error');
    return;
  }

  const leftApiKeyValid = await verifyApiKeyConfigured(leftColumnModel);
  const rightApiKeyValid = await verifyApiKeyConfigured(rightColumnModel);
  
  if (!leftApiKeyValid || !rightApiKeyValid) {
    return;
  }

  let inputText = '';
  const currentURL = await getCurrentURL();

  try {
    if (isPDFUrl(currentURL)) {
      displayLoading('正在提取PDF内容...');
      inputText = await extractPDFText(currentURL);
    } else {
      displayLoading('正在提取网页内容...');
      inputText = await fetchPageContent();
    }
  } catch (error) {
    hiddenLoadding();
    console.error('网页翻译失败', error);
    showToast(`网页翻译失败: ${error.message}`, 'error');
    return;
  }

  // 清空聊天内容并开始双栏翻译
  document.getElementById('left-chat-content').innerHTML = '';
  document.getElementById('right-chat-content').innerHTML = '';
  
  await dualColumnChatLLMAndUIUpdate(TRANSLATE2CHN_PROMPT + inputText, [], null, false);
}

/**
 * 处理双栏模式本地PDF
 */
async function handleDualColumnLocalPDF() {
  if (!leftColumnModel || !rightColumnModel) {
    showToast('请先为两个栏位选择模型', 'error');
    return;
  }

  // 显示选择对话框
  const useFilePath = confirm('是否直接输入本地PDF文件路径？\n\n点击"确定"输入文件路径\n点击"取消"上传PDF文件');
  
  if (useFilePath) {
    // 显示文件路径输入对话框
    const pdfPathDialog = document.getElementById('pdf-path-dialog');
    pdfPathDialog.style.display = 'flex';
    
    // 处理确认按钮（如果还没有为双栏模式添加事件监听器）
    const pdfPathConfirm = document.getElementById('pdf-path-confirm');
    const pdfPathInput = document.getElementById('pdf-path-input');
    
    // 移除之前的事件监听器，添加新的
    const newConfirmBtn = pdfPathConfirm.cloneNode(true);
    pdfPathConfirm.parentNode.replaceChild(newConfirmBtn, pdfPathConfirm);
    
    newConfirmBtn.addEventListener('click', async function() {
      const filePath = pdfPathInput.value.trim();
      if (!filePath) {
        alert('请输入有效的PDF文件路径');
        return;
      }

      pdfPathDialog.style.display = 'none';

      const leftApiKeyValid = await verifyApiKeyConfigured(leftColumnModel);
      const rightApiKeyValid = await verifyApiKeyConfigured(rightColumnModel);
      
      if (!leftApiKeyValid || !rightApiKeyValid) {
        return;
      }

      try {
        displayLoading('正在读取本地PDF文件...');
        const pdfText = await extractPDFFromFilePath(filePath);

        if (!pdfText || pdfText.trim().length === 0) {
          hiddenLoadding();
          showToast('无法从PDF中提取文本内容', 'error');
          return;
        }

        const fileName = filePath.split('/').pop().split('\\').pop();
        
        // 清空聊天内容并开始双栏PDF分析
        document.getElementById('left-chat-content').innerHTML = '';
        document.getElementById('right-chat-content').innerHTML = '';
        
        await dualColumnChatLLMAndUIUpdate(
          `以下是PDF文件"${fileName}"的内容，请提供一个详细的摘要:\n\n${pdfText}`,
          [],
          null,
          false
        );
      } catch (error) {
        hiddenLoadding();
        console.error('读取本地PDF失败:', error);
        showToast(`读取本地PDF失败: ${error.message}`, 'error');
      } finally {
        pdfPathInput.value = '';
      }
    });
  } else {
    // 使用文件上传
    const pdfInput = document.getElementById('pdf-file-input');
    pdfInput.click();
  }
}

/**
 * 处理双栏模式视频字幕总结
 */
async function handleDualColumnSubtitleSummary() {
  if (!leftColumnModel || !rightColumnModel) {
    showToast('请先为两个栏位选择模型', 'error');
    return;
  }

  const leftApiKeyValid = await verifyApiKeyConfigured(leftColumnModel);
  const rightApiKeyValid = await verifyApiKeyConfigured(rightColumnModel);
  if (!leftApiKeyValid || !rightApiKeyValid) {
    return;
  }

  const currentURL = await getCurrentURL();
  if (!currentURL.includes('bilibili.com') && !currentURL.includes('youtube.com')) {
    showToast('当前页面不是支持的视频页面（仅支持B站和YouTube）', 'error');
    return;
  }

  try {
    displayLoading('正在提取视频字幕...');
    const subtitles = await extractSubtitles(currentURL, FORMAT_TEXT_WITH_TIMESTAMPS);
    hiddenLoadding();

    if (!subtitles || subtitles.trim().length === 0) {
      showToast('该视频没有找到字幕内容', 'error');
      return;
    }

    const isYouTube = currentURL.includes('youtube.com') || currentURL.includes('youtu.be');
    const fullPrompt = isYouTube
      ? YOUTUBE_SUBTITLE_SUMMARY_PROMPT + subtitles
      : BILIBILI_SUBTITLE_SUMMARY_PROMPT + subtitles;

    // 清空聊天内容并开始双栏字幕总结
    document.getElementById('left-chat-content').innerHTML = '';
    document.getElementById('right-chat-content').innerHTML = '';

    await dualColumnChatLLMAndUIUpdate(fullPrompt, [], SYSTEM_PROMPT, false);
  } catch (error) {
    hiddenLoadding();
    console.error('提取字幕失败:', error);
    showToast(`提取字幕失败: ${error.message}`, 'error');
  }
}

// 提示词模式选择逻辑
function initPromptModeSelection() {
  const promptModeSelection = document.getElementById('prompt-mode-selection');

  // 加载保存的模式设置
  chrome.storage.local.get(['promptMode'], function (result) {
    if (result.promptMode) {
      promptModeSelection.value = result.promptMode;
    }
  });

  // 监听模式切换事件
  promptModeSelection.addEventListener('change', function () {
    const selectedMode = this.value;
    chrome.storage.local.set({ 'promptMode': selectedMode });

    // 显示提示信息
    showToast(selectedMode === 'paper' ? '已切换到论文模式' : 
              selectedMode === 'learning' ? '已切换到学习模式' : '已切换到默认模式', 'info');
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
  chrome.storage.local.get([SERPAPI], (result) => {
    if (result.serpapi !== undefined) {
      document.getElementById(SERPAPI).checked = result.serpapi;
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

/**
 * 更新模型选择列表
 */
function updateModelSelection(globalModels, enabledProviders = null) {
  // 清空全局模型数组
  allModels = [];

  // 获取免费过滤设置
  const showFreeOnly = localStorage.getItem('openrouter-free-only') === 'true';

  // 使用 constants.js 中的服务商数据
  const providerOrder = Object.values(PROVIDERS);
  const providerDisplayName = PROVIDER_DISPLAY_NAMES;
  const enabledMap = enabledProviders || providerOrder.reduce((acc, p) => {
    acc[p] = true;
    return acc;
  }, {});

  providerOrder.forEach(provider => {
    if (enabledMap[provider] === false) {
      return;
    }
    const models = globalModels[provider];
    if (models && models.length > 0) {
      // 应用OpenRouter过滤
      let filteredModels = models;
      if (provider === PROVIDERS.OPENROUTER && showFreeOnly) {
        filteredModels = models.filter(m => m.value.includes(':free'));
      }

      // 将模型添加到全局数组
      filteredModels.forEach(model => {
        const displayName = `${providerDisplayName[provider] || provider.toUpperCase()} - ${model.value}`;
        allModels.push({
          value: model.value,
          name: displayName,
          provider: provider
        });
      });
    }
  });

  // 初始化搜索下拉框
  if (allModels.length > 0) {
    filterAndDisplayModels('');
  }

  // 恢复之前选择的模型
  chrome.storage.local.get(['selectedModel'], function (result) {
    if (result.selectedModel && allModels.find(m => m.value === result.selectedModel)) {
      selectedModel = result.selectedModel;
      updateSelectedModel(result.selectedModel);
    } else if (result.selectedModel) {
      // 已关闭供应商或模型不存在时清理选中状态
      selectedModel = null;
      const searchInput = document.getElementById('model-search');
      if (searchInput) searchInput.value = '';
      chrome.storage.local.remove('selectedModel');
    }
  });

  // 模型加载完成后，检查是否需要初始化双栏模式
  if (allModels.length > 0 && DualColumnState.isActive) {
    // 延迟初始化确保DOM已准备好
    setTimeout(() => {
      initDualColumnModelSelectors();
      
      // 恢复保存的模型选择
      if (DualColumnState.leftModel) {
        updateColumnModelDisplay('left', DualColumnState.leftModel);
      }
      if (DualColumnState.rightModel) {
        updateColumnModelDisplay('right', DualColumnState.rightModel);
      }
    }, 100);
  }
}

/**
 * 初始化结果页面
 */
function initResultPage() {
  // 加载全局模型列表
  chrome.storage.local.get(['globalModels', 'enabledProviders'], function (result) {
    console.log('Loaded global models:', result.globalModels); // 添加日志
    const providerOrder = Object.values(PROVIDERS);
    const enabledMap = providerOrder.reduce((acc, p) => {
      acc[p] = true;
      return acc;
    }, {});
    if (result.enabledProviders) {
      Object.assign(enabledMap, result.enabledProviders);
    }
    if (result.globalModels) {
      updateModelSelection(result.globalModels, enabledMap);
    } else {
      updateModelSelection({}, enabledMap);
    }
  });

  // 加载 Ollama 模型并处理模型选择
  loadOllamaModels(function () {
    handleModelSelection();
  });

  // 初始化提示词模式选择
  initPromptModeSelection();

  // 加载模型参数
  loadModelParams();

  // 加载工具选择状态
  loadToolsSelectedStatus();

  // 初始化知识库问答配置
  initKnowledgeBaseRetrievalUI().catch(err =>
    console.error('Failed to init KB retrieval UI:', err)
  );

  // 初始化按钮状态
  updateSubmitButton();

  // 初始化布局模式
  initLayoutMode();

  // 检测输入框内容变化以更新提交按钮状态
  var userInput = document.getElementById('my-extension-user-input');
  userInput.addEventListener('input', updateSubmitButton);

  // 快捷输入
  const shortcutMenu = document.getElementById('shortcut-menu');
  userInput.addEventListener('input', function (e) {
    if (e.target.value === '/') {
      shortcutMenu.style.display = 'block';
      setTimeout(() => {
        shortcutMenu.classList.add('show');
      }, 10);
    } else {
      shortcutMenu.classList.remove('show');
      setTimeout(() => {
        shortcutMenu.style.display = 'none';
      }, 300);
    }
  });
  userInput.addEventListener('keydown', function (e) {
    if (e.key === '/' && userInput.value.length === 0) {
      shortcutMenu.style.display = 'block';
      setTimeout(() => {
        shortcutMenu.classList.add('show');
      }, 10);
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
    // 先显示元素
    modelParamsPopupDiv.style.display = 'block';
    // 添加show类触发动画
    setTimeout(() => {
      modelParamsPopupDiv.classList.add('show');
    }, 10);
    toolStorePopupDiv.style.display = 'none';
    toolStorePopupDiv.classList.remove('show');
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
    // 先显示元素
    toolStorePopupDiv.style.display = 'block';
    // 添加show类触发动画
    setTimeout(() => {
      toolStorePopupDiv.classList.add('show');
    }, 10);
    modelParamsPopupDiv.style.display = 'none';
    modelParamsPopupDiv.classList.remove('show');
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
      modelParamsPopupDiv.classList.remove('show');
      setTimeout(() => {
        modelParamsPopupDiv.style.display = 'none';
      }, 300); // 等待动画完成
    }
    if (!toolStorePopupDiv.contains(event.target) && event.target !== toolsBtn) {
      toolStorePopupDiv.classList.remove('show');
      setTimeout(() => {
        toolStorePopupDiv.style.display = 'none';
      }, 300); // 等待动画完成
    }
  });

  // 图片上传预览
  document.getElementById('image-upload').addEventListener('change', function (event) {
    handleUploadFiles(event);
  });

  // 粘贴
  document.addEventListener('paste', async (event) => {
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
    if (isDualColumnMode) {
      // 双栏模式：清空两栏的聊天记录
      const leftContentDiv = document.getElementById('left-chat-content');
      const rightContentDiv = document.getElementById('right-chat-content');
      leftContentDiv.innerHTML = '';
      rightContentDiv.innerHTML = '';
      
      // 清空双栏的对话历史
      leftDialogueHistory = [];
      rightDialogueHistory = [];
      leftGeminiDialogueHistory = [];
      rightGeminiDialogueHistory = [];
    } else {
      // 单栏模式：清空聊天记录
      const contentDiv = document.querySelector('.chat-content');
      contentDiv.innerHTML = '';
      
      // 展示推荐内容
      showRecommandContent();
    }
    
    // 清空上传图片预览界面
    const previewArea = document.querySelector('.image-preview-area');
    previewArea.innerHTML = '';
    
    // 清空历史记录
    initChatHistory();
    // 重置所有弹出菜单状态
    [modelParamsPopupDiv, toolStorePopupDiv, shortcutMenu].forEach(menu => {
      menu.classList.remove('show');
      setTimeout(() => {
        menu.style.display = 'none';
      }, 300);
    });
  });

  // 摘要逻辑
  var summaryButton = document.querySelector('#my-extension-summary-btn');
  summaryButton.addEventListener('click', async function () {
    const model = getSelectedModel();
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }
    let inputText = '';
    const currentURL = await getCurrentURL();

    try {
      if (isPDFUrl(currentURL)) {
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

    // 获取当前提示词模式和相应的提示词
    chrome.storage.local.get(['promptMode', 'summaryPrompt', 'paperReadingPrompt', 'systemPrompt'], async function (result) {
      const currentMode = result.promptMode || 'default';
      let promptToUse;
      let displayMessage;
      let systemPromptToUse;

      if (currentMode === 'paper') {
        // 论文模式：使用论文阅读提示词和论文系统提示词
        promptToUse = result.paperReadingPrompt || PAPER_READING_PROMPT;
        systemPromptToUse = PAPER_SYSTEM_PROMPT;
        displayMessage = "对当前页面内容进行论文分析";
      } else if (currentMode === 'learning') {
        // 学习模式：使用学习模式提示词
        promptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
        systemPromptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
        displayMessage = "使用学习模式进行交互式教学";
      } else {
        // 默认模式：使用摘要提示词和默认系统提示词
        promptToUse = result.summaryPrompt || SUMMARY_PROMPT;
        systemPromptToUse = result.systemPrompt || SYSTEM_PROMPT;
        displayMessage = "对当前页面内容进行摘要";
      }

      const fullPrompt = promptToUse + inputText;

      // 隐藏初始推荐内容
      hideRecommandContent();

      // 创建并显示用户消息
      const contentDiv = document.querySelector('.chat-content');
      const userQuestionDiv = document.createElement('div');
      userQuestionDiv.className = 'user-message';
      // 在UI上显示一个简洁的指令，根据模式显示不同的内容
      userQuestionDiv.innerHTML = displayMessage;
      contentDiv.appendChild(userQuestionDiv);
      contentDiv.scrollTop = contentDiv.scrollHeight;

      // 调用核心聊天函数，传入包含页面内容的完整提示和系统提示词
      await chatLLMAndUIUpdate(model, fullPrompt, [], systemPromptToUse, false);
    });
  });

  // 网页翻译
  var translateButton = document.querySelector('#my-extension-translate-btn');
  translateButton.addEventListener('click', async function () {
    const model = getSelectedModel();
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }
    let inputText = '';
    const currentURL = await getCurrentURL();

    try {
      if (isPDFUrl(currentURL)) {
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

    await clearAndGenerate(model, TRANSLATE2CHN_PROMPT + inputText, null, false);
  });

  // 本地PDF分析
  var localPdfButton = document.querySelector('#my-extension-local-pdf-btn');
  var pdfInput = document.getElementById('pdf-file-input');
  var pdfPathDialog = document.getElementById('pdf-path-dialog');
  var pdfPathInput = document.getElementById('pdf-path-input');
  var pdfPathCancel = document.getElementById('pdf-path-cancel');
  var pdfPathConfirm = document.getElementById('pdf-path-confirm');

  localPdfButton.addEventListener('click', function () {
    // 显示选择对话框，让用户选择上传文件还是输入路径
    const useFilePath = confirm('是否直接输入本地PDF文件路径？\n\n点击"确定"输入文件路径\n点击"取消"上传PDF文件');

    if (useFilePath) {
      // 显示文件路径输入对话框
      pdfPathDialog.style.display = 'flex';
    } else {
      // 使用文件上传
      pdfInput.click();
    }
  });

  // 处理取消按钮
  pdfPathCancel.addEventListener('click', function () {
    pdfPathDialog.style.display = 'none';
    pdfPathInput.value = '';
  });

  // 处理确认按钮
  pdfPathConfirm.addEventListener('click', async function () {
    const filePath = pdfPathInput.value.trim();
    if (!filePath) {
      alert('请输入有效的PDF文件路径');
      return;
    }

    // 隐藏对话框
    pdfPathDialog.style.display = 'none';

    const model = getSelectedModel();
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }

    try {
      displayLoading('正在读取本地PDF文件...');
      const pdfText = await extractPDFFromFilePath(filePath);

      if (!pdfText || pdfText.trim().length === 0) {
        hiddenLoadding();
        displayErrorMessage('无法从PDF中提取文本内容');
        return;
      }

      // 从路径中提取文件名
      const fileName = filePath.split('/').pop().split('\\').pop();
      await clearAndGenerate(
        model,
        `以下是PDF文件"${fileName}"的内容，请提供一个详细的摘要:\n\n${pdfText}`,
        null,
        false
      );
    } catch (error) {
      hiddenLoadding();
      console.error('读取本地PDF失败:', error);
      displayErrorMessage(`读取本地PDF失败: ${error.message}`);
    } finally {
      pdfPathInput.value = '';
    }
  });

  pdfInput.addEventListener('change', async function (event) {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      displayErrorMessage('请选择有效的PDF文件');
      return;
    }

    const model = getSelectedModel();
    const apiKeyValid = await verifyApiKeyConfigured(model);
    if (!apiKeyValid) {
      return;
    }

    try {
      displayLoading('正在读取本地PDF文件...');
      const pdfText = await extractPDFTextFromFile(file);

      if (!pdfText || pdfText.trim().length === 0) {
        hiddenLoadding();
        displayErrorMessage('无法从PDF中提取文本内容');
        return;
      }

      // 根据文件名显示摘要提示
      const fileName = file.name;
      await clearAndGenerate(
        model,
        `以下是PDF文件"${fileName}"的内容，请提供一个详细的摘要:\n\n${pdfText}`,
        null,
        false
      );
    } catch (error) {
      hiddenLoadding();
      console.error('读取本地PDF失败:', error);
      displayErrorMessage(`读取本地PDF失败: ${error.message}`);
    } finally {
      // 清空文件输入，以便于下次选择相同文件时仍然触发change事件
      event.target.value = '';
    }
  });

  // 视频字幕总结逻辑
  var subtitleSummaryButton = document.querySelector('#my-extension-subtitle-summary-btn');
  if (subtitleSummaryButton) {
    subtitleSummaryButton.addEventListener('click', async function () {
      const model = getSelectedModel();
      const apiKeyValid = await verifyApiKeyConfigured(model);
      if (!apiKeyValid) {
        return;
      }

      // 获取当前页面URL
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) {
          showToast('无法获取当前标签页信息', 'error');
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { action: ACTION_GET_PAGE_URL }, async function(response) {
          // 检查Chrome runtime错误
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            showToast('消息传递失败：' + chrome.runtime.lastError.message, 'error');
            return;
          }

          // 检查response是否存在
          if (!response || !response.url) {
            showToast('无法获取当前页面URL，请确保在视频页面上使用此功能', 'error');
            return;
          }
          const currentURL = response.url;

          if (!currentURL.includes('bilibili.com') && !currentURL.includes('youtube.com')) {
            showToast('当前页面不是支持的视频页面（仅支持B站和YouTube）', 'error');
            return;
          }

          try {
            displayLoading('正在提取视频字幕...');

            // 提取字幕
            const subtitles = await extractSubtitles(currentURL, FORMAT_TEXT_WITH_TIMESTAMPS);

            hiddenLoadding();

            if (!subtitles || subtitles.trim().length === 0) {
              showToast('该视频没有找到字幕内容', 'error');
              return;
            }

            // 根据视频来源选择提示词
            const isYouTube = currentURL.includes('youtube.com') || currentURL.includes('youtu.be');
            const fullPrompt = isYouTube
              ? YOUTUBE_SUBTITLE_SUMMARY_PROMPT + subtitles
              : BILIBILI_SUBTITLE_SUMMARY_PROMPT + subtitles;

            // 隐藏初始推荐内容
            hideRecommandContent();

            // 创建并显示用户消息
            const userInput = document.getElementById('my-extension-user-input');
            const userQuestionText = `对当前视频字幕进行总结分析`;

            const userQuestionDiv = document.createElement('div');
          userQuestionDiv.className = 'user-message';
          userQuestionDiv.innerHTML = userQuestionText;

          // 添加编辑按钮
          const editButton = document.createElement('button');
          editButton.className = 'edit-message-btn';
          editButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          `;
          editButton.onclick = () => editUserMessage(userQuestionDiv, userQuestionText);
          userQuestionDiv.appendChild(editButton);

          const contentDiv = document.querySelector('.chat-content');
          contentDiv.appendChild(userQuestionDiv);

          // 滚动到底部
          contentDiv.scrollTop = contentDiv.scrollHeight;

          // 调用AI进行总结
          chatLLMAndUIUpdate(model, fullPrompt, [], SYSTEM_PROMPT, false);

        } catch (error) {
          hiddenLoadding();
          console.error('提取字幕失败:', error);
          showToast(`提取字幕失败: ${error.message}`, 'error');
        }
        });
      });
    });
  }

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
        color: #34495e;
      `;

      // 强制所有元素使用浅色主题样式
      const allElements = newDiv.querySelectorAll('*');
      allElements.forEach(element => {
        element.style.setProperty('color', '#34495e', 'important');
        element.style.setProperty('background-color', 'transparent', 'important');
        element.style.setProperty('border-color', '#ddd', 'important');
        element.style.setProperty('background', 'transparent', 'important');
      });

      // 特别处理可能影响颜色的CSS变量
      newDiv.style.setProperty('--text-primary', '#2c3e50', 'important');
      newDiv.style.setProperty('--text-secondary', '#34495e', 'important');
      newDiv.style.setProperty('--bg-primary', '#ffffff', 'important');
      newDiv.style.setProperty('--bg-secondary', '#f8f9fa', 'important');
      newDiv.style.setProperty('--border-color', '#ddd', 'important');
      newDiv.style.setProperty('--accent-color', '#3498db', 'important');

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

        // 在渲染前再次强制设置所有元素颜色
        newDiv.querySelectorAll('*').forEach(element => {
          const computedStyle = window.getComputedStyle(element);
          if (computedStyle.color.includes('rgb') && !computedStyle.color.includes('34495e')) {
            element.style.setProperty('color', '#34495e', 'important');
          }
        });

        // Render the new div
        html2canvas(newDiv, {
          backgroundColor: '#FAF8F6',
          useCORS: true,
          onclone: function(clonedDoc) {
            // 在克隆的文档中也强制应用浅色主题
            const clonedDiv = clonedDoc.querySelector('div[style*="position: absolute"]');
            if (clonedDiv) {
              clonedDiv.querySelectorAll('*').forEach(element => {
                element.style.setProperty('color', '#34495e', 'important');
                element.style.setProperty('background-color', 'transparent', 'important');
                element.style.setProperty('background', 'transparent', 'important');
              });

              // 设置CSS变量
              clonedDiv.style.setProperty('--text-primary', '#2c3e50', 'important');
              clonedDiv.style.setProperty('--text-secondary', '#34495e', 'important');
              clonedDiv.style.setProperty('--bg-primary', '#ffffff', 'important');
              clonedDiv.style.setProperty('--bg-secondary', '#f8f9fa', 'important');
            }
          }
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
      // 检查是否处于双栏模式
      if (isDualColumnMode) {
        // 双栏模式下的处理逻辑
        if (!leftColumnModel || !rightColumnModel) {
          showToast('请为两个栏位选择模型', 'error');
          return;
        }
        
        // 验证两个模型的API Key
        const leftApiKeyValid = await verifyApiKeyConfigured(leftColumnModel);
        const rightApiKeyValid = await verifyApiKeyConfigured(rightColumnModel);
        
        if (!leftApiKeyValid || !rightApiKeyValid) {
          return;
        }
        
        if (userInput.value.trim() !== '') {
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
          
          // 清空输入框内容
          userInput.value = "";
          
          // 清空上传图片预览界面
          const previewArea = document.querySelector('.image-preview-area');
          previewArea.innerHTML = '';
          
          // 双栏模式下的聊天
          await dualColumnChatLLMAndUIUpdate(inputText, base64Images);
        }
        return;
      }
      
      // 原有的单栏模式逻辑
      const model = getSelectedModel();
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
          // 获取当前提示词模式和相应的提示词
          chrome.storage.local.get(['promptMode', 'summaryPrompt', 'paperReadingPrompt', 'learningModePrompt', 'systemPrompt'], function (result) {
            const currentMode = result.promptMode || 'default';
            let promptToUse;
            let systemPromptToUse;

            if (currentMode === 'paper') {
              // 论文模式：使用论文阅读提示词和论文系统提示词
              promptToUse = result.paperReadingPrompt || PAPER_READING_PROMPT;
              systemPromptToUse = PAPER_SYSTEM_PROMPT;
            } else if (currentMode === 'learning') {
              // 学习模式：使用学习模式提示词
              promptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
              systemPromptToUse = result.learningModePrompt || LEARNING_MODE_PROMPT;
            } else {
              // 默认模式：使用摘要提示词和默认系统提示词
              promptToUse = result.summaryPrompt || SUMMARY_PROMPT;
              systemPromptToUse = result.systemPrompt || SYSTEM_PROMPT;
            }

            newInputText = promptToUse + inputText.replace(SHORTCUT_SUMMAY, '');
            // 继续处理，发送请求
            contentDiv.scrollTop = contentDiv.scrollHeight;
            userInput.value = "";
            const previewArea = document.querySelector('.image-preview-area');
            previewArea.innerHTML = '';
            chatLLMAndUIUpdate(model, newInputText, base64Images, systemPromptToUse, false);
          });
          return; // 提前返回，防止直接执行下面的代码
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
        chatLLMAndUIUpdate(model, newInputText, base64Images, null, true);
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

  // Web search按钮点击事件
  var webSearchBtn = document.querySelector('#web-search-label');
  if (webSearchBtn) {
    webSearchBtn.addEventListener('click', async function () {
      const model = getSelectedModel();

      // 检查是否支持联网搜索
      if (model.includes(PROVIDERS.GEMINI) && !GEMINI_SEARCH_MODELS.includes(model)) {
        showToast('当前Gemini模型不支持联网搜索', 'error');
        return;
      }

      // 验证API key
      const apiKeyValid = await verifyApiKeyConfigured(model);
      if (!apiKeyValid) {
        return;
      }

      // 获取当前工具状态
      chrome.storage.local.get(['selectedTools'], function (result) {
        const currentTools = result.selectedTools || [];
        const hasWebSearch = currentTools.some(tool =>
          tool.function && tool.function.name === '$web_search'
        );

        if (hasWebSearch) {
          // 如果已启用,则关闭
          chrome.storage.local.set({
            'selectedTools': currentTools.filter(tool =>
              !(tool.function && tool.function.name === '$web_search')
            )
          }, () => {
            webSearchBtn.classList.remove('active');
            // 使用新的提示样式
            showToast('已关闭联网搜索', 'info');
          });
        } else {
          // 如果未启用,则开启
          const webSearchTool = createWebSearchTool();
          chrome.storage.local.set({
            'selectedTools': [...currentTools, webSearchTool]
          }, () => {
            webSearchBtn.classList.add('active');
            // 使用新的提示样式
            showToast('已启用联网搜索', 'success');
          });
        }
      });
    });

    // 初始化按钮状态
    chrome.storage.local.get(['selectedTools'], function (result) {
      const currentTools = result.selectedTools || [];
      const hasWebSearch = currentTools.some(tool =>
        tool.function && tool.function.name === '$web_search'
      );
      if (hasWebSearch) {
        webSearchBtn.classList.add('active');
      }
    });
  }
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
 * 显示普通消息
 * @param {string} message 
 */
function displayMessage(message) {
  const contentDiv = document.querySelector('.chat-content');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'info-message';
  messageDiv.textContent = message;
  contentDiv.appendChild(messageDiv);

  // 2秒后自动消失
  setTimeout(() => {
    contentDiv.removeChild(messageDiv);
  }, 2000);
}

/**
 * 主程序
 */
document.addEventListener('DOMContentLoaded', function () {
  initResultPage();
});

/**
 * 显示优雅的提示信息
 * @param {string} message 提示内容
 * @param {string} type 提示类型 (success/info/error)
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';

  // 根据类型设置图标
  if (type === 'success') {
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 6L9 17l-5-5"/>
    </svg>`;
  } else if (type === 'info') {
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>`;
  }

  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);

  document.body.appendChild(toast);

  // 动画效果
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // 2秒后消失
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-100%)';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

async function chatWithLLM(model, inputText, base64Images, type, tools = [], customSystemPrompt = null) {
  var { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);

  if (!baseUrl) {
    throw new Error('模型 ' + model + ' 的 API 代理地址为空，请检查！');
  }

  if (!apiKey) {
    throw new Error('模型 ' + model + ' 的 API Key 为空，请检查！');
  }

  // 获取要使用的系统提示词
  let systemPromptToUse = customSystemPrompt;
  if (!systemPromptToUse) {
    // 如果没有传入自定义系统提示词，根据当前模式选择
    const promptModeResult = await new Promise(resolve => {
      chrome.storage.local.get(['promptMode'], resolve);
    });
    const currentMode = promptModeResult.promptMode || 'default';

    if (currentMode === 'paper') {
      systemPromptToUse = PAPER_SYSTEM_PROMPT;
    } else if (currentMode === 'learning') {
      // 获取用户自定义的学习模式提示词，如果没有则使用默认的
      const learningModePromptResult = await new Promise(resolve => {
        chrome.storage.local.get(['learningModePrompt'], resolve);
      });
      systemPromptToUse = learningModePromptResult.learningModePrompt || LEARNING_MODE_PROMPT;
    } else {
      // 获取用户自定义的系统提示词，如果没有则使用默认的
      const systemPromptResult = await new Promise(resolve => {
        chrome.storage.local.get(['systemPrompt'], resolve);
      });
      systemPromptToUse = systemPromptResult.systemPrompt || SYSTEM_PROMPT;
    }
  }

  const openaiDialogueEntry = createDialogueEntry('user', 'content', inputText, base64Images, model);
  const geminiDialogueEntry = createDialogueEntry('user', 'parts', inputText, base64Images, model);

  // 将用户提问更新到对话历史
  dialogueHistory.push(openaiDialogueEntry);
  geminiDialogueHistory.push(geminiDialogueEntry);

  // 取最近的 X 条对话记录
  if (dialogueHistory.length > MAX_DIALOG_LEN) {
    dialogueHistory = dialogueHistory.slice(-MAX_DIALOG_LEN);
  }

  let result = { completeText: '', tools: [] };
  if (model.includes(PROVIDERS.GEMINI) && !model.startsWith("openai-")) {
    baseUrl = baseUrl.replace('{MODEL_NAME}', model).replace('{API_KEY}', apiKey);
    result = await chatWithGemini(baseUrl, model, type, tools, systemPromptToUse);
  } else if (model.includes(PROVIDERS.NVIDIA)) {
    // NVIDIA 使用 OpenAI 格式
    result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, systemPromptToUse);
  } else if (model.includes(PROVIDERS.ANTHROPIC) || model.startsWith('claude-')) {
    // Anthropic Claude 使用专门的消息格式
    result = await chatWithAnthropic(baseUrl, apiKey, model, type, tools, systemPromptToUse);
  } else {
    result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, systemPromptToUse);
  }

  // 渲染最新添加的内容中的数学公式
  const contentDiv = document.querySelector('.chat-content');
  const aiMessageDiv = contentDiv.querySelector('.ai-message');
  if (aiMessageDiv) {
    renderKatexMath(aiMessageDiv);
  }

  while (result && result.tools && result.tools.length > 0) {
    result = await parseFunctionCalling(result, baseUrl, apiKey, model, type);
    // 每次工具调用返回后也渲染数学公式
    if (aiMessageDiv) {
      renderKatexMath(aiMessageDiv);
    }
  }

  return (result && result.completeText) || result || '';
}

// 跟随系统主题的函数
function applySystemTheme() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = isDarkMode ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function initTheme() {
  // 从存储中获取当前主题
  chrome.storage.local.get('theme', ({ theme }) => {
    const currentTheme = theme || 'dark';

    // 应用主题
    if (currentTheme === 'system') {
      applySystemTheme();
    } else {
      document.documentElement.setAttribute('data-theme', currentTheme);
    }
  });

  // 监听系统主题变化
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeMediaQuery.addEventListener('change', () => {
    chrome.storage.local.get('theme', ({ theme }) => {
      if (theme === 'system') {
        applySystemTheme();
      }
    });
  });
}

// 监听主题变化
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'themeChanged') {
    chrome.storage.local.get('theme', ({ theme }) => {
      // 如果是system模式，不应用传来的主题，因为系统主题可能不同
      if (theme !== 'system') {
        document.documentElement.setAttribute('data-theme', message.theme);
      }
    });
  }
});

/**
 * 保存笔记为Markdown文件
 * @param {string} content 要保存的内容
 */
async function saveNoteAsMarkdown(content) {
  try {
    // 获取当前网站名称
    let siteName = 'UnknownSite';

    try {
      // 使用Chrome扩展API获取当前标签页信息
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.title) {
        // 清理文件名，移除非法字符
        siteName = tab.title
          .replace(/[<>:"/\\|?*]/g, '') // 移除Windows文件名非法字符
          .replace(/\s+/g, '_') // 空格替换为下划线
          .substring(0, 50); // 限制长度避免文件名过长
      }
    } catch (error) {
      console.warn('无法获取网站名称:', error);
      // 如果无法获取网站名称，使用默认值
    }

    const filename = `${siteName}_OrangeSidebar.md`;

    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 清理URL对象
    URL.revokeObjectURL(url);

    // 显示保存成功提示
    showToast('笔记已保存', 'success');

  } catch (error) {
    console.error('保存笔记失败:', error);
    showToast('保存笔记失败', 'error');
  }
}

/**
 * 处理保存到知识库的功能
 * @param {string} completeText - 要保存的完整文本内容
 * @param {HTMLElement} buttonElement - 按钮元素（用于更新UI状态）
 */
async function handleSaveToKnowledgeBase(completeText, buttonElement) {
  const originalText = buttonElement.textContent;

  try {
    // 1. 检查知识库配置
    const qdrantConfig = await getValueFromChromeStorage('qdrant');

    if (!qdrantConfig || !qdrantConfig.enabled) {
      showToast('⚠️ 请先在设置页面启用知识库功能', 'warning');
      return;
    }

    if (!qdrantConfig.serverUrl) {
      showToast('⚠️ 请先在设置页面配置 Qdrant 服务器地址', 'warning');
      return;
    }

    if (!qdrantConfig.siliconflowApiKey) {
      showToast('⚠️ 请先在设置页面配置硅基流动 API Key', 'warning');
      return;
    }

    // 1.1 选择集合
    const collectionName = await promptForCollectionSelection(qdrantConfig);
    if (!collectionName) {
      showToast('已取消保存', 'info');
      return;
    }

    // 2. 显示加载状态
    buttonElement.textContent = 'Saving...';
    buttonElement.disabled = true;
    buttonElement.style.cursor = 'wait';

    // 3. 获取当前页面信息
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    const pageUrl = tab?.url || 'Unknown URL';
    const pageTitle = tab?.title || 'Untitled';

    // 4. 检查文本长度，决定是否需要分块
    const embeddingModel = qdrantConfig.embeddingModel || 'BAAI/bge-m3';
    const modelConfig = EMBEDDING_MODELS[embeddingModel];
    const estimatedTokens = estimateTokenCount(completeText);
    // 记录当前使用的模型名称（如果未能获取则标记为未知）
    const activeModel =
      (typeof getSelectedModel === 'function' && getSelectedModel()) ||
      selectedModel ||
      'Unknown Model';

    let embedding;
    let chunks = [];
    let embeddings = [];

    if (estimatedTokens > modelConfig.maxTokens) {
      // 需要分块处理
      console.log(`Content is too long (${estimatedTokens} tokens), chunking...`);

      // 分块（基于字符数，保守估计）
      const maxChunkChars = Math.floor(modelConfig.maxTokens * 1.3);  // 1.3字符≈1token
      chunks = chunkText(completeText, maxChunkChars, 200);

      showToast(`📄 内容较长，正在处理 ${chunks.length} 个分块...`, 'info');

      // 批量生成嵌入向量
      embeddings = await generateEmbeddingBatch(chunks, embeddingModel, qdrantConfig.vectorDimensions);
    } else {
      // 单个文本处理
      embedding = await generateEmbedding(completeText, embeddingModel, qdrantConfig.vectorDimensions);
    }

    // 5. 初始化 Qdrant 客户端并保存
    const kb = new QdrantKnowledgeBase();
    await kb.initialize();

    let result;
    if (chunks.length > 0) {
      // 批量保存分块内容
      result = await kb.saveBatchToKnowledgeBase({
        content: completeText,
        url: pageUrl,
        title: pageTitle,
        model: activeModel,
        contentType: getCurrentPromptMode(),
        chunks: chunks,
        embeddings: embeddings,
        collectionName
      });
    } else {
      // 保存单个内容
      result = await kb.saveToKnowledgeBase({
        content: completeText,
        url: pageUrl,
        title: pageTitle,
        model: activeModel,
        contentType: getCurrentPromptMode(),
        embedding: embedding,
        collectionName
      });
    }

    if (result.success) {
      // 6. 显示成功状态
      buttonElement.textContent = '✓ Saved';
      buttonElement.style.color = '#52c41a';

      showToast('✅ 已成功保存到知识库！', 'success');

      // 7. 更新最后保存时间
      await chrome.storage.local.set({ 'kb-last-saved': new Date().toISOString() });

      // 8. 2秒后恢复按钮状态
      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.color = 'var(--text-secondary)';
        buttonElement.disabled = false;
        buttonElement.style.cursor = 'pointer';
      }, 2000);
    } else {
      throw new Error(result.message || 'Unknown error');
    }

  } catch (error) {
    console.error('Failed to save to knowledge base:', error);

    // 显示错误状态
    buttonElement.textContent = '✗ Failed';
    buttonElement.style.color = '#ff4d4f';

    showToast(`❌ 保存失败: ${error.message}`, 'error');

    // 3秒后恢复按钮状态
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.style.color = 'var(--text-secondary)';
      buttonElement.disabled = false;
      buttonElement.style.cursor = 'pointer';
    }, 3000);
  }
}

/**
 * 获取当前提示词模式
 * @returns {string} 'summary' | 'paper' | 'learning' | 'default'
 */
function getCurrentPromptMode() {
  // 根据当前使用的系统提示判断模式
  // 这里可以通过全局变量或其他方式获取
  // 暂时返回 'summary' 作为默认值
  return 'summary';
}

/**
 * 弹窗选择要保存的集合
 * @param {Object} qdrantConfig
 * @returns {Promise<string|null>} 返回选中的集合名，取消返回null
 */
async function promptForCollectionSelection(qdrantConfig) {
  const defaultCollection = qdrantConfig.collectionName || 'orangesidebar-knowledge';
  let collections = [];
  try {
    const kb = new QdrantKnowledgeBase();
    await kb.initialize();
    collections = await kb.listCollections();
  } catch (e) {
    console.warn('load collections failed, fallback to default:', e);
  }

  // 获取用户上次选择的集合
  const lastSelectedResult = await chrome.storage.local.get(['lastSelectedCollection']);
  const lastSelectedCollection = lastSelectedResult.lastSelectedCollection;

  return new Promise(resolve => {
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '100000';

    // 容器
    const modal = document.createElement('div');
    modal.style.background = 'var(--bg-secondary)';
    modal.style.color = 'var(--text-primary)';
    modal.style.padding = '18px';
    modal.style.borderRadius = '10px';
    modal.style.minWidth = '320px';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';

    const title = document.createElement('div');
    title.textContent = '选择保存的知识库集合';
    title.style.fontWeight = '600';
    title.style.marginBottom = '10px';
    modal.appendChild(title);

    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '8px 10px';
    select.style.border = '1px solid var(--border-color)';
    select.style.borderRadius = '8px';
    select.style.background = 'var(--bg-primary)';
    select.style.color = 'var(--text-primary)';

    // 默认/配置集合放首位
    const uniqueCollections = Array.from(new Set([defaultCollection, ...collections].filter(Boolean)));
    uniqueCollections.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    // 优先使用上次选择的集合，如果该集合存在于列表中
    if (lastSelectedCollection && uniqueCollections.includes(lastSelectedCollection)) {
      select.value = lastSelectedCollection;
    } else {
      select.value = defaultCollection;
    }

    const inputLabel = document.createElement('div');
    inputLabel.textContent = '或输入新集合名：';
    inputLabel.style.margin = '10px 0 4px';
    inputLabel.style.fontSize = '13px';
    inputLabel.style.color = 'var(--text-secondary)';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '自定义集合名称';
    input.style.width = '93%';
    input.style.padding = '8px 10px';
    input.style.border = '1px solid var(--border-color)';
    input.style.borderRadius = '8px';
    input.style.background = 'var(--bg-primary)';
    input.style.color = 'var(--text-primary)';

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '10px';
    btnRow.style.marginTop = '14px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.padding = '8px 12px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.border = '1px solid var(--border-color)';
    cancelBtn.style.background = 'var(--bg-primary)';
    cancelBtn.style.color = 'var(--text-primary)';
    cancelBtn.style.cursor = 'pointer';

    const okBtn = document.createElement('button');
    okBtn.textContent = '保存';
    okBtn.style.padding = '8px 12px';
    okBtn.style.borderRadius = '8px';
    okBtn.style.border = 'none';
    okBtn.style.background = 'var(--accent-color)';
    okBtn.style.color = '#fff';
    okBtn.style.cursor = 'pointer';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);

    modal.appendChild(select);
    modal.appendChild(inputLabel);
    modal.appendChild(input);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    okBtn.onclick = () => {
      const manual = input.value.trim();
      const chosen = manual || select.value || defaultCollection;

      // 保存用户的选择到 Chrome storage
      chrome.storage.local.set({ lastSelectedCollection: chosen });

      cleanup();
      resolve(chosen);
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        okBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    };
  });
}

/**
 * 自动保存到知识库（使用默认集合，不弹窗）
 * @param {string} completeText
 * @param {string} activeModel
 */
async function autoSaveIfEnabled(completeText, activeModel) {
  try {
    const qdrantConfig = await getValueFromChromeStorage('qdrant');
    if (!qdrantConfig || !qdrantConfig.enabled || !qdrantConfig.autoSave) return;
    if (!qdrantConfig.serverUrl || !qdrantConfig.siliconflowApiKey) return;

    const collectionName = qdrantConfig.collectionName || 'orangesidebar-knowledge';
    const embeddingModel = qdrantConfig.embeddingModel || 'BAAI/bge-m3';
    const modelConfig = EMBEDDING_MODELS[embeddingModel];
    if (!modelConfig) return;

    const estimatedTokens = estimateTokenCount(completeText);
    let embedding;
    let chunks = [];
    let embeddings = [];

    if (estimatedTokens > modelConfig.maxTokens) {
      const maxChunkChars = Math.floor(modelConfig.maxTokens * 1.3);
      chunks = chunkText(completeText, maxChunkChars, 200);
      embeddings = await generateEmbeddingBatch(chunks, embeddingModel, qdrantConfig.vectorDimensions);
    } else {
      embedding = await generateEmbedding(completeText, embeddingModel, qdrantConfig.vectorDimensions);
    }

    const kb = new QdrantKnowledgeBase();
    await kb.initialize();

    if (chunks.length > 0) {
      await kb.saveBatchToKnowledgeBase({
        content: completeText,
        url: 'Unknown URL',
        title: 'Untitled',
        model: activeModel || 'Unknown Model',
        contentType: getCurrentPromptMode(),
        chunks,
        embeddings,
        collectionName
      });
    } else {
      await kb.saveToKnowledgeBase({
        content: completeText,
        url: 'Unknown URL',
        title: 'Untitled',
        model: activeModel || 'Unknown Model',
        contentType: getCurrentPromptMode(),
        embedding,
        collectionName
      });
    }
  } catch (e) {
    console.warn('Auto-save to knowledge base failed:', e);
  }
}

/**
 * 从知识库检索相似内容，并拼接到提示词前
 * @param {string} userQuestion
 * @returns {Promise<{text: string, sources: Array}>}
 */
async function buildKbAugmentedPrompt(userQuestion) {
  if (!kbRetrievalEnabled) {
    return { text: userQuestion, sources: [] };
  }

  try {
    const qdrantConfig = await getValueFromChromeStorage('qdrant');
    if (!qdrantConfig || !qdrantConfig.enabled || !qdrantConfig.serverUrl) {
      showToast('知识库未配置，已用原问题继续对话', 'warning');
      return { text: userQuestion, sources: [] };
    }

    const collections =
      (kbRetrievalCollections && kbRetrievalCollections.length > 0
        ? kbRetrievalCollections
        : [qdrantConfig.collectionName || 'orangesidebar-knowledge']
      ).filter(Boolean);

    const embeddingModel = qdrantConfig.embeddingModel || 'BAAI/bge-m3';
    const dimensions = qdrantConfig.vectorDimensions;
    const scoreThreshold =
      typeof qdrantConfig.scoreThreshold === 'number'
        ? qdrantConfig.scoreThreshold
        : 0.5;

    const queryEmbedding = await generateEmbedding(
      userQuestion,
      embeddingModel,
      dimensions
    );

    const kb = new QdrantKnowledgeBase();
    await kb.initialize();

    const allResults = [];
    for (const collectionName of collections) {
      const res =
        (await kb.searchSimilar(
          queryEmbedding,
          KB_TOP_K,
          null,
          collectionName,
          { scoreThreshold }
        )) || [];
      res.forEach(r => allResults.push({ ...r, collectionName }));
    }

    if (allResults.length === 0) {
      return { text: userQuestion, sources: [] };
    }

    const context = allResults
      .map(
        (hit, idx) =>
          `【${idx + 1}】[${hit.collectionName || '默认'}] 标题：${hit.title || '无标题'}\nURL：${
            hit.url || ''
          }\n内容：${hit.content}`
      )
      .join('\n\n');

    const augmented = `你是一个基于知识库的助手。请优先使用下列知识库片段回答用户问题，如信息不足请直说，勿编造。\n知识库集合：${collections.join(', ')}\n知识库片段：\n${context}\n\n用户问题：${userQuestion}`;

    return { text: augmented, sources: allResults };
  } catch (error) {
    console.warn('Knowledge base retrieval failed:', error);
    return { text: userQuestion, sources: [] };
  }
}

/**
 * 初始化知识库问答 UI
 */
async function initKnowledgeBaseRetrievalUI() {
  const toggle = document.getElementById('kb-retrieval-toggle');
  const picker = document.getElementById('kb-collection-picker');
  const status = document.getElementById('kb-retrieval-status');

  if (!toggle || !picker) return;

  // 读取存储
  const stored = await new Promise(resolve => {
    chrome.storage.local.get('kbRetrieval', resolve);
  });
  const saved = stored.kbRetrieval || {};
  kbRetrievalEnabled = !!saved.enabled;
  kbRetrievalCollections = Array.isArray(saved.collections)
    ? saved.collections
    : (saved.collection ? [saved.collection] : []);

  toggle.checked = kbRetrievalEnabled;
  if (status) {
    status.textContent = kbRetrievalEnabled ? '已启用' : '未启用';
  }

  toggle.addEventListener('change', () => {
    kbRetrievalEnabled = toggle.checked;
    chrome.storage.local.set({
      kbRetrieval: {
        enabled: kbRetrievalEnabled,
        collections: kbRetrievalCollections
      }
    });
    if (status) {
      status.textContent = kbRetrievalEnabled ? '已启用' : '未启用';
    }
  });

  picker.addEventListener('click', async () => {
    const selected = await openKbRetrievalCollectionModal(kbRetrievalCollections);
    if (selected) {
      kbRetrievalCollections = selected;
      chrome.storage.local.set({
        kbRetrieval: {
          enabled: kbRetrievalEnabled,
          collections: kbRetrievalCollections
        }
      });
      picker.textContent = kbRetrievalCollections.length > 0
        ? `已选 ${kbRetrievalCollections.length} 个`
        : '选择集合';
    }
  });

  // 初始化按钮显示
  picker.textContent = kbRetrievalCollections.length > 0
    ? `已选 ${kbRetrievalCollections.length} 个`
    : '选择集合';
}

/**
 * 打开知识库集合勾选弹窗
 * @param {string[]} currentSelections
 * @returns {Promise<string[]|null>}
 */
async function openKbRetrievalCollectionModal(currentSelections = []) {
  return new Promise(async resolve => {
    const qdrantConfig = await getValueFromChromeStorage('qdrant');
    if (!qdrantConfig || !qdrantConfig.enabled || !qdrantConfig.serverUrl) {
      showToast('请先在设置页配置 Qdrant', 'warning');
      resolve(null);
      return;
    }

    let collections = [];
    try {
      const kb = new QdrantKnowledgeBase();
      await kb.initialize();
      collections = await kb.listCollections();
    } catch (e) {
      console.error('加载集合失败:', e);
      showToast('加载集合失败', 'error');
      resolve(null);
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '12000';

    const modal = document.createElement('div');
    modal.style.background = 'var(--bg-secondary)';
    modal.style.color = 'var(--text-primary)';
    modal.style.padding = '18px';
    modal.style.borderRadius = '10px';
    modal.style.minWidth = '320px';
    modal.style.maxHeight = '70vh';
    modal.style.overflowY = 'auto';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';

    const title = document.createElement('div');
    title.textContent = '选择知识库集合（可多选）';
    title.style.fontWeight = '600';
    title.style.marginBottom = '10px';
    modal.appendChild(title);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    const uniqueCollections = Array.from(new Set(collections.filter(Boolean)));
    const selectedSet = new Set(currentSelections);
    uniqueCollections.forEach(name => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = name;
      checkbox.checked = selectedSet.has(name);

      const text = document.createElement('span');
      text.textContent = name;

      row.appendChild(checkbox);
      row.appendChild(text);
      list.appendChild(row);
    });

    modal.appendChild(list);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '10px';
    btnRow.style.marginTop = '14px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.padding = '8px 12px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.border = '1px solid var(--border-color)';
    cancelBtn.style.background = 'var(--bg-primary)';
    cancelBtn.style.color = 'var(--text-primary)';
    cancelBtn.style.cursor = 'pointer';

    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.padding = '8px 12px';
    okBtn.style.borderRadius = '8px';
    okBtn.style.border = 'none';
    okBtn.style.background = 'var(--accent-color)';
    okBtn.style.color = '#fff';
    okBtn.style.cursor = 'pointer';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    okBtn.onclick = () => {
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
      cleanup();
      resolve(selected);
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    };
  });
}

document.addEventListener('DOMContentLoaded', async function () {
  // 现有代码...
  initTheme();
});

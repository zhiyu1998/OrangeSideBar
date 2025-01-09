function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');

  // 从存储中获取当前主题
  chrome.storage.local.get('theme', ({ theme }) => {
    const currentTheme = theme || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.checked = currentTheme === 'dark';
  });

  // 监听主题切换
  themeToggle.addEventListener('change', (e) => {
    const newTheme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);

    // 保存主题设置
    chrome.storage.local.set({ theme: newTheme });

    // 通知其他页面更新主题
    chrome.runtime.sendMessage({ action: 'themeChanged', theme: newTheme });
  });
}

function storeParams(tabName, param1, param2, saveMessage, models = null) {
  console.log('Storing params for tab:', tabName, {
    baseUrl: param1,
    apiKey: '***',
    models: models
  }); // 添加日志

  // 获取已存储的数据
  chrome.storage.local.get(tabName, function (result) {
    let modelInfo = result[tabName] || {};
    console.log('Current stored model info:', modelInfo); // 添加日志

    if (tabName == 'quick-trans') {
      modelInfo.enabled = param1;
      modelInfo.selectedModel = param2;
    } else {
      // 保存 API 配置，同时保留现有的 models 数据
      modelInfo = {
        ...modelInfo,  // 保留现有数据
        baseUrl: param1,
        apiKey: param2,
        models: models || modelInfo.models || [] // 如果传入了新的模型列表就使用新的，否则保留现有的
      };

      // 如果是支持的模型供应商，更新全局模型列表
      if (models && isSupportedProvider(tabName)) {
        // 保存到全局模型列表
        chrome.storage.local.get('globalModels', function (result) {
          let globalModels = result.globalModels || {};
          console.log('Current global models:', globalModels); // 添加日志

          // 根据不同供应商处理模型数据
          if (tabName === PROVIDERS.GPT) {
            // OpenAI 模型处理
            globalModels[tabName] = models
              .filter(model => model.id && !model.id.includes('deprecated'))
              .map(model => ({
                value: model.id,
                label: model.id,
                provider: tabName
              }));
          } else {
            // 其他供应商的模型处理
            globalModels[tabName] = models.map(model => ({
              value: model.id,
              label: model.id,
              provider: tabName
            }));
          }

          console.log('Updated global models:', globalModels); // 添加日志
          chrome.storage.local.set({ globalModels }, () => {
            console.log('Saved global models successfully'); // 添加日志
            // 检查存储的数据
            chrome.storage.local.get('globalModels', (result) => {
              console.log('Verified stored global models:', result.globalModels);
            });
          });
        });
      }
    }

    // 保存到 Chrome 存储
    chrome.storage.local.set({ [tabName]: modelInfo }, function () {
      console.log('Saved:', { [tabName]: modelInfo });

      // 显示保存成功消息
      saveMessage.style.display = 'block';
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, 1000);

      // 如果有模型列表，更新显示
      if (models) {
        updateModelSelect(models, tabName);
      }
    });
  });
}

function openTab(evt, tabName) {
  // 隐藏所有tab content
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(function (content) {
    content.style.display = 'none';
  });

  // 激活当前tab content
  const tablinks = document.getElementsByClassName("tab-link");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  const activeTabContent = document.getElementById(tabName);
  activeTabContent.style.display = "block";
  evt.currentTarget.className += " active";

  // 如果是quick-trans标签，加载全局模型列表
  if (tabName === 'quick-trans') {
    loadGlobalModelsToQuickTrans();
  }

  // 从Chrome存储获取配置
  chrome.storage.local.get(tabName, function (result) {
    console.log('Loading tab data for:', tabName, result);

    const modelInfo = result[tabName];
    if (modelInfo) {
      console.log('Found stored model info:', modelInfo);

      // 设置API Key
      if (modelInfo.apiKey) {
        const apiKeyInput = activeTabContent.querySelector('.api-key-input');
        if (apiKeyInput) {
          apiKeyInput.value = modelInfo.apiKey;
          console.log('Set API key successfully');
        }
      }

      // 设置Base URL
      if (modelInfo.baseUrl) {
        const baseUrlInput = activeTabContent.querySelector('.baseurl-input');
        if (baseUrlInput) {
          baseUrlInput.value = modelInfo.baseUrl;
          console.log('Set base URL successfully');
        }
      }

      // 设置快捷翻译开关
      if (modelInfo.enabled !== undefined) {
        const toggleSwitch = document.getElementById('quickTransToggle');
        if (toggleSwitch) {
          toggleSwitch.checked = modelInfo.enabled;
        }
      }

      // 设置模型列表
      if (modelInfo.models && modelInfo.models.length > 0) {
        console.log('Found stored models:', modelInfo.models);
        updateModelSelect(modelInfo.models, tabName);
      }
    } else {
      console.log('No stored data found for tab:', tabName);
    }
  });
}

function togglePasswordVisibility(button) {
  var input = button.previousElementSibling;
  var eye = button.querySelector('.bi-eye');
  var eyeSlash = button.querySelector('.bi-eye-slash');

  if (input.type === 'password') {
    input.type = 'text';
    eye.style.display = 'block';
    eyeSlash.style.display = 'none';
  } else {
    input.type = 'password';
    eye.style.display = 'none';
    eyeSlash.style.display = 'block';
  }
}


/**
 * 获取模型基础信息，以便于检查模型接口配置的可用性
 * @param {string} baseUrl
 * @param {string} model
 * @param {string} apiKey
 * @returns
 */
function getModelBaseParamForCheck(baseUrl, model, apiKey) {
  let apiUrl, headers = {
    'Content-Type': 'application/json'
  };

  // 根据不同的模型设置不同的API路径
  if (model.includes(PROVIDERS.AZURE)) {
    apiUrl = `${baseUrl}${AZURE_MODELS_API_PATH}`;
    headers['api-key'] = apiKey;
  } else if (model.includes(PROVIDERS.GEMINI)) {
    apiUrl = `${baseUrl}${GEMINI_MODELS_API_PATH}`.replace('{API_KEY}', apiKey);
  } else if (model.includes(PROVIDERS.OLLAMA)) {
    apiUrl = `${baseUrl}${OLLAMA_LIST_MODEL_PATH}`;
  } else {
    // 其他模型使用标准的模型列表API路径
    const modelsPath = getModelsApiPath(model);
    apiUrl = `${baseUrl}${modelsPath}`;
    if (!model.includes(PROVIDERS.GEMINI)) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  return {
    apiUrl,
    params: {
      method: 'GET',
      headers: headers
    }
  };
}

/**
 * 获取模型列表API路径
 */
function getModelsApiPath(model) {
  if (model.includes(PROVIDERS.GPT)) return OPENAI_MODELS_API_PATH;
  if (model.includes(PROVIDERS.AZURE)) return AZURE_MODELS_API_PATH;
  if (model.includes(PROVIDERS.GEMINI)) return GEMINI_MODELS_API_PATH;
  if (model.includes(PROVIDERS.GROQ)) return GROQ_MODELS_API_PATH;
  if (model.includes(PROVIDERS.MISTRAL)) return MISTRAL_MODELS_API_PATH;
  if (model.includes(PROVIDERS.MOONSHOT)) return MOONSHOT_MODELS_API_PATH;
  if (model.includes(PROVIDERS.DEEPSEEK)) return DEEPSEEK_MODELS_API_PATH;
  if (model.includes(PROVIDERS.GITHUB)) return GITHUB_MODELS_API_PATH;
  return OPENAI_MODELS_API_PATH; // 默认返回OpenAI的路径
}

function getToolsParamForCheck(baseUrl, model, apiKey) {
  let apiUrl, body;

  if (model === SERPAPI_KEY) {
    apiUrl = `${baseUrl}/search?api_key=${apiKey}&q=test`;
    return {
      apiUrl,
      params: {
        method: 'GET'
      }
    };
  }
}

/**
 * 获取模型列表
 * @param {string} baseUrl 基础URL
 * @param {string} model 模型标识
 * @param {string} apiKey API密钥
 * @returns {Promise<Array>} 模型列表
 */
async function getModelList(baseUrl, model, apiKey) {
  let apiUrl = baseUrl;
  const headers = {
    'Content-Type': 'application/json'
  };

  // 根据不同模型供应商设置不同的API路径和headers
  if (model === PROVIDERS.GPT) {  // 修改这里，使用严格相等
    apiUrl += OPENAI_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.GLM)) {
    apiUrl += GLM_CHAT_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.MOONSHOT)) {
    apiUrl += MOONSHOT_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.DEEPSEEK)) {
    apiUrl += DEEPSEEK_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.GITHUB)) {
    apiUrl += GITHUB_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.AZURE)) {
    apiUrl += AZURE_MODELS_API_PATH;
    headers['api-key'] = apiKey;
  } else if (model.includes(PROVIDERS.GEMINI)) {
    apiUrl += GEMINI_MODELS_API_PATH.replace('{API_KEY}', apiKey);
  } else if (model.includes(PROVIDERS.GROQ)) {
    apiUrl += GROQ_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.SILICONFLOW)) {
    apiUrl += OPENAI_MODELS_API_PATH;  // 确保使用正确的 API 路径
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.MISTRAL)) {
    apiUrl += MISTRAL_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.OLLAMA)) {
    apiUrl += OLLAMA_LIST_MODEL_PATH;
  } else {
    apiUrl += OPENAI_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    console.log('Fetching models from:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    console.log('Received models data:', data);

    // 处理不同的返回格式
    if (model === 'gpt') {
      // OpenAI 格式处理
      const filteredModels = data.data
        .filter(model => {
          // 从 MODEL_MAPPINGS 获取所有 OpenAI 相关的前缀
          const validPrefixes = MODEL_MAPPINGS
            .filter(m => m.provider === 'gpt')
            .map(m => m.prefix)
            .flat();  // 展平数组

          // 检查是否以任一前缀开头
          const hasValidPrefix = validPrefixes.some(prefix =>
            model.id.startsWith(prefix)
          );

          // 排除废弃和测试模型
          const isNotDeprecated = !model.id.includes('deprecated');
          const isNotTest = !model.id.includes('test');

          return hasValidPrefix && isNotDeprecated && isNotTest;
        })
        .map(model => ({
          id: model.id,
          object: model.object,
          owned_by: model.owned_by
        }));

      console.log('Filtered OpenAI models:', filteredModels);
      return filteredModels;
    } else if (model.includes(PROVIDERS.GEMINI)) {
      // Gemini 格式处理
      return data.models.map(model => ({
        id: model.name.replace('models/', ''),  // 移除 'models/' 前缀
        object: 'model',
        owned_by: 'google'
      }));
    } else if (model.includes(PROVIDERS.GROQ)) {
      // Groq 格式处理 - 添加 groq- 前缀
      return data.data.map(model => ({
        id: `groq-${model.id}`,  // 添加 groq- 前缀
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model.includes(PROVIDERS.SILICONFLOW)) {
      // Siliconflow 格式处理
      return data.data.map(model => ({
        id: `siliconflow-${model.id}`,
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model.includes(PROVIDERS.GITHUB)) {
      // GitHub 格式处理
      return data.map(model => ({
        id: `github-${model.name}`, // 使用 name 而不是 id，因为原始id包含了完整路径
        object: 'model',  // 添加标准的 object 字段
        owned_by: model.publisher || 'unknown' // 使用 publisher 作为 owned_by
      }));
    } else {
      // 其他供应商的格式处理
      return data.data || data.models || [];
    }
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

/**
 * 更新模型列表
 */
function updateModelSelect(models, tabName) {
  const tabContent = document.getElementById(tabName);
  const modelList = tabContent.querySelector('#model-list');
  const loadingElement = tabContent.querySelector('.model-list-loading');
  const loadMoreBtn = tabContent.querySelector('.load-more-btn');

  if (!modelList) {
    console.warn('No model list found in tab:', tabName);
    return;
  }

  // 显示加载动画
  if (loadingElement) {
    loadingElement.style.display = 'flex';
  }
  modelList.classList.add('loading');

  // 过滤并创建所有模型项
  const filteredModels = models.filter(model => model.id && !model.id.includes('deprecated'));

  // 使用 requestAnimationFrame 确保动画流畅
  requestAnimationFrame(() => {
    // 更新存储中的模型列表
    chrome.storage.local.get(tabName, function (result) {
      const modelInfo = result[tabName] || {};
      modelInfo.models = models;

      chrome.storage.local.set({ [tabName]: modelInfo }, function () {
        // 使用 setTimeout 创建过渡效果
        setTimeout(() => {
          // 清空列表
          modelList.innerHTML = '';

          // 创建所有模型项
          filteredModels.forEach((model, index) => {
            const li = document.createElement('li');
            li.textContent = model.id;
            if (index >= MODELS_PER_PAGE) {
              li.classList.add('hidden');
            }
            modelList.appendChild(li);
          });

          // 更新加载更多按钮
          if (loadMoreBtn) {
            if (filteredModels.length > MODELS_PER_PAGE) {
              loadMoreBtn.style.display = 'block';
              const remainingCount = filteredModels.length - MODELS_PER_PAGE;
              const countSpan = loadMoreBtn.querySelector('.remaining-count');
              if (countSpan) {
                countSpan.textContent = `(还有 ${remainingCount} 个)`;
              }
            } else {
              loadMoreBtn.style.display = 'none';
            }
          }

          // 延迟移除加载状态
          setTimeout(() => {
            if (loadingElement) {
              loadingElement.style.display = 'none';
            }
            modelList.classList.remove('loading');
          }, 150);

          // 更新全局模型列表
          updateGlobalModels(tabName, models);
        }, 150);
      });
    });
  });
}

/**
 * 加载更多模型
 */
function loadMoreModels(tabContent) {
  if (!tabContent) return;

  const modelList = tabContent.querySelector('#model-list');
  const loadMoreBtn = tabContent.querySelector('.load-more-btn');

  if (!modelList || !loadMoreBtn) return;

  const hiddenItems = modelList.querySelectorAll('li.hidden');

  // 显示所有隐藏的模型
  hiddenItems.forEach(item => {
    item.classList.remove('hidden');
  });

  // 隐藏加载更多按钮
  loadMoreBtn.style.display = 'none';
}

/**
 * 更新全局模型列表
 * @param {string} provider 供应商标识
 * @param {Array} models 模型列表
 */
function updateGlobalModels(provider, models) {
  chrome.storage.local.get('globalModels', function (result) {
    let globalModels = result.globalModels || {};

    // 更新特定供应商的模型列表
    globalModels[provider] = models.map(model => ({
      value: model.id,
      label: model.id
    }));

    // 保存更新后的全局模型列表
    chrome.storage.local.set({ globalModels }, function () {
      // 重新加载划词翻译的模型选择下拉框
      loadGlobalModelsToQuickTrans();
    });
  });
}

/**
 * 检查API可用性
 */
function checkAPIAvailable(baseUrl, apiKey, model, resultElement) {
  const tabContent = resultElement.closest('.tab-content');
  const modelList = tabContent.querySelector('#model-list');
  const checkButton = tabContent.querySelector('.checkapi-button');
  const loadingElement = tabContent.querySelector('.model-list-loading');

  // 添加加载状态
  if (checkButton) {
    checkButton.disabled = true;
    checkButton.style.opacity = '0.7';
    checkButton.textContent = '检查中...';
  }

  // 显示加载动画
  if (loadingElement) {
    loadingElement.style.display = 'flex';
  }
  if (modelList) {
    modelList.classList.add('loading');
  }

  // 构建API请求参数
  let apiUrl, params;
  if (model.includes(TOOL_KEY)) {
    ({ apiUrl, params } = getToolsParamForCheck(baseUrl, model, apiKey));
  } else {
    ({ apiUrl, params } = getModelBaseParamForCheck(baseUrl, model, apiKey));
  }

  // API 检查逻辑
  fetch(apiUrl, params)
    .then(response => {
      if (response.ok) {
        resultElement.textContent = '检查通过';
        resultElement.className = 'checkapi-message success';
        resultElement.style.display = "block";

        // 获取模型列表
        return getModelList(baseUrl, model, apiKey);
      }
      throw new Error('API 请求失败，状态码：' + response.status);
    })
    .then(models => {
      if (models && models.length > 0) {
        const tabId = tabContent.id;
        const saveMessage = tabContent.querySelector('.save-message');

        const formattedModels = models.map(model => ({
          id: model.id,
          object: model.object || 'model',
          owned_by: model.owned_by || 'unknown'
        }));

        // 保存并更新模型列表
        storeParams(tabId, baseUrl, apiKey, saveMessage, formattedModels);
      }
    })
    .catch(error => {
      console.error('API check failed:', error);
      showErrorMessage(resultElement, '检查未通过');
    })
    .finally(() => {
      // 恢复按钮状态
      if (checkButton) {
        checkButton.disabled = false;
        checkButton.style.opacity = '1';
        checkButton.textContent = '连通性测试';
      }

      // 隐藏加载动画
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      if (modelList) {
        modelList.classList.remove('loading');
      }

      // 设置消息消失时间
      setTimeout(() => {
        resultElement.style.display = 'none';
      }, 2000);
    });
}

/**
 * 显示错误消息
 */
function showErrorMessage(element, message) {
  element.textContent = message;
  element.className = 'checkapi-message error';
  element.style.display = "block";
}

/**
 * 加载全局模型列表到划词翻译的模型选择下拉框
 */
function loadGlobalModelsToQuickTrans() {
  chrome.storage.local.get('globalModels', function (result) {
    if (!result.globalModels) {
      console.log('No global models found');
      return;
    }

    const modelSelect = document.getElementById('model-select');
    if (!modelSelect) {
      console.log('Model select element not found');
      return;
    }

    // 清空现有选项
    modelSelect.innerHTML = '';

    // 遍历每个供应商的模型
    Object.entries(result.globalModels).forEach(([provider, models]) => {
      if (!models || models.length === 0) return;

      // 创建供应商分组
      const group = document.createElement('optgroup');
      group.label = getProviderDisplayName(provider);

      // 添加该供应商的所有模型
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.value;
        group.appendChild(option);
      });

      modelSelect.appendChild(group);
    });

    // 恢复之前选择的模型
    chrome.storage.local.get('quick-trans', function (result) {
      if (result['quick-trans'] && result['quick-trans'].selectedModel) {
        modelSelect.value = result['quick-trans'].selectedModel;
      }
    });
  });
}

/**
 * 获取供应商的显示名称
 */
function getProviderDisplayName(provider) {
  return PROVIDER_DISPLAY_NAMES[provider] || provider.toUpperCase();
}

/**
 * 判断是否为支持的模型供应商
 */
function isSupportedProvider(provider) {
  console.log('isSupportedProvider', provider);

  return Object.values(PROVIDERS).includes(provider);
}

/**
 * 主程序
 */
document.addEventListener('DOMContentLoaded', function () {
  // 添加这段代码来加载默认标签页
  const defaultTab = document.querySelector('.tab-link[data-tab="general"]');
  if (defaultTab) {
    // 模拟点击第一个标签页
    defaultTab.click();
  }

  // 点击tab签
  var tabLinks = document.querySelectorAll('.tab-link');
  tabLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var tabName = this.getAttribute('data-tab');
      openTab(event, tabName);
    });
  });

  // 点击扩展
  document.querySelectorAll('.collapsible').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('active');
      const content = button.nextElementSibling;
      content.style.display = content.style.display === 'flex' ? 'none' : 'flex';
    });
  });

  // 点击保存按钮
  var saveButtons = document.querySelectorAll('.save-button');
  saveButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var tabContent = this.closest('.tab-content');
      var tabId = tabContent.id;
      console.log('Saving data for tab:', tabId);

      // 获取api key
      var input = tabContent.querySelector('.api-key-input');
      var apiKey = '';
      if (input) {
        apiKey = input.value;
      }

      // api 代理地址
      var baseUrlInput = tabContent.querySelector('.baseurl-input');
      var baseUrl = baseUrlInput.value;

      // 获取当前的模型列表
      const modelList = tabContent.querySelector('#model-list');
      let currentModels = [];
      if (modelList) {
        // 从存储中获取当前的模型列表
        chrome.storage.local.get(tabId, function (result) {
          currentModels = result[tabId]?.models || [];
          console.log('Saving values:', { tabId, baseUrl, apiKey, models: currentModels });
          // 保存所有数据
          var saveMessage = tabContent.querySelector('.save-message');
          storeParams(tabId, baseUrl, apiKey, saveMessage, currentModels);
        });
      } else {
        console.log('Saving values:', { tabId, baseUrl, apiKey });
        var saveMessage = tabContent.querySelector('.save-message');
        storeParams(tabId, baseUrl, apiKey, saveMessage);
      }
    });
  });

  // 点击检查接口可用性按钮
  let checkApiBtn = document.querySelectorAll('.checkapi-button');
  checkApiBtn.forEach(function (button) {
    button.addEventListener('click', function () {
      // 获取外层div的ID
      var tabContent = this.closest('.tab-content');
      var tabId = tabContent.id;

      const resultElement = tabContent.querySelector('.checkapi-message');

      // 获取api key
      var input = tabContent.querySelector('.api-key-input');
      var apiKey = '';
      if (input) {
        apiKey = input.value;
      }

      // api 代理地址
      var baseUrlInput = tabContent.querySelector('.baseurl-input');
      var baseUrl = baseUrlInput.value || baseUrlInput.getAttribute("placeholder");

      checkAPIAvailable(baseUrl, apiKey, tabId, resultElement);
    });
  });


  // 点击明文/密文展示秘钥
  var toggleButtons = document.querySelectorAll('.toggle-password');
  toggleButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      togglePasswordVisibility(this);
    });
  });

  // 保存快捷翻译配置
  const quickTransBtn = document.querySelector('.quicktrans-save-btn');
  quickTransBtn.addEventListener('click', function () {
    // 获取外层div的ID
    var tabContent = this.closest('.tab-content');
    var tabId = tabContent.id;

    // 是否开启快捷翻译
    const toggleSwitch = document.getElementById('quickTransToggle');
    const enabled = toggleSwitch.checked;

    // 模型选择
    const modelSelection = document.querySelector('#model-select');
    const selectedModel = modelSelection.value;

    // 保存KV & 显示保存成功
    var quickTransDiv = document.querySelector('#quick-trans');
    var saveMessage = quickTransDiv.querySelector('.save-message');
    storeParams(tabId, enabled, selectedModel, saveMessage);
  });

  // 加载全局模型列表到划词翻译的模型选择
  loadGlobalModelsToQuickTrans();

  // 当打开quick-trans标签页时也重新加载模型列表
  const quickTransTab = document.querySelector('[data-tab="quick-trans"]');
  if (quickTransTab) {
    quickTransTab.addEventListener('click', function () {
      loadGlobalModelsToQuickTrans();
    });
  }

  // 添加加载更多按钮的点击事件监听
  document.querySelectorAll('.load-more-btn').forEach(button => {
    button.addEventListener('click', function () {
      const tabContent = this.closest('.tab-content');
      loadMoreModels(tabContent);
    });
  });

  initThemeToggle();
});

// 修改显示消息的逻辑
function showMessage(element) {
  element.style.display = 'block';
  setTimeout(() => {
    element.style.display = 'none';
  }, 2000); // 2秒后消失
}


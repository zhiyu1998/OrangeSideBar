// 跟随系统主题的函数
function applySystemTheme() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = isDarkMode ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);

  // 通知其他页面更新主题
  chrome.runtime.sendMessage({ action: 'themeChanged', theme: theme });
}

function initThemeToggle() {
  // 主题选项的radio按钮
  const themeOptions = document.querySelectorAll('input[name="theme"]');

  // 从存储中获取当前主题
  chrome.storage.local.get('theme', ({ theme }) => {
    const currentTheme = theme || 'dark';

    // 设置当前选中的主题选项
    themeOptions.forEach(option => {
      if (option.value === currentTheme) {
        option.checked = true;
      }
    });

    // 应用主题
    if (currentTheme === 'system') {
      applySystemTheme();
    } else {
      document.documentElement.setAttribute('data-theme', currentTheme);
    }
  });

  // 监听主题切换
  themeOptions.forEach(option => {
    option.addEventListener('change', (e) => {
      const newTheme = e.target.value;

      // 保存主题设置
      chrome.storage.local.set({ theme: newTheme });

      // 应用主题
      if (newTheme === 'system') {
        applySystemTheme();
      } else {
        document.documentElement.setAttribute('data-theme', newTheme);
        // 通知其他页面更新主题
        chrome.runtime.sendMessage({ action: 'themeChanged', theme: newTheme });
      }
    });
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

function updateGlobalModels(provider, models) {
  chrome.storage.local.get('globalModels', function (result) {
    let globalModels = result.globalModels || {};
    console.log('Current global models:', globalModels); // 添加日志

    // 根据不同供应商处理模型数据
    if (provider === PROVIDERS.GPT) {
      // OpenAI 模型处理
      globalModels[provider] = models
        .filter(model => model.id && !model.id.includes('deprecated'))
        .map(model => ({
          value: model.id,
          label: model.id,
          provider: provider
        }));
    } else {
      // 其他供应商的模型处理
      globalModels[provider] = models.map(model => ({
        value: model.id,
        label: model.id,
        provider: provider
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
        updateGlobalModels(tabName, models);
      }
    }

    // 新增：存储免费过滤选项
    const freeOnlyFilter = document.getElementById('openrouter-free-only-filter')?.checked;
    if (freeOnlyFilter !== undefined) {
      localStorage.setItem('openrouter-free-only', freeOnlyFilter);
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

        const filterConfig = window.filterConfigurations.find(c => c.provider === tabName);

        if (filterConfig) {
          const isChecked = localStorage.getItem(filterConfig.storageKey) === 'true';
          const filteredModels = modelInfo.models.filter(model => filterConfig.filter(model, isChecked));
          updateModelSelect(filteredModels, tabName);
        } else {
          updateModelSelect(modelInfo.models, tabName);
        }
      } else if (tabName === PROVIDERS.GLM) {
        // 智谱清言使用固定模型列表
        const freeOnly = localStorage.getItem('glm-free-only') === 'true';
        const fixedModels = getGLMFixedModels(freeOnly);
        updateModelSelect(fixedModels, tabName);
      } else if (tabName === PROVIDERS.VOLCENGINE) {
        // 火山引擎使用固定模型列表
        const fixedModels = getVolcengineFixedModels();
        updateModelSelect(fixedModels, tabName);
      }
    } else {
      console.log('No stored data found for tab:', tabName);
      // 如果是智谱清言且没有存储数据，直接显示固定模型列表
      if (tabName === PROVIDERS.GLM) {
        const freeOnly = localStorage.getItem('glm-free-only') === 'true';
        const fixedModels = getGLMFixedModels(freeOnly);
        updateModelSelect(fixedModels, tabName);
      } else if (tabName === PROVIDERS.VOLCENGINE) {
        // 如果是火山引擎且没有存储数据，直接显示固定模型列表
        const fixedModels = getVolcengineFixedModels();
        updateModelSelect(fixedModels, tabName);
      }
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
  } else if (model.includes(PROVIDERS.MODELSCOPE)) {
    apiUrl = `${baseUrl}${MODELSCOPE_MODELS_API_PATH}`;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.NVIDIA)) {
    apiUrl = `${baseUrl}${NVIDIA_MODELS_API_PATH}`;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.POE)) {
    apiUrl = `${baseUrl}${POE_MODELS_API_PATH}`;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.GITHUB)) {
    apiUrl = `${baseUrl}${GITHUB_MODELS_API_PATH}`;
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  } else if (model.includes(PROVIDERS.ANTHROPIC)) {
    apiUrl = `${baseUrl}${ANTHROPIC_MODELS_API_PATH}`;
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    // 其他模型使用标准的模型列表API路径
    const modelsPath = getModelsApiPath(model);
    apiUrl = `${baseUrl}${modelsPath}`;
    if (!model.includes(PROVIDERS.GEMINI) && !model.includes(PROVIDERS.ANTHROPIC)) {
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
 * 获取智谱清言固定模型列表
 * @param {boolean} freeOnly - 是否只返回免费模型
 */
function getGLMFixedModels(freeOnly = false) {
  let modelsToUse = freeOnly ? GLM_FREE_MODELS : GLM_MODELS;
  return modelsToUse.map(modelId => ({
    id: modelId,
    object: 'model',
    owned_by: 'zhipu'
  }));
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
  if (model.includes(PROVIDERS.MODELSCOPE)) return MODELSCOPE_MODELS_API_PATH;
  if (model.includes(PROVIDERS.NVIDIA)) return NVIDIA_MODELS_API_PATH;
  if (model.includes(PROVIDERS.POE)) return POE_MODELS_API_PATH;
  if (model.includes(PROVIDERS.ANTHROPIC)) return ANTHROPIC_MODELS_API_PATH;
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
    headers['x-api-key'] = apiKey;
  } else if (model.includes(PROVIDERS.AZURE)) {
    apiUrl += AZURE_MODELS_API_PATH;
    headers['api-key'] = apiKey;
  } else if (model.includes(PROVIDERS.GEMINI)) {
    apiUrl += GEMINI_MODELS_API_PATH.replace('{API_KEY}', apiKey);
  } else if (model.includes(PROVIDERS.GROQ)) {
    apiUrl += GROQ_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.GROK)) {
    apiUrl += OPENAI_MODELS_API_PATH;  // Grok使用OpenAI兼容的API路径
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.SILICONFLOW)) {
    apiUrl += OPENAI_MODELS_API_PATH;  // 确保使用正确的 API 路径
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.OPENROUTER)) {
    apiUrl += OPENROUTER_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.MISTRAL)) {
    apiUrl += MISTRAL_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.OLLAMA)) {
    apiUrl += OLLAMA_LIST_MODEL_PATH;
  } else if (model.includes(PROVIDERS.NVIDIA)) {
    apiUrl += NVIDIA_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(PROVIDERS.POE)) {
    apiUrl += POE_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    apiUrl += OPENAI_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
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
          id: `openai-${model.id}`,
          object: model.object,
          owned_by: model.owned_by
        }));
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
    } else if (model.includes(PROVIDERS.GROK)) {
      // Grok 格式处理 - 添加 grok- 前缀
      return data.data.map(model => ({
        id: `grok-${model.id}`,  // 添加 grok- 前缀
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
    } else if (model.includes(PROVIDERS.OPENROUTER)) {
      // OpenRouter 格式处理
      return data.data
        .filter(modelData => {
          // 获取存储的过滤设置
          const showFreeOnly = localStorage.getItem('openrouter-free-only') === 'true';
          // 如果启用免费过滤，只保留包含:free的模型
          if (showFreeOnly) {
            return modelData.id.includes(':free');
          }
          return true; // 不过滤时返回所有模型
        })
        .map(model => ({
          id: `openrouter-${model.id}`,
          object: 'model',
          owned_by: model.name.split(':')[0] || 'unknown'
        }));
    } else if (model.includes(PROVIDERS.GITHUB)) {
      // GitHub 格式处理 - 根据实际API返回数据结构
      return data.map(model => {
        // 对于OpenAI模型，去掉"openai/"前缀，其他模型保持原样
        let modelId = model.id;
        if (modelId.startsWith('openai/')) {
          modelId = modelId.replace('openai/', '');
        } else {
          modelId = model.id;
        }
        return {
          id: `github-${modelId}`,
          object: 'model',
          owned_by: model.publisher || 'unknown' // 使用 publisher 作为 owned_by
        };
      });
    } else if (model.includes(PROVIDERS.MODELSCOPE)) {
      // ModelScope 格式处理 - 添加 modelscope- 前缀
      return (data.data || data.models || []).map(model => ({
        id: `modelscope-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'unknown'
      }));
    } else if (model.includes(PROVIDERS.NVIDIA)) {
      // NVIDIA 格式处理 - 添加 nvidia- 前缀
      return data.data.map(model => ({
        id: `nvidia-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'nvidia'
      }));
    } else if (model.includes(PROVIDERS.POE)) {
      // Poe 格式处理 - 添加 poe- 前缀
      return data.data.map(model => ({
        id: `poe-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'poe'
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
    }, 150);
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
 * 检查API可用性
 */
async function checkAPIAvailable(baseUrl, apiKey, model, resultElement) {
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

  try {
    // 智谱清言特殊处理：使用固定模型列表，只测试连通性
    if (model === PROVIDERS.GLM) {
      // 构建简单的连通性测试请求
      const apiUrl = `${baseUrl}${GLM_CHAT_API_PATH}`;
      const testParams = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: GLM_DEFAULT_MODEL,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      };

      // 发起连通性测试
      const response = await fetch(apiUrl, testParams);

      // 智谱清言API可能返回401等错误，但只要不是网络错误就说明连通性正常
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查您的 API Key');
      } else if (response.status >= 500) {
        throw new Error('服务器错误，请稍后重试');
      }

      // 显示成功消息
      resultElement.textContent = '检查通过';
      resultElement.className = 'checkapi-message success';
      resultElement.style.display = "block";

      // 使用固定模型列表
      const freeOnly = localStorage.getItem('glm-free-only') === 'true';
      const fixedModels = getGLMFixedModels(freeOnly);
      const tabId = tabContent.id;
      const saveMessage = tabContent.querySelector('.save-message');
      storeParams(tabId, baseUrl, apiKey, saveMessage, fixedModels);

      return;
    }

    // 火山引擎特殊处理：使用固定模型列表，只测试连通性
    if (model === PROVIDERS.VOLCENGINE) {
      // 构建简单的连通性测试请求
      const apiUrl = `${baseUrl}${VOLCENGINE_CHAT_API_PATH}`;
      const testParams = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: VOLCENGINE_DEFAULT_MODEL,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      };

      // 发起连通性测试
      const response = await fetch(apiUrl, testParams);

      // 火山引擎API可能返回401等错误，但只要不是网络错误就说明连通性正常
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查您的 API Key');
      } else if (response.status >= 500) {
        throw new Error('服务器错误，请稍后重试');
      }

      // 显示成功消息
      resultElement.textContent = '检查通过';
      resultElement.className = 'checkapi-message success';
      resultElement.style.display = "block";

      // 使用固定模型列表
      const fixedModels = getVolcengineFixedModels();
      const tabId = tabContent.id;
      const saveMessage = tabContent.querySelector('.save-message');
      storeParams(tabId, baseUrl, apiKey, saveMessage, fixedModels);

      return;
    }

    // 其他模型的原有逻辑
    // 构建API请求参数
    let apiUrl, params;
    if (model.includes(TOOL_KEY)) {
      ({ apiUrl, params } = getToolsParamForCheck(baseUrl, model, apiKey));
    } else {
      ({ apiUrl, params } = getModelBaseParamForCheck(baseUrl, model, apiKey));
    }

    // 发起API请求
    const response = await fetch(apiUrl, params);

    if (!response.ok) {
      throw new Error('API 请求失败，状态码：' + response.status);
    }

    // 显示成功消息
    resultElement.textContent = '检查通过';
    resultElement.className = 'checkapi-message success';
    resultElement.style.display = "block";

    // 直接处理响应数据
    const data = await response.json();

    // 处理模型数据
    let formattedModels = [];
    // TODO 如果要加一些特殊模型的处理可以在这里
    if (model === 'gpt') {
      // 处理 OpenAI 格式
      formattedModels = data.data.map(model => ({
        id: `openai-${model.id}`,
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model === 'gemini') {
      // Gemini格式
      formattedModels = data.models.map(model => ({
        id: `${model.name.replace("models\/", "")}`,
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model === 'openrouter') {
      formattedModels = data.data
        .filter(item => {
          const showFreeOnly = localStorage.getItem('openrouter-free-only') === 'true';
          if (showFreeOnly) {
            return item.id.includes(':free');
          }
          return true;
        }).map(model => ({
          id: `openrouter-${model.id}`,
          object: 'model',
          owned_by: model.name.split(':')[0] || 'unknown'
        }));
    } else if (model === 'siliconflow') {
      formattedModels = data.data.map(model => ({
        id: `siliconflow-${model.id}`,
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model === 'groq') {
      formattedModels = data.data.map(model => ({
        id: `groq-${model.id}`,
        object: model.object,
        owned_by: model.owned_by
      }));
    } else if (model === 'github') {
      // GitHub 格式处理
      formattedModels = data.map(model => {
        // 对于OpenAI模型，去掉"openai/"前缀，其他模型保持原样
        let modelId = model.id;
        if (modelId.startsWith('openai/')) {
          modelId = modelId.replace('openai/', '');
        } else {
          modelId = model.id;
        }
        return {
          id: `github-${modelId}`,
          object: 'model',
          owned_by: model.publisher || 'unknown'
        };
      });
    } else if (model.includes(PROVIDERS.MODELSCOPE)) {
      // ModelScope 格式处理
      formattedModels = (data.data || data.models || []).map(model => ({
        id: `modelscope-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'unknown'
      }));
    } else if (model.includes(PROVIDERS.NVIDIA)) {
      // NVIDIA 格式处理
      formattedModels = data.data.map(model => ({
        id: `nvidia-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'nvidia'
      }));
    } else if (model.includes(PROVIDERS.POE)) {
      // Poe 格式处理
      formattedModels = data.data.map(model => ({
        id: `poe-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'poe'
      }));
    } else if (model.includes(PROVIDERS.VOLCENGINE)) {
      // 火山引擎格式处理
      formattedModels = data.data.map(model => ({
        id: `volcengine-${model.id}`,
        object: model.object || 'model',
        owned_by: model.owned_by || 'volcengine'
      }));
    } else {
      formattedModels = data.data || data.models || [];
    }

    // 如果有模型数据，保存并更新显示
    if (formattedModels && formattedModels.length > 0) {
      const tabId = tabContent.id;
      const saveMessage = tabContent.querySelector('.save-message');
      storeParams(tabId, baseUrl, apiKey, saveMessage, formattedModels);
    }

  } catch (error) {
    console.error('API check failed:', error);
    showErrorMessage(resultElement, '检查未通过');
  } finally {
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
  }
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

      // 智谱清言特殊处理：使用固定模型列表
      if (tabId === PROVIDERS.GLM) {
        const freeOnly = localStorage.getItem('glm-free-only') === 'true';
        currentModels = getGLMFixedModels(freeOnly);
        console.log('Saving GLM values with fixed models:', { tabId, baseUrl, apiKey, models: currentModels });
        var saveMessage = tabContent.querySelector('.save-message');
        storeParams(tabId, baseUrl, apiKey, saveMessage, currentModels);
      } else if (tabId === PROVIDERS.VOLCENGINE) {
        // 火山引擎特殊处理：使用固定模型列表
        currentModels = getVolcengineFixedModels();
        console.log('Saving Volcengine values with fixed models:', { tabId, baseUrl, apiKey, models: currentModels });
        var saveMessage = tabContent.querySelector('.save-message');
        storeParams(tabId, baseUrl, apiKey, saveMessage, currentModels);
      } else if (modelList) {
        // 其他供应商从存储中获取当前的模型列表
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

  // 添加加载更多按钮的点击事件监听
  document.querySelectorAll('.load-more-btn').forEach(button => {
    button.addEventListener('click', function () {
      const tabContent = this.closest('.tab-content');
      loadMoreModels(tabContent);
    });
  });

  initThemeToggle();

  // Initialize prompt settings tab
  initPromptSettings();
});

// 修改显示消息的逻辑
function showMessage(element) {
  element.style.display = 'block';
  setTimeout(() => {
    element.style.display = 'none';
  }, 2000); // 2秒后消失
}

// Initialize prompt settings tab
function initPromptSettings() {
  const systemPromptTextarea = document.getElementById('systemPrompt');
  const resetSystemPromptBtn = document.getElementById('resetSystemPrompt');
  const saveSystemPromptBtn = document.getElementById('saveSystemPrompt');
  const summaryPromptTextarea = document.getElementById('summaryPrompt');
  const resetSummaryPromptBtn = document.getElementById('resetSummaryPrompt');
  const saveSummaryPromptBtn = document.getElementById('saveSummaryPrompt');
  const paperReadingPromptTextarea = document.getElementById('paperReadingPrompt');
  const resetPaperReadingPromptBtn = document.getElementById('resetPaperReadingPrompt');
  const savePaperReadingPromptBtn = document.getElementById('savePaperReadingPrompt');
  const learningModePromptTextarea = document.getElementById('learningModePrompt');
  const resetLearningModePromptBtn = document.getElementById('resetLearningModePrompt');
  const saveLearningModePromptBtn = document.getElementById('saveLearningModePrompt');

  if (!systemPromptTextarea || !resetSystemPromptBtn || !saveSystemPromptBtn) {
    return; // Elements not found, exit
  }

  // Load saved system prompt if exists
  chrome.storage.local.get(['systemPrompt'], function (result) {
    if (result.systemPrompt) {
      systemPromptTextarea.value = result.systemPrompt;
    } else {
      // Load default prompt from constants.js
      systemPromptTextarea.value = SYSTEM_PROMPT;
    }
  });

  // Reset system prompt to default
  resetSystemPromptBtn.addEventListener('click', function () {
    systemPromptTextarea.value = SYSTEM_PROMPT;
  });

  // Save custom system prompt
  saveSystemPromptBtn.addEventListener('click', function () {
    const customPrompt = systemPromptTextarea.value;
    if (customPrompt.trim() === '') {
      alert('提示词不能为空');
      return;
    }

    chrome.storage.local.set({ 'systemPrompt': customPrompt }, function () {
      const saveMessageElement = saveSystemPromptBtn.closest('.settings-section').querySelector('.save-message');
      showMessage(saveMessageElement);
    });
  });

  // Handle summary prompt settings if elements exist
  if (summaryPromptTextarea && resetSummaryPromptBtn && saveSummaryPromptBtn) {
    // Load saved summary prompt if exists
    chrome.storage.local.get(['summaryPrompt'], function (result) {
      if (result.summaryPrompt) {
        summaryPromptTextarea.value = result.summaryPrompt;
      } else {
        // Load default summary prompt from constants.js
        summaryPromptTextarea.value = SUMMARY_PROMPT;
      }
    });

    // Reset summary prompt to default
    resetSummaryPromptBtn.addEventListener('click', function () {
      summaryPromptTextarea.value = SUMMARY_PROMPT;
    });

    // Save custom summary prompt
    saveSummaryPromptBtn.addEventListener('click', function () {
      const customPrompt = summaryPromptTextarea.value;
      if (customPrompt.trim() === '') {
        alert('提示词不能为空');
        return;
      }

      chrome.storage.local.set({ 'summaryPrompt': customPrompt }, function () {
        const saveMessageElement = saveSummaryPromptBtn.closest('.settings-section').querySelector('.save-message');
        showMessage(saveMessageElement);
      });
    });
  }

  // Handle paper reading prompt settings if elements exist
  if (paperReadingPromptTextarea && resetPaperReadingPromptBtn && savePaperReadingPromptBtn) {
    // Load saved paper reading prompt if exists
    chrome.storage.local.get(['paperReadingPrompt'], function (result) {
      if (result.paperReadingPrompt) {
        paperReadingPromptTextarea.value = result.paperReadingPrompt;
      } else {
        // Load default paper reading prompt from constants.js
        paperReadingPromptTextarea.value = PAPER_READING_PROMPT;
      }
    });

    // Reset paper reading prompt to default
    resetPaperReadingPromptBtn.addEventListener('click', function () {
      paperReadingPromptTextarea.value = PAPER_READING_PROMPT;
    });

    // Save custom paper reading prompt
    savePaperReadingPromptBtn.addEventListener('click', function () {
      const customPrompt = paperReadingPromptTextarea.value;
      if (customPrompt.trim() === '') {
        alert('提示词不能为空');
        return;
      }

      chrome.storage.local.set({ 'paperReadingPrompt': customPrompt }, function () {
        const saveMessageElement = savePaperReadingPromptBtn.closest('.settings-section').querySelector('.save-message');
        showMessage(saveMessageElement);
      });
    });
  }

  // Handle learning mode prompt settings if elements exist
  if (learningModePromptTextarea && resetLearningModePromptBtn && saveLearningModePromptBtn) {
    // Load saved learning mode prompt if exists
    chrome.storage.local.get(['learningModePrompt'], function (result) {
      if (result.learningModePrompt) {
        learningModePromptTextarea.value = result.learningModePrompt;
      } else {
        // Load default learning mode prompt from constants.js
        learningModePromptTextarea.value = LEARNING_MODE_PROMPT;
      }
    });

    // Reset learning mode prompt to default
    resetLearningModePromptBtn.addEventListener('click', function () {
      learningModePromptTextarea.value = LEARNING_MODE_PROMPT;
    });

    // Save custom learning mode prompt
    saveLearningModePromptBtn.addEventListener('click', function () {
      const customPrompt = learningModePromptTextarea.value;
      if (customPrompt.trim() === '') {
        alert('提示词不能为空');
        return;
      }

      chrome.storage.local.set({ 'learningModePrompt': customPrompt }, function () {
        const saveMessageElement = saveLearningModePromptBtn.closest('.settings-section').querySelector('.save-message');
        showMessage(saveMessageElement);
      });
    });
  }
}

// Get active tab name
function getActiveTabName() {
  const activeTab = document.querySelector('.tab-link.active');
  return activeTab ? activeTab.getAttribute('data-tab') : null;
}

// 通用的模型过滤功能
function initProviderFilter(provider, checkboxId, storageKey, filterCallback) {
  const filterCheckbox = document.getElementById(checkboxId);
  if (filterCheckbox) {
    // 加载保存的过滤设置
    const savedFilter = localStorage.getItem(storageKey) === 'true';
    filterCheckbox.checked = savedFilter;

    // 添加事件监听器
    filterCheckbox.addEventListener('change', function () {
      const isChecked = this.checked;
      localStorage.setItem(storageKey, isChecked);

      // 重新获取并过滤模型列表
      chrome.storage.local.get(provider, function (result) {
        const modelInfo = result[provider];
        if (modelInfo && modelInfo.models) {
          const filteredModels = modelInfo.models.filter(model => filterCallback(model, isChecked));
          updateModelSelect(filteredModels, provider);
          updateGlobalModels(provider, filteredModels); // 更新全局模型
        } else if (provider === PROVIDERS.GLM) {
          // 对智谱清言进行特殊处理
          const fixedModels = getGLMFixedModels(isChecked);
          updateModelSelect(fixedModels, provider);
          updateGlobalModels(provider, fixedModels); // 更新全局模型
        } else if (provider === PROVIDERS.VOLCENGINE) {
          // 对火山引擎进行特殊处理
          const fixedModels = getVolcengineFixedModels();
          updateModelSelect(fixedModels, provider);
          updateGlobalModels(provider, fixedModels); // 更新全局模型
        }
      });

      console.log(`${provider} filter changed:`, isChecked);
    });
  }
}

// 在页面加载完成后初始化免费模型过滤功能
document.addEventListener('DOMContentLoaded', function () {
  // 延迟初始化，确保页面元素已加载
  setTimeout(() => {
    const filterConfigurations = [
      { provider: PROVIDERS.GLM, checkboxId: 'glm-free-only-filter', storageKey: 'glm-free-only', filter: (model, isChecked) => !isChecked || GLM_FREE_MODELS.includes(model.id) },
      { provider: PROVIDERS.OPENROUTER, checkboxId: 'openrouter-free-only-filter', storageKey: 'openrouter-free-only', filter: (model, isChecked) => !isChecked || model.id.includes(':free') },
      { provider: PROVIDERS.GITHUB, checkboxId: 'github-popular-only-filter', storageKey: 'github-popular-only', filter: (model, isChecked) => !isChecked || GITHUB_POPULAR_MODELS.includes(model.id) },
      { provider: PROVIDERS.NVIDIA, checkboxId: 'nvidia-recommended-only-filter', storageKey: 'nvidia-recommended-only', filter: (model, isChecked) => !isChecked || NVIDIA_RECOMMENDED_MODELS.includes(model.id) },
      { provider: PROVIDERS.POE, checkboxId: 'poe-popular-only-filter', storageKey: 'poe-popular-only', filter: (model, isChecked) => !isChecked || POE_POPULAR_MODELS.includes(model.id) }
    ];

    filterConfigurations.forEach(config => {
      initProviderFilter(config.provider, config.checkboxId, config.storageKey, config.filter);
    });

    // Make the configurations available to openTab
    window.filterConfigurations = filterConfigurations;
  }, 100);
});


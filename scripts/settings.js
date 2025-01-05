function storeParams(tabName, param1, param2, saveMessage, models = null) {
  console.log('Storing params for tab:', tabName, {
    baseUrl: param1,
    apiKey: '***',
    models: models
  }); // 添加日志

  // 获取已存储的数据
  chrome.storage.sync.get(tabName, function (result) {
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
      if (models && [
        'gpt',           // OpenAI
        'azure',         // Azure OpenAI
        'gemini',        // Google Gemini
        'anthropic',     // Anthropic (Claude)
        'groq',          // Groq
        'mistral',       // Mistral AI
        'zhipu',         // Zhipu AI
        'moonshot',      // Moonshot AI
        'deepseek',      // DeepSeek
        'yi',            // Yi
        'ollama'         // Ollama
      ].includes(tabName)) {
        // 保存到全局模型列表
        chrome.storage.sync.get('globalModels', function (result) {
          let globalModels = result.globalModels || {};
          console.log('Current global models:', globalModels); // 添加日志

          // 根据不同供应商处理模型数据
          if (tabName === 'gpt') {
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
          chrome.storage.sync.set({ globalModels }, () => {
            console.log('Saved global models successfully'); // 添加日志
            // 检查存储的数据
            chrome.storage.sync.get('globalModels', (result) => {
              console.log('Verified stored global models:', result.globalModels);
            });
          });
        });
      }
    }

    // 保存到 Chrome 存储
    chrome.storage.sync.set({ [tabName]: modelInfo }, function () {
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
  chrome.storage.sync.get(tabName, function (result) {
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
  let body = '';
  for (const { key, defaultBaseUrl, apiPath, defaultModel } of DEFAULT_LLM_URLS) {
    if (model.includes(key)) {
      let apiUrl = baseUrl || defaultBaseUrl;
      apiUrl += apiPath;

      if (model.includes(GEMINI_MODEL)) {
        apiUrl = apiUrl.replace('{MODEL_NAME}', defaultModel).replace('{API_KEY}', apiKey);

        body = JSON.stringify({
          contents: [{
            "role": "user",
            "parts": [{
              "text": "hi"
            }]
          }]
        });
      } else if (model.includes(AZURE_MODEL)) {
        apiUrl = apiUrl.replace('{MODEL_NAME}', defaultModel);
        body = JSON.stringify({
          stream: true,
          messages: [
            {
              "role": "user",
              "content": "hi"
            }
          ]
        });
      } else if (model.includes(OLLAMA_MODEL)) {
        apiUrl = baseUrl || defaultBaseUrl;
        apiUrl += OLLAMA_LIST_MODEL_PATH;
      } else {
        body = JSON.stringify({
          model: defaultModel,
          stream: true,
          messages: [
            {
              "role": "user",
              "content": "hi"
            }
          ]
        });
      }

      return { apiUrl, body };
    }
  }
}

function getToolsParamForCheck(baseUrl, model, apiKey) {
  let body = '';
  for (const { key, defaultBaseUrl, apiPath, defaultModel } of DEFAULT_TOOL_URLS) {
    if (model.includes(key)) {
      let apiUrl = baseUrl || defaultBaseUrl;
      apiUrl += apiPath;

      if (model.includes(SERPAPI_KEY)) {
        apiUrl = apiUrl.replace('{API_KEY}', apiKey).replace('{QUERY}', 'apple');
      } else if (model.includes(DALLE_KEY)) {
        body = JSON.stringify({
          model: defaultModel,
          prompt: "A cute baby sea otter",
          n: 1,
          size: "1024x1024"
        });
      }

      return { apiUrl, body };
    }
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
  if (model === 'gpt') {  // 修改这里，使用严格相等
    apiUrl += OPENAI_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(AZURE_MODEL)) {
    apiUrl += AZURE_MODELS_API_PATH;
    headers['api-key'] = apiKey;
  } else if (model.includes(GEMINI_MODEL)) {
    apiUrl += GEMINI_MODELS_API_PATH.replace('{API_KEY}', apiKey);
  } else if (model.includes(GROQ_MODEL)) {
    apiUrl += GROQ_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(MISTRAL_MODEL)) {
    apiUrl += MISTRAL_MODELS_API_PATH;
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (model.includes(OLLAMA_MODEL)) {
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
            .map(m => m.prefix);

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
    } else if (model.includes(GEMINI_MODEL)) {
      // Gemini 格式处理
      return data.models.map(model => ({
        id: model.name.replace('models/', ''),  // 移除 'models/' 前缀
        object: 'model',
        owned_by: 'google'
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
 * @param {Array} models 模型列表
 * @param {string} tabName 当前标签页名称
 */
function updateModelSelect(models, tabName) {
  // 获取当前标签页下的 model-list
  const tabContent = document.getElementById(tabName);
  console.log('Tab content:', tabContent); // 调试日志

  const modelList = tabContent.querySelector('#model-list');
  console.log('Model list element:', modelList); // 调试日志

  if (!modelList) {
    console.warn('No model list found in tab:', tabName);
    return;
  }

  const modelItems = models
    .filter(model => model.id && !model.id.includes('deprecated'))
    .map(model => {
      console.log('Processing model:', model); // 调试日志
      return `<li>${model.id}</li>`;
    })
    .join('');

  console.log('Generated model items:', modelItems); // 调试日志

  // 保存模型列表到存储
  chrome.storage.sync.get(tabName, function (result) {
    const modelInfo = result[tabName] || {};
    modelInfo.models = models;

    // 保留原有的配置
    chrome.storage.sync.set({
      [tabName]: modelInfo
    }, function () {
      // 更新列表
      modelList.innerHTML = modelItems;
      console.log('Updated model list HTML'); // 调试日志
    });
  });
}

/**
 * 修改现有的checkAPIAvailable函数
 */
function checkAPIAvailable(baseUrl, apiKey, model, resultElement) {
  var apiUrl, body;

  // 为了复用该函数，这里做一些trick
  if (model.includes(TOOL_KEY)) {
    ({ apiUrl, body } = getToolsParamForCheck(baseUrl, model, apiKey));
  } else {
    ({ apiUrl, body } = getModelBaseParamForCheck(baseUrl, model, apiKey));
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (model.includes(AZURE_MODEL)) {
    headers['api-key'] = apiKey;
  } else if (!model.includes(GEMINI_MODEL)) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let params = {
    method: "POST",
    headers: headers,
    body: body
  };

  if (model.includes(OLLAMA_MODEL) || model.includes(SERPAPI_KEY)) {
    params = {
      method: "GET"
    }
  }

  // 先测试连通性
  fetch(apiUrl, params)
    .then(response => {
      if (response.ok) {
        resultElement.textContent = '检查通过';
        resultElement.style.display = "block";

        // 连通性测试通过后获取模型列表
        getModelList(baseUrl, model, apiKey)
          .then(models => {
            if (models && models.length > 0) {
              console.log('Retrieved models for', model, ':', models); // 添加日志

              // 保存配置和模型列表
              const tabContent = resultElement.closest('.tab-content');
              const tabId = tabContent.id;
              console.log('Saving models for tab:', tabId); // 添加日志

              // 使用正确的 saveMessage 元素
              const saveMessage = tabContent.querySelector('.save-message');

              // 检查模型数据格式
              const formattedModels = models.map(model => {
                console.log('Processing model:', model); // 添加日志
                return {
                  id: model.id,
                  object: model.object || 'model',
                  owned_by: model.owned_by || 'unknown'
                };
              });
              console.log('Formatted models:', formattedModels); // 添加日志

              // 直接使用 storeParams 函数保存所有数据
              storeParams(tabId, baseUrl, apiKey, saveMessage, formattedModels);
            } else {
              console.warn('No models returned from API');
            }
          })
          .catch(error => {
            console.error('Error updating models:', error);
          });

        setTimeout(() => {
          resultElement.style.display = 'none';
        }, 1000);
      } else {
        throw new Error('API 请求失败，状态码：' + response.status);
      }
    })
    .catch(error => {
      console.error('API check failed:', error);
      resultElement.textContent = '检查未通过';
      resultElement.style.display = "block";
      setTimeout(() => {
        resultElement.style.display = 'none';
      }, 1000);
    });
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
        chrome.storage.sync.get(tabId, function (result) {
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

});


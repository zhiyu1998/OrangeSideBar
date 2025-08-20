// 对话历史（OpenAI兼容格式）
let dialogueHistory = [];

// 对话历史数组（gemini）
let geminiDialogueHistory = [];

// 获取当前时间
const currentTime = getCurrentTime();
const systemPrompt = SYSTEM_PROMPT.replace(/{current_time}/g, currentTime);

/**
 * 解析Base64图像格式
 * @param {string} base64String - 完整的Base64字符串（可能包含前缀）
 * @returns {object} - 包含mimeType和data的对象
 */
function parseBase64Image(base64String) {
  // 检查是否有data URI前缀
  let mimeType = 'image/jpeg'; // 默认MIME类型
  let data = base64String;

  // 如果是data URI格式 (例如: data:image/jpeg;base64,/9j/4AAQSkZ...)
  if (base64String.startsWith('data:')) {
    const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      data = matches[2];
    } else {
      // 如果格式不符合预期，尝试去掉前缀
      data = base64String.split(',')[1] || base64String;
    }
  }

  return {
    mimeType: mimeType,
    data: data
  };
}

// gemini system prompt
let geminiSystemPrompt = {
  "role": "model",
  "parts": [
    {
      "text": systemPrompt
    }
  ]
};

// 用于控制主动关闭请求
let currentController = null;

// 初始化system prompt
initChatHistory();

function cancelRequest() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
}

function initChatHistory() {
  dialogueHistory = [{
    "role": "system",
    "content": systemPrompt
  }];
  geminiDialogueHistory = []
}


/**
 * 根据不同的模型，选择对应的接口地址
 * @param {string} model
 * @returns
 */
async function getBaseUrlAndApiKey(model) {
  // 先检查所有非 GPT 的映射
  const nonGptMapping = MODEL_MAPPINGS
    .filter(m => m.provider !== PROVIDERS.GPT)
    .find(m => m.prefix.some(p => model.startsWith(p)));

  if (nonGptMapping) {
    // 检查是否配置了该服务商的信息
    const providerInfo = await getModelInfoFromChromeStorage(nonGptMapping.provider);
    if (providerInfo) {
      // 如果找到非 GPT 服务商的配置，使用该配置
      const defaultConfig = DEFAULT_LLM_URLS.find(url => url.key === nonGptMapping.provider);
      if (defaultConfig) {
        return {
          baseUrl: `${providerInfo.baseUrl || defaultConfig.baseUrl}${defaultConfig.apiPath}`,
          apiKey: providerInfo.apiKey
        };
      }
    }
  }

  // 如果没有找到非 GPT 的配置，或者配置不完整，检查是否是 GPT 的映射
  const gptMapping = MODEL_MAPPINGS
    .find(m => m.provider === PROVIDERS.GPT && m.prefix.some(p => model.startsWith(p)));

  if (gptMapping) {
    const providerInfo = await getModelInfoFromChromeStorage(gptMapping.provider);
    if (providerInfo) {
      const defaultConfig = DEFAULT_LLM_URLS.find(url => url.key === gptMapping.provider);
      if (defaultConfig) {
        return {
          baseUrl: `${providerInfo.baseUrl || defaultConfig.baseUrl}${defaultConfig.apiPath}`,
          apiKey: providerInfo.apiKey
        };
      }
    }
  }

  // 其他模型的处理
  for (const { key, baseUrl, apiPath } of DEFAULT_LLM_URLS) {
    if (model.includes(key)) {
      const modelInfo = await getModelInfoFromChromeStorage(key);
      let domain = baseUrl;
      let apiKey = '';
      if (modelInfo) {
        if (modelInfo.baseUrl) {
          domain = modelInfo.baseUrl;
        }
        if (modelInfo.apiKey) {
          apiKey = modelInfo.apiKey;
        }
      }
      return { baseUrl: `${domain}${apiPath}`, apiKey: apiKey };
    }
  }
  return { baseUrl: null, apiKey: null };
}

async function getModelInfoFromChromeStorage(modelKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(modelKey, function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const modelInfo = result[modelKey];
        if (modelInfo && modelInfo.baseUrl && modelInfo.apiKey) {
          resolve({ baseUrl: modelInfo.baseUrl, apiKey: modelInfo.apiKey });
        } else if (modelInfo && modelInfo.baseUrl) {
          resolve({ baseUrl: modelInfo.baseUrl });
        } else if (modelInfo && modelInfo.apiKey) {
          resolve({ apiKey: modelInfo.apiKey });
        } else {
          resolve(null);
        }
      }
    });
  });
}

async function getValueFromChromeStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const value = result[key];
        if (value) {
          resolve(value);
        } else {
          resolve(null);
        }
      }
    });
  });
}

/**
 * 动态构建请求头部和请求体的函数
 * @param {object} additionalHeaders
 * @param {object} body
 * @returns
 */
function createRequestParams(additionalHeaders, body) {
  let headers = {
    'Content-Type': 'application/json'
  };

  // 为每个请求创建一个新的 AbortController
  const controller = new AbortController();
  currentController = controller;
  headers = { ...headers, ...additionalHeaders };

  return {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  };
}

/**
 * call llm
 * @param {string} model
 * @param {string} inputText
 * @param {Array} base64Images
 * @param {string} type
 * @returns
 */
async function chatWithLLM(model, inputText, base64Images, type) {
  // Initialize chat history if not exists
  if (!window.chatHistory) {
    initChatHistory();
  }

  // Get custom system prompt if available
  const { systemPrompt } = await new Promise(resolve => {
    chrome.storage.local.get(['systemPrompt'], function (result) {
      resolve(result);
    });
  });

  // Use custom prompt if available, otherwise use default
  const promptToUse = systemPrompt || SYSTEM_PROMPT;

  // Get provider from model name
  const provider = getProviderDisplayName(model);

  // Get base URL and API key
  const { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);
  if (!baseUrl || !apiKey) {
    if (provider !== PROVIDERS.OLLAMA) {  // Ollama doesn't need an API key
      console.error("Base URL or API key not found for model:", model);
      return "请先去设置 Model 和 API KEY";
    }
  }

  // Create dialogue entries and update history
  const openaiDialogueEntry = createDialogueEntry('user', 'content', inputText, base64Images, model);
  const geminiDialogueEntry = createDialogueEntry('user', 'parts', inputText, base64Images, model);

  // Add to dialogue history
  dialogueHistory.push(openaiDialogueEntry);
  geminiDialogueHistory.push(geminiDialogueEntry);

  // Limit dialogue history length
  if (dialogueHistory.length > MAX_DIALOG_LEN) {
    dialogueHistory = dialogueHistory.slice(-MAX_DIALOG_LEN);
  }
  if (geminiDialogueHistory.length > MAX_DIALOG_LEN) {
    geminiDialogueHistory = geminiDialogueHistory.slice(-MAX_DIALOG_LEN);
  }

  // Check if model supports web search
  const hasWebSearch = isModelSupportWebSearch(model);

  // Create web search tool if needed
  const tools = [];
  if (hasWebSearch && type === AGENT_TYPE) {
    tools.push(createWebSearchTool());
  }

  // Add more tools based on model and type
  if (type === AGENT_TYPE) {
    const moreTools = await getToolsSelectedStatus();
    if (moreTools && moreTools.length > 0) {
      tools.push(...moreTools);
    }
  }

  // 使用不同的chat实现基于供应商
  try {
    let result;

    // 替换{current_time}占位符为实际时间
    const promptWithTime = promptToUse.replace('{current_time}', getCurrentTime());

    // 供应商特定的chat实现
    if (provider === PROVIDERS.GEMINI) {
      result = await chatWithGemini(baseUrl, model, type, tools);
    } else if (provider === PROVIDERS.OLLAMA) {
      // Ollama 实现
    } else if (provider === PROVIDERS.GROQ) {
      // Groq 使用 OpenAI 格式
      result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, promptWithTime);
    } else if (provider === PROVIDERS.GROK) {
      // Grok 也使用 OpenAI 格式
      result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, promptWithTime);
    } else if (provider === PROVIDERS.NVIDIA) {
      // NVIDIA 使用 OpenAI 格式
      result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, promptWithTime);
    } else if (provider === PROVIDERS.POE) {
      // Poe 使用 OpenAI 格式
      result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, promptWithTime);
    } else {
      // 默认 OpenAI-compatible 实现
      result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, tools, promptWithTime);
    }

    // Handle function calling
    while (result.tools && result.tools.length > 0) {
      result = await parseFunctionCalling(result, baseUrl, apiKey, model, type);
    }

    return result.completeText || result;
  } catch (error) {
    console.error("Error in chatWithLLM:", error);
    return `Error: ${error.message}`;
  }
}


/**
 * 创建web search工具配置
 */
function createWebSearchTool() {
  return {
    "type": "builtin_function",
    "function": {
      "name": "$web_search"
    }
  };
}

/**
 * 处理web search工具调用
 */
async function handleWebSearch(tool, baseUrl, apiKey, model, type) {
  const toolId = tool['id'];
  const toolName = tool['name'];
  let toolArgs = tool['arguments'];

  // Parse arguments if needed
  if (typeof toolArgs == 'string') {
    try {
      toolArgs = JSON.parse(toolArgs);
    } catch (error) {
      console.error('Error parsing arguments:', error);
    }
  }

  const contentDiv = document.querySelector('.chat-content');
  let lastDiv = contentDiv.lastElementChild;
  if (lastDiv.innerHTML.length > 0) {
    createAIMessageDiv();
    lastDiv = contentDiv.lastElementChild;
  }

  // 显示正在搜索的提示
  lastDiv.innerHTML = marked.parse('正在进行联网搜索...');

  // 直接返回参数,让Kimi内置的web search处理
  return toolArgs;
}

/**
 * 修改现有的parseFunctionCalling函数,添加web search的处理
 */
async function parseFunctionCalling(result, baseUrl, apiKey, model, type) {
  if (result.completeText.length > 0) {
    updateChatHistory(result.completeText);
  }

  if (result.tools.length > 0) {
    const tools = [];
    for (const tool of result.tools) {
      tools.push({
        id: tool.id,
        type: 'function',
        function: {
          name: tool.name,
          arguments: tool.arguments
        }
      });
    }
    updateToolChatHistory(tools);

    for (const tool of result.tools) {
      let toolResult;
      if (tool.name === '$web_search') {
        // 处理web search
        toolResult = await handleWebSearch(tool, baseUrl, apiKey, model, type);
      } else if (tool.name.includes('serpapi')) {
        // 从tool.arguments中解析查询参数
        let toolArgs;
        try {
          toolArgs = typeof tool.arguments === 'string' ?
            JSON.parse(tool.arguments) :
            tool.arguments;

          // 调用serpapi
          toolResult = await callSerpAPI(toolArgs.query);
        } catch (error) {
          console.error('Error parsing tool arguments:', error);
          throw new Error('无法解析工具参数: ' + error.message);
        }
      }

      updateToolCallChatHistory(tool, JSON.stringify(toolResult));
    }

    // 生成AI回答
    const contentDiv = document.querySelector('.chat-content');
    let lastDiv = contentDiv.lastElementChild;
    if (lastDiv.innerHTML.length > 0) {
      createAIMessageDiv();
    }

    let newResult = { completeText: '', tools: [] };
    if (model.includes(PROVIDERS.GEMINI)) {
      newResult = await chatWithGemini(baseUrl, model, type);
    } else {
      newResult = await chatWithOpenAIFormat(baseUrl, apiKey, model, type);
    }

    return newResult;
  }
}



/**
 * 处理 OpenAI 兼容数据格式
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {string} modelName
 * @param {string} type
 * @returns
 */
async function chatWithOpenAIFormat(baseUrl, apiKey, modelName, type, tools = [], systemPrompt = SYSTEM_PROMPT) {
  let realModelName = modelName;
  // 如果是 groq 模型,去掉 groq- 前缀
  if (modelName.startsWith('groq-')) {
    realModelName = modelName.substring(5);
  } else if (modelName.startsWith('siliconflow-')) {
    realModelName = realModelName.replace('siliconflow-', '');
  } else if (modelName.startsWith('openrouter-')) {
    realModelName = realModelName.replace('openrouter-', '');
  } else if (modelName.startsWith('github-')) {
    realModelName = realModelName.replace('github-', '');
  } else if (modelName.startsWith('Qwen-')) {
    // 使用映射表获取正确的模型名称
    realModelName = QWEN_MODEL_MAPPINGS[modelName] || modelName.replace('Qwen-', '').replace('2.5', '').toLowerCase() + '-latest';
  } else if (modelName.startsWith('openai-')) {
    realModelName = realModelName.replace("openai-", '');
  } else if (modelName.startsWith('modelscope-')) {
    realModelName = realModelName.replace('modelscope-', '');
  } else if (modelName.startsWith('nvidia-')) {
    realModelName = realModelName.replace('nvidia-', '');
  } else if (modelName.startsWith('poe-')) {
    realModelName = realModelName.replace('poe-', '');
  }

  // 获取 modelParams 参数
  const modelParams = await getModelParameters();

  // 初始化提问信息，增加工具相关的内容
  let systemContent = systemPrompt;
  if (type === AGENT_TYPE && tools.length > 0) {
    let toolPrompt = TOOL_PROMPT_PREFIX;
    tools.forEach(tool => {
      if (tool.type === 'builtin_function' && tool.function.name === '$web_search') {
        toolPrompt += WEB_SEARCH_PROMTP;
      }
    });
    systemContent = systemContent.replace(/{tools-list}/g, toolPrompt);
  } else {
    systemContent = systemContent.replace(/{tools-list}/g, '');
  }

  // 检查dialogueHistory是否已包含system消息
  const hasSystemMessage = dialogueHistory.some(msg => msg.role === 'system');

  // Create messages array with system prompt and dialogue history
  const messages = hasSystemMessage
    ? [...dialogueHistory]
    : [{ role: 'system', content: systemContent }, ...dialogueHistory];

  const body = {
    model: realModelName,
    temperature: modelParams.temperature,
    top_p: modelParams.topP,
    max_tokens: modelParams.maxTokens,
    stream: true,
    messages: messages,
    tools: []
  };

  // TODO: 重点关注，bug问题最多，mistral 的模型传以下两个参数会报错，这里过滤掉
  if (body.frequencyPenalty > 0 && body.presence_penalty > 0) {
    body.frequency_penalty = modelParams.frequencyPenalty;
    body.presence_penalty = modelParams.presencePenalty;
  }

  // 获取工具选择情况
  const serpapi_checked = await getValueFromChromeStorage(SERPAPI);
  if (serpapi_checked != null && serpapi_checked) {
    body.tools.push(FUNCTION_SERAPI);
  }
  // 如果tools数组为空，则删除tools属性
  if (body.tools.length === 0) {
    delete body.tools;
  }

  let additionalHeaders = { 'Authorization': 'Bearer ' + apiKey };

  if (modelName.includes(PROVIDERS.AZURE)) {
    baseUrl = baseUrl.replace('{MODEL_NAME}', realModelName);
    additionalHeaders = { 'api-key': apiKey };
  }

  const params = createRequestParams(additionalHeaders, body);
  // console.log("baseUrl>>>", baseUrl);
  // console.log("params>>>", params);

  return await fetchAndHandleResponse(baseUrl, params, modelName, type);
}

/**
 * 使用Gemini模型进行对话
 */
async function chatWithGemini(baseUrl, model, type, tools = [], systemPrompt = SYSTEM_PROMPT) {
  try {
    // 检查是否启用了web search
    const hasWebSearch = tools.some(tool =>
      tool.function && tool.function.name === WEB_SEARCH_TOOL.function.name
    );

    // 获取模型参数
    const { temperature, topP, maxTokens } = await getModelParameters();

    // 为 Gemini-2.5 系列模型调整 maxOutputTokens 参数
    let adjustedMaxTokens = maxTokens;
    if (model.includes('gemini-2.5')) {
      adjustedMaxTokens = 5120; // 为 Gemini-2.5 系列设置更高的 token 限制
    }

    // 处理系统提示词，替换时间和工具占位符
    const currentTime = getCurrentTime();
    let processedSystemPrompt = systemPrompt.replace(/{current_time}/g, currentTime);

    if (type === AGENT_TYPE && tools.length > 0) {
      let toolPrompt = TOOL_PROMPT_PREFIX;
      tools.forEach(tool => {
        if (tool.function && tool.function.name === '$web_search') {
          toolPrompt += WEB_SEARCH_PROMTP;
        }
      });
      processedSystemPrompt = processedSystemPrompt.replace(/{tools-list}/g, toolPrompt);
    } else {
      processedSystemPrompt = processedSystemPrompt.replace(/{tools-list}/g, '');
    }

    // 构建请求体
    const requestBody = {
      contents: [{
        parts: []
      }],
      generationConfig: {
        temperature: temperature,
        topP: topP,
        maxOutputTokens: adjustedMaxTokens
      }
    };

    // 添加系统指令（如果支持的话）
    if (processedSystemPrompt.trim()) {
      requestBody.systemInstruction = {
        parts: [{
          text: processedSystemPrompt
        }]
      };
    }

    // 正确处理对话历史，包括图像
    if (geminiDialogueHistory.length > 0) {
      // 遍历对话历史中的所有消息
      geminiDialogueHistory.forEach(msg => {
        if (msg.parts && Array.isArray(msg.parts)) {
          // 直接使用完整的parts数组，这样就能保留图像和其他非文本内容
          requestBody.contents[0].parts = requestBody.contents[0].parts.concat(msg.parts);
        }
      });
    }

    // 如果是 Gemini-2.5 系列，添加 thinkingConfig (如果未显式禁用)
    if (model.includes('gemini-2.5')) {
      requestBody.generationConfig.thinkingConfig = {
        includeThoughts: true
      };
    }

    // 如果是支持联网搜索的模型且启用了联网搜索,添加googleSearch工具
    if (GEMINI_SEARCH_MODELS.includes(model) && hasWebSearch) {
      requestBody.tools = [{
        googleSearch: {}
      }];
    }

    // 检查是否是思考模型，如果是则创建思考过程UI
    let thinkingDiv = null;
    const isThinkingModel = THINKING_PROCESS_MODELS.some(thinkingModel =>
      model.toLowerCase().includes(thinkingModel.toLowerCase())
    );

    if (isThinkingModel) {
      // 创建思考过程的对话框，放在最新的 AI 回答之前
      const contentDiv = document.querySelector('.chat-content');
      const lastDiv = contentDiv.lastElementChild;
      thinkingDiv = document.createElement('div');
      thinkingDiv.className = 'ai-thinking-message';
      
      // 如果是 Gemini 模型，添加特殊样式类
      if (model.includes('gemini-2.5')) {
        thinkingDiv.classList.add('gemini-thinking');
      }
      
      thinkingDiv.innerHTML = `
        <div class="thinking-header">
          <div class="thinking-indicator">
            <div class="thinking-spinner"></div>
            <span>AI 思考中...</span>
            <span class="thinking-time"></span>
          </div>
          <button class="thinking-toggle expanded">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div class="thinking-content" style="display: block;"></div>
      `;
      contentDiv.insertBefore(thinkingDiv, lastDiv);

      // 初始化开始时间和启动定时器
      thinkingDiv.dataset.startTime = Date.now();
      const timerId = setInterval(() => {
        if (thinkingDiv.dataset.startTime) {
          const startTime = parseInt(thinkingDiv.dataset.startTime);
          const elapsedTime = (Date.now() - startTime) / 1000;
          const timeSpan = thinkingDiv.querySelector('.thinking-time');
          if (timeSpan) {
            timeSpan.textContent = ` (${elapsedTime.toFixed(1)}s)`;
          }
        } else {
          clearInterval(timerId);
        }
      }, 100);

      // 添加点击事件处理
      const toggleBtn = thinkingDiv.querySelector('.thinking-toggle');
      const thinkingContent = thinkingDiv.querySelector('.thinking-content');
      toggleBtn.addEventListener('click', () => {
        const isHidden = thinkingContent.style.display === 'none';
        thinkingContent.style.display = isHidden ? 'block' : 'none';
        toggleBtn.classList.toggle('expanded');
      });
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let completeText = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 处理返回的数据
      const result = await processGeminiResponse(buffer, model, hasWebSearch, thinkingDiv);
      completeText = result.text;
      buffer = result.remainingBuffer;

      // 更新UI
      if (completeText) {
        updateChatContent(completeText, type);
      }
    }

    // 在完成读取后，将AI的回答添加到对话历史中
    if (completeText) {
      dialogueHistory.push({
        "role": "assistant",
        "content": completeText
      });

      geminiDialogueHistory.push({
        "role": "model",
        "parts": [{
          "text": completeText
        }]
      });
    }

    return {
      completeText: completeText,
      tools: [] // Gemini的工具调用结果会直接包含在返回文本中
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * 格式化 Gemini 的思考内容，实现结构化显示和 shimmer 效果
 */
function formatGeminiThinking(thinkingText) {
  // 将思考内容按段落分割
  const paragraphs = thinkingText.split('\n\n').filter(p => p.trim());
  
  let formattedHtml = '';
  
  paragraphs.forEach((paragraph, index) => {
    const lines = paragraph.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length > 0) {
      // 第一行作为标题，其余作为内容
      const title = lines[0];
      const content = lines.slice(1).join(' ');
      
      formattedHtml += `
        <div class="gemini-thinking-section">
          <div class="gemini-thinking-title">
            <span class="shimmer-text">${escapeHtml(title)}</span>
          </div>
          ${content ? `<div class="gemini-thinking-content">${escapeHtml(content)}</div>` : ''}
        </div>
      `;
    }
  });
  
  return formattedHtml || `<div class="gemini-thinking-section"><div class="gemini-thinking-title"><span class="shimmer-text">${escapeHtml(thinkingText)}</span></div></div>`;
}

/**
 * HTML 转义函数
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 处理Gemini响应数据
 */
async function processGeminiResponse(buffer, model, hasWebSearch, thinkingDiv = null) {
  let text = '';
  let thinkingText = '';
  let remainingBuffer = buffer;

  try {
    const lines = buffer.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(5);
        try {
          const data = JSON.parse(jsonStr);

          // 提取文本内容
          const content = data.candidates?.[0]?.content;
          if (content?.parts) {
            content.parts.forEach(part => {
              if (part.text) {
                if (part.thought) {
                  // 这是思考内容
                  // 检查是否为 Gemini 模型：Gemini 使用替换模式，其他模型使用追加模式
                  const isGeminiModel = thinkingDiv && thinkingDiv.classList.contains('gemini-thinking');
                  
                  if (isGeminiModel) {
                    // Gemini 模型：直接使用新内容替换
                    thinkingText = part.text;
                  } else {
                    // 其他模型：追加模式
                    thinkingText += part.text;
                  }
                  
                  // 更新思考过程UI
                  if (thinkingDiv) {
                    const thinkingContent = thinkingDiv.querySelector('.thinking-content');
                    if (thinkingContent) {
                      // 检查是否为 Gemini 模型，使用特殊的格式化
                      if (isGeminiModel) {
                        thinkingContent.innerHTML = formatGeminiThinking(thinkingText);
                      } else {
                        thinkingContent.innerHTML = marked.parse(thinkingText);
                      }
                      
                      // 确保思考内容区域滚动到最新内容
                      thinkingContent.scrollTop = thinkingContent.scrollHeight;
                    }
                  }
                } else {
                  // 这是正常回答内容
                  text += part.text;
                  
                  // 如果开始输出正常内容，说明思考完成
                  if (thinkingDiv && part.text && thinkingText) {
                    // 更新思考状态图标
                    const spinner = thinkingDiv.querySelector('.thinking-spinner');
                    if (spinner) {
                      spinner.classList.add('thinking-complete');
                    }

                    // 清除开始时间，停止计时器更新
                    if (thinkingDiv.dataset.startTime) {
                      const startTime = parseInt(thinkingDiv.dataset.startTime);
                      const elapsedTime = (Date.now() - startTime) / 1000;
                      
                      // 更新状态文本
                      const statusText = thinkingDiv.querySelector('.thinking-indicator span');
                      if (statusText) {
                        statusText.textContent = `思考完成 (${elapsedTime.toFixed(1)}s)`;
                      }
                      
                      delete thinkingDiv.dataset.startTime;
                    }

                    // 收起思考内容
                    const thinkingContent = thinkingDiv.querySelector('.thinking-content');
                    const toggleBtn = thinkingDiv.querySelector('.thinking-toggle');
                    if (thinkingContent && toggleBtn) {
                      thinkingContent.style.display = 'none';
                      toggleBtn.classList.remove('expanded');
                    }
                  }
                }
              }
            });
          }


          // 如果启用了联网搜索,处理搜索结果
          if (hasWebSearch && data.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const searchResults = data.candidates[0].groundingMetadata.groundingChunks
              .map(chunk => {
                const web = chunk.web;
                return `\n\n📌 来源: [${web.title}](${web.uri})`;
              })
              .join('\n');

            text += '\n\n### 参考来源' + searchResults;
          }
        } catch (error) {
          console.error('Error parsing JSON in Gemini response:', error, 'Line:', jsonStr);
        }
      }
    }
  } catch (error) {
    console.error('Error processing Gemini response:', error);
  }

  return {
    text,
    remainingBuffer
  };
}

/**
 * 从 chrome storage 中获取模型参数
 * @returns
 */
async function getModelParameters() {
  return {
    temperature: Number(await getValueFromChromeStorage('temperature') || DEFAULT_TEMPERATURE),
    topP: Number(await getValueFromChromeStorage('top_p') || DEFAULT_TOP_P),
    maxTokens: Number(await getValueFromChromeStorage('max_tokens') || DEFAULT_MAX_TOKENS),
    frequencyPenalty: Number(await getValueFromChromeStorage('frequency_penalty') || DEFAULT_FREQUENCY_PENALTY),
    presencePenalty: Number(await getValueFromChromeStorage('presence_penalty') || DEFAULT_PRESENCE_PENALTY)
  };
}

/**
 * LLM 接口请求 & 解析
 * @param {string} baseUrl
 * @param {string} params
 * @param {string} modelName
 * @param {string} type
 * @returns
 */
async function fetchAndHandleResponse(baseUrl, params, modelName, type) {
  let result = { resultString: '', resultArray: [] };
  try {
    const response = await fetch(baseUrl, params);
    if (!response.ok) {
      const errorJson = await response.json();
      console.error('Error response JSON:', errorJson);
      throw new Error("错误信息：" + errorJson.error.message);
    }

    const result = await parseAndUpdateChatContent(response, modelName, type);
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted...', completeText, '<<');
      return result;
    } else {
      console.error(error.message);
      throw new Error(error.message);
    }
  }
}

/**
 * 将输入转为适合 LLM 接口需要的数据需格式
 * @param {string} role
 * @param {string} partsKey
 * @param {string} text
 * @param {string} images
 * @returns
 */
function createDialogueEntry(role, partsKey, text, images, model) {
  const entry = { "role": role };

  // geimini
  if (partsKey === 'parts') {
    entry[partsKey] = [];
    if (text) {
      entry[partsKey].push({ "text": text });
    }
    if (images) {
      images.forEach(imageBase64 => {
        const parsedImage = parseBase64Image(imageBase64);
        entry[partsKey].push({
          "inline_data": {
            "mime_type": parsedImage.mimeType,
            "data": parsedImage.data
          }
        });
      });
    }
  } else {
    // OpenAI 兼容格式
    if (!images || images.length === 0) {
      entry[partsKey] = text ? text : '';
    } else {
      entry[partsKey] = [];
      if (text) {
        entry[partsKey].push({
          "type": "text",
          "text": text
        });
      }
      images.forEach(imageBase64 => {
        // 智谱的兼容OpenAI格式没做太好，这里的base64不能带前缀，特殊处理一下
        if (model.includes(PROVIDERS.GLM)) {
          imageBase64 = imageBase64.split(',')[1];
        }
        entry[partsKey].push({
          "type": "image_url",
          "image_url": { "url": imageBase64 }
        });
      });
    }
  }

  return entry;
}


/**
 * 更新对话历史
 * @param {string} text
 */
function updateChatHistory(text) {
  dialogueHistory.push({
    "role": "assistant",
    "content": text
  });
  geminiDialogueHistory.push({
    "role": "model",
    "parts": [{
      "text": text
    }]
  });
}

function updateToolChatHistory(tools) {
  // openai
  dialogueHistory.push({
    "role": "assistant",
    "content": '',
    "tool_calls": tools
  });

  // gemini
  const parts = []
  for (const tool of tools) {
    parts.push({
      "functionCall":
      {
        "name": tool.function.name,
        "args": JSON.parse(tool.function.arguments)
      }
    });
  }
  geminiDialogueHistory.push({
    "role": "model",
    "parts": parts
  });
}

function updateToolCallChatHistory(tool, content) {
  // openai
  dialogueHistory.push({
    "role": "tool",
    "tool_call_id": tool.id,
    "content": content
  });

  // gemini
  geminiDialogueHistory.push({
    "role": "function",
    "parts": [
      {
        "functionResponse": {
          "name": tool.name,
          "response": {
            "name": tool.name,
            "content": content
          }
        }
      }
    ]
  });
}


/**
 * 获取正文
 * @returns
 */
async function fetchPageContent(format = FORMAT_HTML) {
  try {
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab) {
      return new Promise((resolve, reject) => {
        let actionName = ACTION_FETCH_PAGE_CONTENT;
        if (format == FORMAT_TEXT) {
          actionName = ACTION_FETCH_TEXT_CONTENT;
        }
        chrome.tabs.sendMessage(tab.id, { action: actionName }, function (response) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else if (response && response.content) {
            resolve(response.content);
          } else {
            reject("No content returned");
          }
        });
      });
    } else {
      throw new Error("No active tab found");
    }
  } catch (error) {
    console.error("Error fetching page content:", error);
    throw error;
  }
}


/**
 * 获取当前打开的页面 URL
 * @returns
 */
async function getCurrentURL() {
  try {
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab) {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: ACTION_GET_PAGE_URL }, function (response) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else if (response && response.url) {
            resolve(response.url);
          } else {
            reject("No url returned");
          }
        });
      });
    } else {
      throw new Error("No active tab found");
    }
  } catch (error) {
    console.error("Error url:", error);
    throw error;
  }
}

/**
 * 解析模型返回结果，并更新到对话界面中
 * @param {object} response
 * @param {string} modelName
 * @param {string} type
 * @returns
 */
async function parseAndUpdateChatContent(response, modelName, type) {
  const reader = response.body.getReader();
  let completeText = '';
  let tools = [];
  let buffer = '';
  let reasoningContent = '';
  let thinkingDiv = null;

  // 添加调试日志
  console.log('Current model:', modelName);
  console.log('Thinking models:', THINKING_PROCESS_MODELS);

  // 修改为不区分大小写的判断
  const isThinkingModel = THINKING_PROCESS_MODELS.some(model =>
    modelName.toLowerCase().includes(model.toLowerCase())
  );
  console.log('Is thinking model?', isThinkingModel);

  if (isThinkingModel) {
    // 创建思考过程的对话框，放在最新的 AI 回答之前
    const contentDiv = document.querySelector('.chat-content');
    const lastDiv = contentDiv.lastElementChild;
    thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'ai-thinking-message';
    thinkingDiv.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-indicator">
          <div class="thinking-spinner"></div>
          <span>AI 思考中...</span>
          <span class="thinking-time"></span>
        </div>
        <button class="thinking-toggle expanded">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      <div class="thinking-content" style="display: block;"></div>
    `;
    contentDiv.insertBefore(thinkingDiv, lastDiv);

    // 初始化开始时间和启动定时器
    thinkingDiv.dataset.startTime = Date.now();
    setInterval(() => {
      if (thinkingDiv.dataset.startTime) {
        const startTime = parseInt(thinkingDiv.dataset.startTime);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const timeSpan = thinkingDiv.querySelector('.thinking-time');
        timeSpan.textContent = ` (${elapsedTime.toFixed(1)}s)`;
      }
    }, 100);

    // 添加点击事件处理
    const toggleBtn = thinkingDiv.querySelector('.thinking-toggle');
    const thinkingContent = thinkingDiv.querySelector('.thinking-content');
    toggleBtn.addEventListener('click', () => {
      const isHidden = thinkingContent.style.display === 'none';
      thinkingContent.style.display = isHidden ? 'block' : 'none';
      toggleBtn.classList.toggle('expanded');
    });
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value);
      let position = 0;

      while (position < buffer.length) {
        let start = buffer.indexOf('{', position);
        let end = buffer.indexOf('}\n', start);
        if (end == -1) {
          end = buffer.indexOf('}\r\n', start);
        }

        if (start === -1 || end === -1) {
          break;
        }

        // 尝试解析找到的JSON对象
        let jsonText = buffer.substring(start, end + 1);
        try {
          const jsonData = JSON.parse(jsonText);
          console.log('Response data:', jsonData);
          let content = '';

          // 处理思考过程输出，使用 isThinkingModel 替换原来的 isR1Model
          if (isThinkingModel) {
            if (jsonData.choices[0].delta.reasoning_content) {
              reasoningContent += jsonData.choices[0].delta.reasoning_content;
              // 更新思考内容
              if (thinkingDiv) {
                const thinkingContent = thinkingDiv.querySelector('.thinking-content');
                thinkingContent.innerHTML = marked.parse(reasoningContent);

                // 确保思考内容区域滚动到最新内容
                const contentDiv = document.querySelector('.thinking-content');
                contentDiv.scrollTop = contentDiv.scrollHeight; // 滚动到底部
              }
            } else if (jsonData.choices[0].delta.content) {
              // 检测到内容输出，说明思考已完成
              if (thinkingDiv) {
                // 更新思考状态图标
                const spinner = thinkingDiv.querySelector('.thinking-spinner');
                spinner.classList.add('thinking-complete');

                // 清除开始时间，停止计时器更新
                delete thinkingDiv.dataset.startTime;

                // 更新状态文本
                const statusText = thinkingDiv.querySelector('.thinking-indicator span');
                // 确保 startTime 存在再进行计算
                if (thinkingDiv.dataset.startTime) {
                  const startTime = parseInt(thinkingDiv.dataset.startTime);
                  const elapsedTime = (Date.now() - startTime) / 1000;
                  statusText.textContent = `思考完成 (${elapsedTime.toFixed(1)}s)`;
                } else {
                  statusText.textContent = '思考完成'; // 如果没有 startTime，则不显示时间
                }

                // 收起思考内容
                const thinkingContent = thinkingDiv.querySelector('.thinking-content');
                thinkingContent.style.display = 'none';
                const toggleBtn = thinkingDiv.querySelector('.thinking-toggle');
                toggleBtn.classList.remove('expanded');
              }
            }
          }

          // 如果是 Gemini 模型，并且不是 OpenAI规范出来的，那么就走这个逻辑
          if (modelName.includes(PROVIDERS.GEMINI) && !modelName.startsWith("openai-")) {
            jsonData.candidates[0].content.parts.forEach(part => {
              if (part.text !== undefined && part.text != null) {
                content += part.text;
              }

              // 检查 functionCall 字段
              if (part.functionCall !== undefined) {
                const func = part.functionCall;
                tools.push({
                  'id': generateUniqueId(),
                  'name': func.name,
                  'arguments': JSON.stringify(func.args)
                });
              }
            });
          } else if (modelName.includes(PROVIDERS.OLLAMA)) {
            content = jsonData.message.content;
          } else {
            jsonData.choices.forEach(choice => {
              const delta = choice.delta;
              if (delta.content !== undefined && delta.content !== null) {
                content += delta.content;
              }

              // 检查 tool_calls 字段
              if (delta.tool_calls !== undefined && Array.isArray(delta.tool_calls)) {
                delta.tool_calls.forEach(tool_call => {
                  const func = tool_call.function;
                  if (func) {
                    const index = tool_call.index;
                    if (tools.length < index + 1) {
                      tools.push({});
                      tools[index]['id'] = tool_call.id;
                      tools[index]['name'] = func.name;
                      tools[index]['arguments'] = func.arguments;
                    } else {
                      tools[index]['arguments'] += func.arguments;
                    }
                  }
                });
              }
            });
          }
          completeText += content;
          position = end + 1;
        } catch (error) {
          console.error('JSON parse error:', error);
          position = end + 1;
        }
      }
      buffer = buffer.substring(position);

      // 更新界面显示
      if (completeText.length > 0) {
        updateChatContent(completeText, type);
      }
    }

    // 完成后移除思考框
    // if (thinkingDiv) {
    //   const contentDiv = document.querySelector('.chat-content');
    //   contentDiv.removeChild(thinkingDiv);
    // }

    // 在完成读取后，将AI的回答添加到对话历史中
    if (completeText) {
      dialogueHistory.push({
        "role": "assistant",
        "content": completeText
      });

      geminiDialogueHistory.push({
        "role": "model",
        "parts": [{
          "text": completeText
        }]
      });
    }

    return {
      completeText: completeText,
      tools: tools
    };

  } catch (error) {
    if (thinkingDiv) {
      const contentDiv = document.querySelector('.chat-content');
      contentDiv.removeChild(thinkingDiv);
    }
    throw error;
  }
}

/**
 * 更新内容界面
 * @param {string} completeText
 * @param {string} type
 */
function updateChatContent(completeText, type) {
  if (type == CHAT_TYPE) {
    // loading
    const loadingDiv = document.querySelector('.my-extension-loading');
    loadingDiv.style.display = 'none';

    const contentDiv = document.querySelector('.chat-content');
    const isAtBottom = (contentDiv.scrollHeight - contentDiv.clientHeight) <= contentDiv.scrollTop;

    // update content
    const lastDiv = contentDiv.lastElementChild;
    lastDiv.innerHTML = marked.parse(completeText);

    // 渲染数学公式
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(lastDiv, {
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

    // 渲染Mermaid图表
    try {
      const mermaidElements = lastDiv.querySelectorAll('code.language-mermaid');
      if (mermaidElements.length > 0) {
        mermaidElements.forEach((element, index) => {
          const originalContent = element.textContent;
          const mermaidContainer = document.createElement('div');
          mermaidContainer.id = `mermaid-container-${Date.now()}-${index}`;
          mermaidContainer.className = 'mermaid';
          mermaidContainer.textContent = originalContent;

          // Replace the <pre> tag with the new container
          const preElement = element.closest('pre');
          if (preElement) {
            preElement.parentNode.replaceChild(mermaidContainer, preElement);
          }
        });
        mermaid.run({
          nodes: lastDiv.querySelectorAll('.mermaid')
        });
      }
    } catch (e) {
      console.error("Mermaid rendering error:", e);
    }

    if (isAtBottom) {
      contentDiv.scrollTop = contentDiv.scrollHeight; // 滚动到底部
    }
  }
}


async function callSerpAPI(query) {
  const keyStorage = await getValueFromChromeStorage(SERPAPI_KEY);
  let url = SERPAPI_BASE_URL + SERPAPI_PATH_URL;
  url = url.replace('{QUERY}', query);

  if (!keyStorage || !keyStorage.apiKey) {
    throw new Error(' SerAPI 工具的 API Key 未配置，请检查！');
  }

  url = url.replace('{API_KEY}', keyStorage.apiKey);

  const response = await fetch(url);
  // console.log(response);
  if (!response.ok) {
    // 错误响应
    const errorJson = await response.json();
    console.error('Error response JSON:', errorJson);
    throw new Error('Network response was not ok.');
  }

  const data = await response.json();

  // Extract answer_box and organic_results
  const answerBox = data.answer_box || {};
  const organicResults = data.organic_results || [];

  return {
    answerBox: answerBox,
    organicResults: organicResults
  };
}

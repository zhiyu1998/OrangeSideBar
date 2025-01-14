// 对话历史（OpenAI兼容格式）
let dialogueHistory = [];

// 对话历史数组（gemini）
let geminiDialogueHistory = [];

// 获取当前时间
const currentTime = getCurrentTime();
const systemPrompt = SYSTEM_PROMPT.replace(/{current_time}/g, currentTime);

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
    if (providerInfo && providerInfo.apiKey) {
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

  console.log('body>>>', body);

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
  var { baseUrl, apiKey } = await getBaseUrlAndApiKey(model);

  if (!baseUrl) {
    throw new Error('模型 ' + model + ' 的 API 代理地址为空，请检查！');
  }

  if (!apiKey) {
    throw new Error('模型 ' + model + ' 的 API Key 为空，请检查！');
  }

  // 如果是划词或划句场景，把system prompt置空
  if (type == HUACI_TRANS_TYPE) {
    dialogueHistory[0].content = '';
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

  // 获取当前启用的工具
  const toolsResult = await new Promise((resolve) => {
    chrome.storage.local.get(['selectedTools'], function (result) {
      resolve(result.selectedTools || []);
    });
  });

  let result = { completeText: '', tools: [] };
  if (model.includes(PROVIDERS.GEMINI)) {
    baseUrl = baseUrl.replace('{MODEL_NAME}', model).replace('{API_KEY}', apiKey);
    result = await chatWithGemini(baseUrl, model, type, toolsResult);
  } else {
    result = await chatWithOpenAIFormat(baseUrl, apiKey, model, type, toolsResult);
  }

  while (result.tools.length > 0) {
    result = await parseFunctionCalling(result, baseUrl, apiKey, model, type);
  }

  return result.completeText;
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
async function chatWithOpenAIFormat(baseUrl, apiKey, modelName, type) {
  let realModelName = modelName;
  // 如果是 groq 模型,去掉 groq- 前缀
  if (modelName.startsWith('groq-')) {
    realModelName = realModelName.replace('groq-', '');
  } else if (modelName.startsWith('siliconflow-')) {
    realModelName = realModelName.replace('siliconflow-', '');
  } else if (modelName.startsWith('github-')) {
    realModelName = realModelName.replace('github-', '');
  } else if (modelName.startsWith('Qwen-')) {
    // 使用映射表获取正确的模型名称
    realModelName = QWEN_MODEL_MAPPINGS[modelName] || modelName.replace('Qwen-', '').replace('2.5', '').toLowerCase() + '-latest';
  }

  const { temperature, topP, maxTokens, frequencyPenalty, presencePenalty } = await getModelParameters();

  const body = {
    model: realModelName,
    temperature: temperature,
    top_p: topP,
    max_tokens: maxTokens,
    stream: true,
    messages: dialogueHistory,
    tools: []
  };

  // mistral 的模型传以下两个参数会报错，这里过滤掉
  if (!modelName.includes(PROVIDERS.MISTRAL)) {
    body.frequency_penalty = frequencyPenalty;
    body.presence_penalty = presencePenalty;
  }

  // 获取工具选择情况
  const serpapi_checked = await getValueFromChromeStorage(SERPAPI);
  let tools_list_prompt = TOOL_PROMPT_PREFIX;
  if (serpapi_checked != null && serpapi_checked) {
    tools_list_prompt += WEB_SEARCH_PROMTP;
    body.tools.push(FUNCTION_SERAPI);
  }
  // 如果tools数组为空，则删除tools属性
  if (body.tools.length === 0) {
    delete body.tools;
  }

  // 根据选择的工具状态来更新 system prompt
  dialogueHistory[0].content = systemPrompt.replace('{tools-list}', tools_list_prompt);

  let additionalHeaders = { 'Authorization': 'Bearer ' + apiKey };

  if (modelName.includes(PROVIDERS.AZURE)) {
    baseUrl = baseUrl.replace('{MODEL_NAME}', realModelName);
    additionalHeaders = { 'api-key': apiKey };
  }

  const params = createRequestParams(additionalHeaders, body);
  console.log(baseUrl);
  console.log(params);

  return await fetchAndHandleResponse(baseUrl, params, modelName, type);
}

/**
 * 使用Gemini模型进行对话
 */
async function chatWithGemini(baseUrl, model, type, tools = []) {
  try {
    // 检查是否启用了web search
    const hasWebSearch = tools.some(tool =>
      tool.function && tool.function.name === WEB_SEARCH_TOOL.function.name
    );

    // 获取模型参数
    const { temperature, topP, maxTokens } = await getModelParameters();

    // 构建请求体
    const requestBody = {
      contents: [{
        parts: geminiDialogueHistory.map(msg => ({
          text: msg.parts[0].text
        }))
      }],
      generationConfig: {
        temperature: temperature,
        topP: topP,
        maxOutputTokens: maxTokens
      }
    };

    // 如果是支持联网搜索的模型且启用了联网搜索,添加googleSearch工具
    if (GEMINI_SEARCH_MODELS.includes(model) && hasWebSearch) {
      requestBody.tools = [{
        googleSearch: {}
      }];
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
      const result = await processGeminiResponse(buffer, model, hasWebSearch);
      completeText = result.text;
      buffer = result.remainingBuffer;

      // 更新UI
      if (completeText) {
        updateChatContent(completeText, type);
      }
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
 * 处理Gemini响应数据
 */
async function processGeminiResponse(buffer, model, hasWebSearch) {
  let text = '';
  let remainingBuffer = buffer;

  try {
    const lines = buffer.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(5);
        const data = JSON.parse(jsonStr);

        // 提取文本内容
        const content = data.candidates?.[0]?.content;
        if (content?.parts) {
          text += content.parts.map(part => part.text || '').join('');
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
    // console.log(response);
    if (!response.ok) {
      // 错误响应
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
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // 处理接收到的数据
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
          let content = '';
          if (modelName.includes(PROVIDERS.GEMINI)) {
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
          console.error('Failed to parse JSON:', error);
          position = end + 1;
        }
      }
      buffer = buffer.substring(position);

      // 更新界面显示
      if (completeText.length > 0) {
        updateChatContent(completeText, type);
      }
    }
  } catch (error) {
    throw error;
  } finally {
    return {
      completeText: completeText,
      tools: tools
    };
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

    if (isAtBottom) {
      contentDiv.scrollTop = contentDiv.scrollHeight; // 滚动到底部
    }

  } else if (type == HUACI_TRANS_TYPE) {
    // popup
    const translationPopup = document.querySelector('#fisherai-transpop-id');
    if (translationPopup) {
      translationPopup.style.display = 'block';
      translationPopup.innerHTML = marked.parse(completeText);
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

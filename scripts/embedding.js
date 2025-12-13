/**
 * embedding.js - 嵌入向量生成模块
 *
 * 提供文本嵌入向量生成功能，支持硅基流动的多种嵌入模型
 * 用于将文本转换为向量，以便存储到向量数据库（如Qdrant）
 */

/**
 * 生成文本嵌入向量
 * @param {string} text - 输入文本
 * @param {string} model - 嵌入模型名称，默认为 'BAAI/bge-m3'
 * @param {number|null} dimensions - 输出维度（可选，仅支持特定模型）
 * @returns {Promise<number[]>} 嵌入向量数组
 * @throws {Error} 如果API Key未配置或模型不支持
 */
async function generateEmbedding(text, model = 'BAAI/bge-m3', dimensions = null) {
  // 1. 获取硅基流动配置
  const siliconflowConfig = await getValueFromChromeStorage('siliconflow');

  if (!siliconflowConfig || !siliconflowConfig.apiKey) {
    throw new Error('SiliconFlow API key not configured. Please set it in Settings page.');
  }

  // 2. 获取模型配置
  const modelConfig = EMBEDDING_MODELS[model];
  if (!modelConfig) {
    throw new Error(`Unsupported embedding model: ${model}. Available models: ${Object.keys(EMBEDDING_MODELS).join(', ')}`);
  }

  // 3. 检查文本长度（粗略估算：1 token ≈ 1.5 字符）
  const estimatedTokens = Math.ceil(text.length / 1.5);
  if (estimatedTokens > modelConfig.maxTokens) {
    console.warn(`Text length (~${estimatedTokens} tokens) may exceed model's max tokens (${modelConfig.maxTokens}). Consider using chunkText() to split.`);
  }

  // 4. 构建请求
  const baseUrl = siliconflowConfig.baseUrl || SILICONFLOW_BASE_URL;
  const requestBody = {
    model: model,
    input: text,
    encoding_format: 'float'
  };

  // 添加维度参数（仅支持的模型）
  if (dimensions && modelConfig.supportedDimensions?.includes(dimensions)) {
    requestBody.dimensions = dimensions;
  } else if (dimensions) {
    console.warn(`Dimensions ${dimensions} not supported for model ${model}. Using default dimensions.`);
  }

  // 5. 发送请求
  try {
    const response = await fetch(`${baseUrl}${SILICONFLOW_EMBEDDINGS_API_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${siliconflowConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        // 如果无法解析错误JSON，使用默认错误消息
      }
      throw new Error(`Embedding API error: ${errorMessage}`);
    }

    // 6. 解析响应
    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response format from embedding API');
    }

    return data.data[0].embedding;

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to SiliconFlow API. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * 批量生成嵌入向量（优化成本，减少API调用次数）
 * @param {string[]} texts - 文本数组
 * @param {string} model - 嵌入模型
 * @param {number|null} dimensions - 输出维度（可选）
 * @returns {Promise<number[][]>} 嵌入向量数组
 */
async function generateEmbeddingBatch(texts, model = 'BAAI/bge-m3', dimensions = null) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('texts must be a non-empty array');
  }

  const siliconflowConfig = await getValueFromChromeStorage('siliconflow');

  if (!siliconflowConfig || !siliconflowConfig.apiKey) {
    throw new Error('SiliconFlow API key not configured. Please set it in Settings page.');
  }

  const modelConfig = EMBEDDING_MODELS[model];
  if (!modelConfig) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }

  const baseUrl = siliconflowConfig.baseUrl || SILICONFLOW_BASE_URL;
  const requestBody = {
    model: model,
    input: texts,  // 数组输入
    encoding_format: 'float'
  };

  if (dimensions && modelConfig.supportedDimensions?.includes(dimensions)) {
    requestBody.dimensions = dimensions;
  }

  try {
    const response = await fetch(`${baseUrl}${SILICONFLOW_EMBEDDINGS_API_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${siliconflowConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        // 忽略解析错误
      }
      throw new Error(`Embedding API error: ${errorMessage}`);
    }

    const data = await response.json();

    // 按 index 排序返回
    return data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to SiliconFlow API.');
    }
    throw error;
  }
}

/**
 * 文本分块处理（用于超长内容）
 * 当文本超过模型最大token限制时，将其分割成多个小块
 *
 * @param {string} text - 原始文本
 * @param {number} maxChunkSize - 每块最大字符数（默认6000，约4000 tokens）
 * @param {number} overlap - 重叠字符数（默认200，避免语义断裂）
 * @returns {string[]} 文本块数组
 *
 * @example
 * const longText = "...很长的文本...";
 * const chunks = chunkText(longText, 6000, 200);
 * const embeddings = await generateEmbeddingBatch(chunks);
 */
function chunkText(text, maxChunkSize = 6000, overlap = 200) {
  if (!text || typeof text !== 'string') {
    throw new Error('text must be a non-empty string');
  }

  if (text.length <= maxChunkSize) {
    return [text];  // 无需分块
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    // 移动到下一块，保持overlap重叠
    start = end - overlap;

    // 防止无限循环
    if (start >= text.length - overlap) {
      break;
    }
  }

  return chunks;
}

/**
 * 估算文本的token数量
 * @param {string} text - 输入文本
 * @returns {number} 估算的token数量
 */
function estimateTokenCount(text) {
  if (!text) return 0;

  // 粗略估算规则：
  // - 中文：1个字符 ≈ 1 token
  // - 英文：1个单词 ≈ 1 token，平均4-5个字符
  // - 综合估算：1.5个字符 ≈ 1 token
  return Math.ceil(text.length / 1.5);
}

/**
 * 获取嵌入模型的配置信息
 * @param {string} model - 模型名称
 * @returns {Object|null} 模型配置对象
 */
function getEmbeddingModelConfig(model) {
  return EMBEDDING_MODELS[model] || null;
}

/**
 * 获取所有可用的嵌入模型列表
 * @returns {Array<{name: string, displayName: string, maxTokens: number, defaultDimensions: number}>}
 */
function getAvailableEmbeddingModels() {
  return Object.entries(EMBEDDING_MODELS).map(([name, config]) => ({
    name: name,
    displayName: config.displayName,
    maxTokens: config.maxTokens,
    defaultDimensions: config.defaultDimensions,
    supportedDimensions: config.supportedDimensions
  }));
}

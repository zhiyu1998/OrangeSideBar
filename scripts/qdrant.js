/**
 * qdrant.js - Qdrant向量数据库客户端封装
 *
 * 基于 qdrant-js.min.js SDK，提供简化的知识库操作接口
 * 用于保存、搜索和管理网页总结的向量数据
 */

/**
 * 等待 QdrantClient 加载完成
 * @returns {Promise<typeof QdrantClient>}
 */
let qdrantClientLoadPromise = null;
async function waitForQdrantClient() {
  // 如果已经加载，直接返回
  if (typeof window.QdrantClient !== 'undefined') {
    return window.QdrantClient;
  }

  // 在 MV3 扩展页面中，内联 script 会被 CSP 阻止执行，因此这里通过动态 import 来加载 SDK
  if (!qdrantClientLoadPromise) {
    qdrantClientLoadPromise = (async () => {
      const moduleUrl = (typeof chrome !== 'undefined' && chrome?.runtime?.getURL)
        ? chrome.runtime.getURL('scripts/third/qdrant-js.min.js')
        : './scripts/third/qdrant-js.min.js';

      const module = await import(moduleUrl);
      const QdrantClient = module?.QdrantClient;

      if (!QdrantClient) {
        throw new Error('QdrantClient export not found in qdrant-js.min.js');
      }

      window.QdrantClient = QdrantClient;
      return QdrantClient;
    })().catch((error) => {
      // 允许后续重试（例如首次加载失败后用户修复了文件路径）
      qdrantClientLoadPromise = null;
      throw error;
    });
  }

  const timeoutMs = 15000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`QdrantClient load timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  return await Promise.race([qdrantClientLoadPromise, timeoutPromise]);
}

/**
 * Qdrant 知识库管理类
 */
class QdrantKnowledgeBase {
  constructor() {
    this.client = null;
    this.config = null;
  }

  /**
   * 初始化Qdrant客户端
   * @returns {Promise<QdrantKnowledgeBase>} 返回自身实例
   * @throws {Error} 如果配置未启用或连接失败
   */
  async initialize() {
    this.config = await getValueFromChromeStorage('qdrant');

    if (!this.config || !this.config.enabled) {
      throw new Error('Qdrant is not enabled. Please configure it in Settings → Knowledge Base.');
    }

    if (!this.config.serverUrl) {
      throw new Error('Qdrant server URL is not configured.');
    }

    try {
      // 等待 QdrantClient 加载
      const QdrantClient = await waitForQdrantClient();

      // 使用 Qdrant JS SDK 创建客户端
      this.client = new QdrantClient({
        url: this.config.serverUrl,
        apiKey: this.config.apiKey || undefined,
        timeout: 30000  // 30秒超时
      });

      // 测试连接
      await this.client.api().root({});

      return this;
    } catch (error) {
      throw new Error(`Failed to connect to Qdrant server: ${error.message}`);
    }
  }

  /**
   * 测试Qdrant服务器连接
   * @returns {Promise<{success: boolean, message: string, version?: string}>}
   */
  async testConnection() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const versionInfo = await this.client.api().root({});
      return {
        success: true,
        message: 'Connection successful',
        version: versionInfo.data?.version || 'Unknown'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 检查集合是否存在
   * @param {string} collectionName - 集合名称
   * @returns {Promise<boolean>}
   */
  async collectionExists(collectionName) {
    try {
      if (!this.client) {
        await this.initialize();
      }
      return await this.client.collectionExists(collectionName);
    } catch (error) {
      console.error('Error checking collection:', error);
      return false;
    }
  }

  /**
   * 创建Qdrant集合
   * @param {string} collectionName - 集合名称
   * @param {number} vectorSize - 向量维度
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async createCollection(collectionName, vectorSize = 1024) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      // 直接尝试创建，若已存在则视为成功
      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine'  // 余弦相似度
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      });

      return { success: true, message: 'Collection created successfully' };
    } catch (error) {
      // 如果提示已存在，视为成功
      const alreadyExists =
        error?.status === 409 ||
        /already exists/i.test(error?.message || '');
      if (alreadyExists) {
        return { success: true, message: 'Collection already exists' };
      }

      return { success: false, message: error.message };
    }
  }

  /**
   * 删除集合
   * @param {string} collectionName - 集合名称
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteCollection(collectionName) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      await this.client.deleteCollection(collectionName, { timeout: 30000 });
      return { success: true, message: 'Collection deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 保存内容到知识库
   * @param {Object} params
   * @param {string} params.content - 总结内容
   * @param {string} params.url - 页面URL
   * @param {string} params.title - 页面标题
   * @param {string} params.model - 使用的LLM模型
   * @param {string} params.contentType - 内容类型 (summary/paper/learning)
   * @param {number[]} params.embedding - 嵌入向量
   * @param {string} [params.collectionName] - 可选集合名（不传则使用配置）
   * @returns {Promise<{success: boolean, pointId?: number, message?: string}>}
   */
  async saveToKnowledgeBase({ content, url, title, model, contentType, embedding, collectionName }) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const targetCollection = collectionName || this.config.collectionName || 'orangesidebar-knowledge';

      // 1. 确保集合存在
      const exists = await this.collectionExists(targetCollection);
      if (!exists) {
        const createResult = await this.createCollection(targetCollection, embedding.length);
        if (!createResult.success) {
          throw new Error(`Failed to create collection: ${createResult.message}`);
        }
      }

      // 2. 生成唯一ID（时间戳 + 随机数）
      const pointId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      // 3. 准备 payload（元数据）
      const payload = {
        content: content,
        url: url,
        title: title,
        model: model,
        contentType: contentType,
        timestamp: new Date().toISOString(),
        contentLength: content.length,
        // 存储内容摘要（前500字符）用于预览
        preview: content.slice(0, 500)
      };

      // 4. 插入向量点
      await this.client.upsert(targetCollection, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: payload
          }
        ]
      });

      return { success: true, pointId };
    } catch (error) {
      // 如果集合缺失（404），尝试自动创建并重试一次
      const isMissingCollection = error?.status === 404 || /not found/i.test(error?.message || '');
      if (isMissingCollection) {
        try {
          await this.createCollection(targetCollection, embedding.length);
          await this.client.upsert(targetCollection, {
            wait: true,
            points: [
              {
                id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
                vector: embedding,
                payload: {
                  content,
                  url,
                  title,
                  model,
                  contentType,
                  timestamp: new Date().toISOString(),
                  contentLength: content.length,
                  preview: content.slice(0, 500)
                }
              }
            ]
          });
          return { success: true };
        } catch (retryError) {
          console.error('Retry after creating collection failed:', retryError);
          return { success: false, message: retryError.message };
        }
      }

      console.error('Error saving to knowledge base:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 批量保存内容到知识库（用于长文本分块）
   * @param {Object} params
   * @param {string} params.content - 原始完整内容
   * @param {string} params.url - 页面URL
   * @param {string} params.title - 页面标题
   * @param {string} params.model - 使用的LLM模型
   * @param {string} params.contentType - 内容类型
   * @param {string[]} params.chunks - 文本块数组
   * @param {number[][]} params.embeddings - 对应的嵌入向量数组
   * @returns {Promise<{success: boolean, pointIds?: number[], message?: string}>}
   */
  async saveBatchToKnowledgeBase({ content, url, title, model, contentType, chunks, embeddings, collectionName }) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      if (chunks.length !== embeddings.length) {
        throw new Error('Chunks and embeddings length mismatch');
      }

      const targetCollection = collectionName || this.config.collectionName || 'orangesidebar-knowledge';

      // 确保集合存在
      const exists = await this.collectionExists(targetCollection);
      if (!exists) {
        const createResult = await this.createCollection(targetCollection, embeddings[0].length);
        if (!createResult.success) {
          throw new Error(`Failed to create collection: ${createResult.message}`);
        }
      }

      const baseTimestamp = Date.now();
      const pointIds = [];
      const points = [];

      // 准备批量插入的点
      for (let i = 0; i < chunks.length; i++) {
        const pointId = baseTimestamp * 1000 + i;
        pointIds.push(pointId);

        points.push({
          id: pointId,
          vector: embeddings[i],
          payload: {
            content: chunks[i],
            url: url,
            title: title,
            model: model,
            contentType: contentType,
            timestamp: new Date().toISOString(),
            contentLength: chunks[i].length,
            preview: chunks[i].slice(0, 500),
            chunkIndex: i,
            totalChunks: chunks.length,
            isChunked: true  // 标记为分块内容
          }
        });
      }

      // 批量插入
      await this.client.upsert(targetCollection, {
        wait: true,
        points: points
      });

      return { success: true, pointIds };
    } catch (error) {
      const isMissingCollection = error?.status === 404 || /not found/i.test(error?.message || '');
      if (isMissingCollection && embeddings?.[0]) {
        try {
          await this.createCollection(targetCollection, embeddings[0].length);

          // 重试一次
          const baseTimestamp = Date.now();
          const retryPoints = [];
          for (let i = 0; i < chunks.length; i++) {
            retryPoints.push({
              id: baseTimestamp * 1000 + i,
              vector: embeddings[i],
              payload: {
                content: chunks[i],
                url,
                title,
                model,
                contentType,
                timestamp: new Date().toISOString(),
                contentLength: chunks[i].length,
                preview: chunks[i].slice(0, 500),
                chunkIndex: i,
                totalChunks: chunks.length,
                isChunked: true
              }
            });
          }

          await this.client.upsert(targetCollection, {
            wait: true,
            points: retryPoints
          });

          return { success: true };
        } catch (retryError) {
          console.error('Retry batch save after creating collection failed:', retryError);
          return { success: false, message: retryError.message };
        }
      }

      console.error('Error batch saving to knowledge base:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 搜索相似内容
   * @param {number[]} queryEmbedding - 查询向量
   * @param {number} topK - 返回前K个结果（默认5）
   * @param {Object|null} filter - 可选过滤条件
   * @param {string|null} collectionOverride - 指定集合（可选）
   * @param {{scoreThreshold?: number}} options - 额外参数
   * @returns {Promise<Array<{score: number, content: string, url: string, title: string, timestamp: string, contentType: string}>>}
   */
  async searchSimilar(queryEmbedding, topK = 5, filter = null, collectionOverride = null, options = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const collectionName = collectionOverride || this.config.collectionName || 'orangesidebar-knowledge';
      const scoreThreshold = typeof options.scoreThreshold === 'number' ? options.scoreThreshold : 0.5;

      // 检查集合是否存在
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        return [];
      }

      const searchParams = {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
        with_vector: false,  // 不返回向量节省带宽
        score_threshold: scoreThreshold  // 相似度阈值
      };

      if (filter) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(collectionName, searchParams);

      return results.map(result => ({
        score: result.score,
        content: result.payload.content,
        url: result.payload.url,
        title: result.payload.title,
        timestamp: result.payload.timestamp,
        contentType: result.payload.contentType,
        model: result.payload.model,
        isChunked: result.payload.isChunked || false,
        chunkIndex: result.payload.chunkIndex
      }));
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  /**
   * 获取所有集合名称列表
   * @returns {Promise<string[]>}
   */
  async listCollections() {
    try {
      if (!this.client) {
        await this.initialize();
      }
      const result = await this.client.getCollections();
      if (!result || !Array.isArray(result.collections)) {
        return [];
      }
      return result.collections.map(c => c.name).filter(Boolean);
    } catch (error) {
      console.error('Error listing collections:', error);
      return [];
    }
  }

  /**
   * 获取知识库统计信息
   * @returns {Promise<{count: number, vectorSize?: number, exists: boolean, error?: string}>}
   */
  async getStatistics() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const collectionName = this.config.collectionName || 'orangesidebar-knowledge';

      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        return { count: 0, exists: false };
      }

      const collectionInfo = await this.client.getCollection(collectionName);

      return {
        count: collectionInfo.points_count || 0,
        vectorSize: collectionInfo.config?.params?.vectors?.size,
        exists: true
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return { count: 0, exists: false, error: error.message };
    }
  }

  /**
   * 删除指定点
   * @param {number|number[]} pointIds - 点ID或ID数组
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async deletePoints(pointIds) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const collectionName = this.config.collectionName || 'orangesidebar-knowledge';
      const ids = Array.isArray(pointIds) ? pointIds : [pointIds];

      await this.client.delete(collectionName, {
        wait: true,
        points: ids
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting points:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 按条件删除点
   * @param {Object} filter - 过滤条件
   * @returns {Promise<{success: boolean, message?: string}>}
   *
   * @example
   * // 删除特定URL的所有内容
   * await kb.deleteByFilter({
   *   must: [{ key: 'url', match: { value: 'https://example.com' } }]
   * });
   */
  async deleteByFilter(filter) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const collectionName = this.config.collectionName || 'orangesidebar-knowledge';

      await this.client.delete(collectionName, {
        wait: true,
        filter: filter
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting by filter:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 滚动浏览集合中的所有点（用于导出或浏览）
   * @param {number} limit - 每次获取的点数量
   * @param {string|null} offset - 偏移量（用于分页）
   * @returns {Promise<{points: Array, nextOffset: string|null}>}
   */
  async scrollPoints(limit = 100, offset = null) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const collectionName = this.config.collectionName || 'orangesidebar-knowledge';

      const result = await this.client.scroll(collectionName, {
        limit: limit,
        offset: offset,
        with_payload: true,
        with_vector: false
      });

      return {
        points: result.points || [],
        nextOffset: result.next_page_offset || null
      };
    } catch (error) {
      console.error('Error scrolling points:', error);
      throw error;
    }
  }
}

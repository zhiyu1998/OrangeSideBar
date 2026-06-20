/**
 * OpenAI Provider Implementation
 * Supports OpenAI API and compatible endpoints (DeepSeek, Moonshot, etc.)
 */

import OpenAI from 'openai'
import { BaseLLMProvider } from './base'
import type {
  ChatParams,
  StreamChunk,
  ModelInfo,
  ChatCompletionResult,
  ChatMessage,
  ContentPart,
} from './types'
import type { ProviderId } from '@/types/provider'
import type { ReasoningEffort } from '@/types/provider'

// Models that support vision
const VISION_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4-vision-preview',
  'o1',
  'o1-mini',
  'o3-mini',
]

export class OpenAIProvider extends BaseLLMProvider {
  readonly providerId: ProviderId = 'openai'
  readonly providerName = 'OpenAI'

  private client: OpenAI | null = null

  /**
   * Get or create OpenAI client
   */
  private getClient(): OpenAI {
    this.ensureConfigured()

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config!.apiKey,
        baseURL: this.config!.baseUrl,
        dangerouslyAllowBrowser: true, // Required for browser extension
      })
    }

    return this.client
  }

  /**
   * Reset client when configuration changes
   */
  configure(config: { apiKey: string; baseUrl: string }): void {
    super.configure(config)
    this.client = null
  }

  /**
   * Convert our message format to OpenAI format
   */
  private convertMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = []

    // Add system prompt if provided
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })
      } else {
        // Multimodal content - only user messages can have image content
        const parts: OpenAI.ChatCompletionContentPart[] = msg.content.map((part: ContentPart) => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text }
          } else {
            return {
              type: 'image_url' as const,
              image_url: {
                url: `data:${part.source.media_type};base64,${part.source.data}`,
              },
            }
          }
        })
        // Cast to user message since only user can have multimodal content
        result.push({
          role: 'user' as const,
          content: parts,
        })
      }
    }

    return result
  }

  private shouldSendReasoningEffort(effort?: ReasoningEffort): effort is Exclude<ReasoningEffort, 'auto'> {
    return effort !== undefined && effort !== 'auto'
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getClient()
    const messages = this.convertMessages(params.messages, params.systemPrompt)

    try {
      const stream = await client.chat.completions.create({
        model: params.model,
        messages,
        temperature: params.temperature,
        top_p: params.topP,
        max_tokens: params.maxTokens,
        frequency_penalty: params.frequencyPenalty,
        presence_penalty: params.presencePenalty,
        ...(this.shouldSendReasoningEffort(params.reasoningEffort)
          ? { reasoning_effort: params.reasoningEffort }
          : {}),
        stream: true,
      }, {
        signal: params.signal,
      })

      let isThinking = false

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        if (!delta) continue

        // Check for reasoning/thinking content (for o1/o3 models)
        // OpenAI uses a different field for reasoning tokens
        const content = delta.content || ''

        if (content) {
          // Detect thinking blocks (DeepSeek style)
          if (content.includes('<think>')) {
            isThinking = true
            yield { type: 'thinking', content: content.replace('<think>', '') }
          } else if (content.includes('</think>')) {
            isThinking = false
            yield { type: 'thinking', content: content.replace('</think>', '') }
          } else if (isThinking) {
            yield { type: 'thinking', content }
          } else {
            yield { type: 'text', content }
          }
        }

        // Check for finish reason
        if (chunk.choices[0]?.finish_reason) {
          yield { type: 'done', content: '' }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          yield { type: 'done', content: '' }
          return
        }
        yield { type: 'error', content: error.message }
      } else {
        yield { type: 'error', content: 'Unknown error occurred' }
      }
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chat(params: ChatParams): Promise<ChatCompletionResult> {
    const client = this.getClient()
    const messages = this.convertMessages(params.messages, params.systemPrompt)

    const response = await client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      frequency_penalty: params.frequencyPenalty,
      presence_penalty: params.presencePenalty,
      ...(this.shouldSendReasoningEffort(params.reasoningEffort)
        ? { reasoning_effort: params.reasoningEffort }
        : {}),
      stream: false,
    }, {
      signal: params.signal,
    })

    const choice = response.choices[0]

    return {
      content: choice?.message?.content || '',
      finishReason: (choice?.finish_reason as 'stop' | 'length' | 'content_filter' | 'tool_calls') || null,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    }
  }

  /**
   * Fetch available models
   * Note: No filtering applied - returns all chat-capable models from the API
   * This allows third-party OpenAI-compatible providers to return their full model list
   */
  async getModels(): Promise<ModelInfo[]> {
    const client = this.getClient()

    try {
      const response = await client.models.list()

      const apiModels: ModelInfo[] = response.data.map((model) => ({
        id: model.id,
        name: model.id,
        providerId: this.providerId,
        supportsVision: this.supportsVision(model.id),
        isThinkingModel: this.supportsThinking(model.id),
      }))

      // Zhipu's /models can return a limited subset depending on account/availability.
      // Merge the known official list so users can still select other supported models.
      if (this.providerId === 'zhipu') {
        const defaults = this.getDefaultModels().map((m) => ({
          ...m,
          providerId: this.providerId,
        }))

        const byId = new Map<string, ModelInfo>()

        for (const model of defaults) {
          byId.set(model.id.toLowerCase(), model)
        }

        for (const model of apiModels) {
          const key = model.id.toLowerCase()
          const existing = byId.get(key)
          byId.set(key, existing ? { ...model, ...existing, id: model.id } : model)
        }

        return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
      }

      return apiModels.sort((a, b) => a.id.localeCompare(b.id))
    } catch (error) {
      console.error('Failed to fetch models:', error)
      // Return default models if API call fails
      return this.getDefaultModels()
    }
  }

  /**
   * Get default models list
   */
  private getDefaultModels(): ModelInfo[] {
    if (this.providerId === 'zhipu') {
      return [
        // Official model list (may evolve; API /models is source of truth)
        { id: 'glm-4.7', name: 'GLM-4.7', providerId: this.providerId },
        { id: 'glm-4.7-flashx', name: 'GLM-4.7-FlashX', providerId: this.providerId },
        { id: 'glm-4.6', name: 'GLM-4.6', providerId: this.providerId },
        { id: 'glm-4.5-air', name: 'GLM-4.5-Air', providerId: this.providerId },
        { id: 'glm-4.5-airx', name: 'GLM-4.5-AirX', providerId: this.providerId },
        { id: 'glm-4-long', name: 'GLM-4-Long', providerId: this.providerId },
        { id: 'glm-4-flashx-250414', name: 'GLM-4-FlashX-250414', providerId: this.providerId },
        { id: 'glm-4.7-flash', name: 'GLM-4.7-Flash (Free)', providerId: this.providerId },
        { id: 'glm-4.5-flash', name: 'GLM-4.5-Flash (Free)', providerId: this.providerId },
        { id: 'glm-4-flash-250414', name: 'GLM-4-Flash-250414 (Free)', providerId: this.providerId },

        // Backward compatible / commonly seen IDs
        { id: 'glm-4-air-250414', name: 'GLM-4-Air-250414', providerId: this.providerId },
      ]
    }

    return [
      { id: 'gpt-4o', name: 'GPT-4o', providerId: this.providerId, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: this.providerId, supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', providerId: this.providerId, supportsVision: true },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', providerId: this.providerId },
      { id: 'o1', name: 'O1', providerId: this.providerId, isThinkingModel: true, supportsVision: true },
      { id: 'o1-mini', name: 'O1 Mini', providerId: this.providerId, isThinkingModel: true },
      { id: 'o3-mini', name: 'O3 Mini', providerId: this.providerId, isThinkingModel: true },
    ]
  }

  /**
   * Check if model is supported
   */
  supportsModel(modelId: string): boolean {
    const lowerModelId = modelId.toLowerCase()
    if (this.providerId === 'zhipu') {
      return lowerModelId.startsWith('glm')
    }
    return (
      lowerModelId.startsWith('gpt-') ||
      lowerModelId.startsWith('gpt5') ||
      lowerModelId.startsWith('o1') ||
      lowerModelId.startsWith('o3') ||
      lowerModelId.startsWith('o4') ||
      lowerModelId.startsWith('chatgpt')
    )
  }

  /**
   * Check vision support
   */
  supportsVision(modelId: string): boolean {
    return VISION_MODELS.some((m) => modelId.includes(m))
  }

  /**
   * Check thinking/reasoning support
   */
  supportsThinking(_modelId: string): boolean {
    return true
  }
}

/**
 * Singleton instance
 */
export const openaiProvider = new OpenAIProvider()

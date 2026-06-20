/**
 * OpenAI Provider Implementation
 * Supports OpenAI API and compatible endpoints (DeepSeek, Moonshot, etc.)
 */

import OpenAI from 'openai'
import type {
  Response,
  ResponseCreateParamsBase,
  ResponseInput,
  ResponseInputMessageContentList,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses'
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
import type { OpenAIRequestMode } from '@/types/provider'

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

  private getRequestMode(mode?: OpenAIRequestMode): OpenAIRequestMode {
    return mode || 'chat_completions'
  }

  private getResponsesReasoning(effort?: ReasoningEffort): ResponseCreateParamsBase['reasoning'] | undefined {
    if (!this.shouldSendReasoningEffort(effort)) return undefined
    return { effort }
  }

  private getResponsesInclude(effort?: ReasoningEffort): ResponseCreateParamsBase['include'] | undefined {
    if (!this.shouldSendReasoningEffort(effort) || effort === 'none') return undefined
    return ['reasoning.encrypted_content']
  }

  private convertMessagesToResponseInput(messages: ChatMessage[]): ResponseInput {
    const input: ResponseInput = []

    for (const msg of messages) {
      if (msg.role === 'system') continue

      if (msg.role === 'assistant') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((part) => part.type === 'text')
              .map((part) => part.text)
              .join('\n')

        if (!text) continue

        input.push({
          id: `msg_${input.length}`,
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text,
              annotations: [],
            },
          ],
        })
        continue
      }

      const content: ResponseInputMessageContentList = []

      if (typeof msg.content === 'string') {
        if (msg.content) {
          content.push({ type: 'input_text', text: msg.content })
        }
      } else {
        for (const part of msg.content) {
          if (part.type === 'text') {
            content.push({ type: 'input_text', text: part.text })
          } else {
            content.push({
              type: 'input_image',
              detail: 'auto',
              image_url: `data:${part.source.media_type};base64,${part.source.data}`,
            })
          }
        }
      }

      if (content.length > 0) {
        input.push({
          type: 'message',
          role: 'user',
          content,
        })
      }
    }

    return input
  }

  private extractResponseOutputText(response: Response): string {
    if (response.output_text) return response.output_text

    const parts: string[] = []
    for (const item of response.output || []) {
      if (item.type !== 'message') continue
      for (const content of item.content || []) {
        if (content.type === 'output_text') {
          parts.push(content.text)
        }
      }
    }

    return parts.join('')
  }

  private extractResponseReasoningText(response: Response): string {
    const parts: string[] = []

    for (const item of response.output || []) {
      if (item.type !== 'reasoning') continue

      for (const summary of item.summary || []) {
        if (summary.type === 'summary_text' && summary.text) {
          parts.push(summary.text)
        }
      }

      for (const content of item.content || []) {
        if (content.type === 'reasoning_text' && content.text) {
          parts.push(content.text)
        }
      }
    }

    return parts.join('\n\n')
  }

  private getResponseErrorMessage(event: ResponseStreamEvent): string | null {
    if (event.type === 'response.failed') {
      return event.response.error?.message || 'Responses API request failed'
    }

    if (event.type === 'response.incomplete') {
      return event.response.incomplete_details?.reason || 'Responses API response was incomplete'
    }

    if (event.type === 'error') {
      return event.message || 'Responses API stream error'
    }

    return null
  }

  private extractReasoningText(delta: unknown): string {
    if (!delta || typeof delta !== 'object') return ''

    const candidate = delta as Record<string, unknown>
    const parts: string[] = []

    const directKeys = [
      'reasoning',
      'reasoning_content',
      'reasoning_text',
      'thinking',
    ]

    for (const key of directKeys) {
      const value = candidate[key]
      if (typeof value === 'string' && value) {
        parts.push(value)
      }
    }

    const arrayKeys = [
      'content',
      'reasoning_details',
      'reasoning_content',
      'output',
    ]

    for (const key of arrayKeys) {
      const value = candidate[key]
      if (!Array.isArray(value)) continue

      for (const item of value) {
        if (!item || typeof item !== 'object') continue

        const record = item as Record<string, unknown>
        const type = typeof record.type === 'string' ? record.type : ''

        if (
          type.includes('reasoning') ||
          type.includes('thinking') ||
          type === 'summary_text'
        ) {
          const textCandidates = [
            record.text,
            record.reasoning,
            record.thinking,
            record.delta,
            record.content,
          ]

          for (const textValue of textCandidates) {
            if (typeof textValue === 'string' && textValue) {
              parts.push(textValue)
            }
          }
        }
      }
    }

    return parts.join('')
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    if (this.getRequestMode(params.openAIRequestMode) === 'responses') {
      yield* this.responseStream(params)
      return
    }

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

        const reasoningText = this.extractReasoningText(delta)
        if (reasoningText) {
          yield { type: 'thinking', content: reasoningText }
        }

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

  private async *responseStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getClient()
    const input = this.convertMessagesToResponseInput(params.messages)

    try {
      const stream = await client.responses.create({
        model: params.model,
        input,
        instructions: params.systemPrompt || undefined,
        temperature: params.temperature,
        top_p: params.topP,
        max_output_tokens: params.maxTokens,
        reasoning: this.getResponsesReasoning(params.reasoningEffort),
        include: this.getResponsesInclude(params.reasoningEffort),
        store: false,
        stream: true,
      }, {
        signal: params.signal,
      })

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          yield { type: 'text', content: event.delta }
          continue
        }

        if (
          event.type === 'response.reasoning_text.delta' ||
          event.type === 'response.reasoning_summary_text.delta'
        ) {
          yield { type: 'thinking', content: event.delta }
          continue
        }

        const errorMessage = this.getResponseErrorMessage(event)
        if (errorMessage) {
          yield { type: 'error', content: errorMessage }
          continue
        }

        if (event.type === 'response.completed') {
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
    if (this.getRequestMode(params.openAIRequestMode) === 'responses') {
      return this.response(params)
    }

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

  private async response(params: ChatParams): Promise<ChatCompletionResult> {
    const client = this.getClient()
    const input = this.convertMessagesToResponseInput(params.messages)

    const response = await client.responses.create({
      model: params.model,
      input,
      instructions: params.systemPrompt || undefined,
      temperature: params.temperature,
      top_p: params.topP,
      max_output_tokens: params.maxTokens,
      reasoning: this.getResponsesReasoning(params.reasoningEffort),
      include: this.getResponsesInclude(params.reasoningEffort),
      store: false,
      stream: false,
    }, {
      signal: params.signal,
    })

    return {
      content: this.extractResponseOutputText(response),
      thinking: this.extractResponseReasoningText(response) || undefined,
      finishReason: response.status === 'completed' ? 'stop' : null,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
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

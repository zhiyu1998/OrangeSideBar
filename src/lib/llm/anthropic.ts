/**
 * Anthropic Provider Implementation
 * Supports Claude models via Anthropic API
 */

import Anthropic from '@anthropic-ai/sdk'
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
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-sonnet-4',
  'claude-opus-4',
]

const ANTHROPIC_REASONING_BUDGETS: Record<Exclude<ReasoningEffort, 'auto' | 'none'>, number> = {
  minimal: 1024,
  low: 2048,
  medium: 4096,
  high: 8192,
  xhigh: 16384,
}

export class AnthropicProvider extends BaseLLMProvider {
  readonly providerId: ProviderId = 'anthropic'
  readonly providerName = 'Anthropic'

  private client: Anthropic | null = null

  /**
   * Get or create Anthropic client
   */
  private getClient(): Anthropic {
    this.ensureConfigured()

    if (!this.client) {
      const apiKey = this.config!.apiKey.trim()

      this.client = new Anthropic({
        apiKey,
        baseURL: this.config!.baseUrl,
        dangerouslyAllowBrowser: true,
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

  private toModelInfo(model: {
    id: string
    display_name?: string
  }): ModelInfo {
    return {
      id: model.id,
      name: model.display_name || model.id,
      providerId: this.providerId,
      supportsVision: this.supportsVision(model.id),
      isThinkingModel: this.supportsThinking(model.id),
    }
  }

  /**
   * Convert our message format to Anthropic format
   */
  private convertMessages(
    messages: ChatMessage[]
  ): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = []

    for (const msg of messages) {
      // Skip system messages - they're handled separately in Anthropic API
      if (msg.role === 'system') continue

      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      } else {
        // Multimodal content
        const parts: Anthropic.ContentBlockParam[] = msg.content.map((part: ContentPart) => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text }
          } else {
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: part.source.media_type,
                data: part.source.data,
              },
            }
          }
        })
        result.push({
          role: msg.role as 'user' | 'assistant',
          content: parts,
        })
      }
    }

    return result
  }

  /**
   * Extract system prompt from messages
   */
  private extractSystemPrompt(messages: ChatMessage[], systemPrompt?: string): string | undefined {
    if (systemPrompt) return systemPrompt

    const systemMsg = messages.find((m) => m.role === 'system')
    if (systemMsg && typeof systemMsg.content === 'string') {
      return systemMsg.content
    }

    return undefined
  }

  private getThinkingConfig(
    _modelId: string,
    effort: ReasoningEffort | undefined,
    maxTokens: number | undefined
  ): Anthropic.ThinkingConfigParam | undefined {
    if (!effort || effort === 'auto' || effort === 'none') {
      return undefined
    }

    const requestedBudget = ANTHROPIC_REASONING_BUDGETS[effort]
    const maxBudget = Math.max(1024, (maxTokens || 4096) - 1)
    const budgetTokens = Math.min(requestedBudget, maxBudget)

    if (budgetTokens < 1024) {
      return undefined
    }

    return {
      type: 'enabled',
      budget_tokens: budgetTokens,
    }
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getClient()
    const messages = this.convertMessages(params.messages)
    const systemPrompt = this.extractSystemPrompt(params.messages, params.systemPrompt)

    try {
      const stream = client.messages.stream({
        model: params.model,
        messages,
        system: systemPrompt,
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature,
        top_p: params.topP,
        thinking: this.getThinkingConfig(params.model, params.reasoningEffort, params.maxTokens),
      }, {
        signal: params.signal,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block

          if (block.type === 'thinking' && block.thinking) {
            yield { type: 'thinking', content: block.thinking }
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta

          if (delta.type === 'text_delta' && delta.text) {
            yield { type: 'text', content: delta.text }
          } else if (delta.type === 'thinking_delta' && delta.thinking) {
            yield { type: 'thinking', content: delta.thinking }
          }
        } else if (event.type === 'message_stop') {
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
    const messages = this.convertMessages(params.messages)
    const systemPrompt = this.extractSystemPrompt(params.messages, params.systemPrompt)

    const response = await client.messages.create({
      model: params.model,
      messages,
      system: systemPrompt,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature,
      top_p: params.topP,
      thinking: this.getThinkingConfig(params.model, params.reasoningEffort, params.maxTokens),
    }, {
      signal: params.signal,
    })

    // Extract text content
    let content = ''
    let thinking = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      }
      // Handle thinking blocks
      if (block.type === 'thinking' && 'thinking' in block) {
        thinking += (block as { type: 'thinking'; thinking: string }).thinking
      }
    }

    return {
      content,
      thinking: thinking || undefined,
      finishReason: response.stop_reason as 'stop' | 'length' | null,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    }
  }

  /**
   * Fetch available models
   */
  async getModels(): Promise<ModelInfo[]> {
    const client = this.getClient()

    try {
      const page = await client.models.list()
      const models = page.data.map((model) => this.toModelInfo(model))

      if (models.length > 0) {
        return models
      }
    } catch (error) {
      console.warn('[AnthropicProvider] Failed to fetch models from /v1/models, falling back to built-in list:', error)
    }

    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        providerId: this.providerId,
        supportsVision: true,
        isThinkingModel: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        providerId: this.providerId,
        supportsVision: true,
        isThinkingModel: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        providerId: this.providerId,
        supportsVision: true,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        providerId: this.providerId,
        supportsVision: true,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        providerId: this.providerId,
        supportsVision: true,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        providerId: this.providerId,
        supportsVision: true,
      },
    ]
  }

  /**
   * Check if model is supported
   */
  supportsModel(modelId: string): boolean {
    return modelId.toLowerCase().startsWith('claude')
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
export const anthropicProvider = new AnthropicProvider()

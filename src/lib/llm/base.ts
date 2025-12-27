/**
 * Base LLM Provider Abstract Class
 */

import type { ProviderId } from '@/types/provider'
import type {
  ChatParams,
  StreamChunk,
  ModelInfo,
  LLMProviderConfig,
  ChatCompletionResult,
} from './types'

/**
 * Abstract base class for all LLM providers
 * Each provider (OpenAI, Anthropic, etc.) should extend this class
 */
export abstract class BaseLLMProvider {
  /**
   * Unique provider identifier
   */
  abstract readonly providerId: ProviderId

  /**
   * Human-readable provider name
   */
  abstract readonly providerName: string

  /**
   * Provider configuration
   */
  protected config: LLMProviderConfig | null = null

  /**
   * Configure the provider with API credentials
   */
  configure(config: LLMProviderConfig): void {
    this.config = config
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMProviderConfig | null {
    return this.config
  }

  /**
   * Send a chat completion request with streaming
   * Returns an async generator that yields chunks
   */
  abstract chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown>

  /**
   * Send a chat completion request without streaming
   * Returns the complete response
   */
  abstract chat(params: ChatParams): Promise<ChatCompletionResult>

  /**
   * Fetch available models from the provider
   */
  abstract getModels(): Promise<ModelInfo[]>

  /**
   * Validate if a model ID is supported by this provider
   */
  abstract supportsModel(modelId: string): boolean

  /**
   * Check if the provider supports vision/multimodal
   */
  abstract supportsVision(modelId: string): boolean

  /**
   * Check if the model supports thinking/reasoning display
   */
  abstract supportsThinking(modelId: string): boolean

  /**
   * Helper to ensure provider is configured before making requests
   */
  protected ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(`Provider "${this.providerName}" is not configured. Please set API key.`)
    }
  }
}

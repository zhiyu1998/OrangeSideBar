/**
 * LLM Provider Factory
 * Manages provider instances and routing based on model ID
 */

import type { ApiSpec, ProviderId } from '@/types/provider'
import type { BaseLLMProvider } from './base'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import type { LLMProviderConfig } from './types'

const OPENAI_COMPATIBLE_PROVIDERS: ProviderId[] = [
  'deepseek',
  'moonshot',
  'siliconflow',
  'openrouter',
  'groq',
  'grok',
  'mistral',
  'ollama',
  'zhipu',
]

/**
 * Model prefix to provider mapping
 */
const MODEL_PROVIDER_MAPPING: Array<{ prefix: string; providerId: ProviderId }> = [
  // OpenAI models
  { prefix: 'gpt-', providerId: 'openai' },
  { prefix: 'o1', providerId: 'openai' },
  { prefix: 'o3', providerId: 'openai' },
  { prefix: 'chatgpt-', providerId: 'openai' },

  // Anthropic models
  { prefix: 'claude-', providerId: 'anthropic' },

  // DeepSeek models (OpenAI compatible)
  { prefix: 'deepseek-', providerId: 'deepseek' },

  // Moonshot/Kimi models (OpenAI compatible)
  { prefix: 'moonshot-', providerId: 'moonshot' },
  { prefix: 'kimi-', providerId: 'moonshot' },

  // Zhipu GLM models (OpenAI compatible)
  { prefix: 'glm', providerId: 'zhipu' },

  // SiliconFlow models (OpenAI compatible)
  { prefix: 'Qwen', providerId: 'siliconflow' },
  { prefix: 'qwen', providerId: 'siliconflow' },

  // Groq models (OpenAI compatible)
  { prefix: 'llama-', providerId: 'groq' },
  { prefix: 'mixtral-', providerId: 'groq' },
  { prefix: 'gemma-', providerId: 'groq' },

  // Grok models (OpenAI compatible)
  { prefix: 'grok-', providerId: 'grok' },

  // Mistral models (OpenAI compatible)
  { prefix: 'mistral-', providerId: 'mistral' },
  { prefix: 'codestral-', providerId: 'mistral' },
]

/**
 * LLM Provider Factory
 * Singleton class that manages all provider instances
 */
class LLMProviderFactory {
  private providers: Map<ProviderId, BaseLLMProvider> = new Map()

  constructor() {
    // Register built-in providers
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new AnthropicProvider())
  }

  /**
   * Register a provider instance
   */
  registerProvider(provider: BaseLLMProvider): void {
    this.providers.set(provider.providerId, provider)
  }

  private applyProviderOverrides(provider: BaseLLMProvider, providerId: ProviderId): void {
    // ProviderId is used for routing and caching; override it for OpenAI-compatible clones.
    Object.defineProperty(provider, 'providerId', {
      value: providerId,
      writable: false,
    })

    // Improve UX for OpenAI-compatible providers by showing a meaningful name.
    if (providerId === 'zhipu') {
      Object.defineProperty(provider, 'providerName', {
        value: '智谱清言 (GLM)',
        writable: false,
      })
    }
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: ProviderId): BaseLLMProvider | undefined {
    return this.providers.get(providerId)
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): BaseLLMProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Detect provider from model ID
   */
  detectProviderFromModel(modelId: string): ProviderId | null {
    const lowerModelId = modelId.toLowerCase()

    for (const mapping of MODEL_PROVIDER_MAPPING) {
      if (lowerModelId.startsWith(mapping.prefix.toLowerCase())) {
        return mapping.providerId
      }
    }

    return null
  }

  /**
   * Get provider for a specific model
   */
  getProviderForModel(modelId: string): BaseLLMProvider | null {
    const providerId = this.detectProviderFromModel(modelId)

    if (!providerId) {
      console.warn(`No provider found for model: ${modelId}`)
      return null
    }

    const provider = this.getProvider(providerId)

    if (!provider) {
      // For OpenAI-compatible providers that aren't registered yet,
      // create an OpenAI provider instance
      if (OPENAI_COMPATIBLE_PROVIDERS.includes(providerId)) {
        const openaiProvider = new OpenAIProvider()
        this.applyProviderOverrides(openaiProvider, providerId)
        this.registerProvider(openaiProvider)
        return openaiProvider
      }

      console.warn(`Provider not registered: ${providerId}`)
      return null
    }

    return provider
  }

  /**
   * Configure a provider with API credentials
   */
  configureProvider(providerId: ProviderId, config: LLMProviderConfig, apiSpec?: ApiSpec): void {
    let provider = this.getProvider(providerId)

    if (!provider) {
      // Create OpenAI-compatible provider for unregistered or custom providers
      const isCustom = String(providerId).startsWith('custom_')
      if (OPENAI_COMPATIBLE_PROVIDERS.includes(providerId) || isCustom) {
        // Use Anthropic provider if specified, otherwise default to OpenAI
        if (apiSpec === 'anthropic') {
          provider = new AnthropicProvider()
        } else {
          provider = new OpenAIProvider()
        }
        this.applyProviderOverrides(provider, providerId)
        this.registerProvider(provider)
      } else {
        console.warn(`Cannot configure unregistered provider: ${providerId}`)
        return
      }
    }

    provider.configure(config)
  }

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(providerId: ProviderId): boolean {
    const provider = this.getProvider(providerId)
    return provider?.isConfigured() ?? false
  }
}

/**
 * Singleton factory instance
 */
export const llmFactory = new LLMProviderFactory()

/**
 * Export for convenience
 */
export { LLMProviderFactory }

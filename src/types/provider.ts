/**
 * Provider Configuration Types
 */

export type ApiSpec = 'openai' | 'anthropic' | 'google'

export type ProviderId = 'openai' | 'anthropic' | 'deepseek' | 'moonshot' | 'siliconflow' | 'openrouter' | 'groq' | 'grok' | 'mistral' | 'ollama' | (string & {})

export interface ProviderConfig {
  apiKey: string | string[]
  baseUrl: string
  enabled: boolean
}

export interface CustomProvider {
  id: string
  name: string
  iconSvg?: string
  apiSpec: ApiSpec
  baseUrl: string
  apiKey: string
  enabled: boolean
}

export interface ModelParameters {
  temperature: number
  topP: number
  maxTokens: number
  frequencyPenalty: number
  presencePenalty: number
}

export interface Model {
  id: string
  name: string
  providerId: ProviderId
  isThinkingModel?: boolean
  maxTokens?: number
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  icon: string
  defaultBaseUrl: string
  apiPath: string
  modelsEndpoint?: string
  supportedFeatures: {
    streaming: boolean
    vision: boolean
    thinking: boolean
  }
}

export const DEFAULT_MODEL_PARAMETERS: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

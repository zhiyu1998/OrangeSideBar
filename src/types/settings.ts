/**
 * Settings Types
 */

import type { LayoutMode } from './chat'
import type { ModelParameters, ProviderId, ProviderConfig, ReasoningEffort, OpenAIRequestMode } from './provider'

export type Theme = 'light' | 'dark' | 'system'

export type Language = 'auto' | 'en' | 'zh-CN'

/** Resolved locale code used by vue-i18n / Intl APIs. */
export type Locale = 'en' | 'zh-CN'

export type PromptMode = 'default' | 'paper' | 'learning'

export interface SystemPrompts {
  default: string
  paper: string
  learning: string
}

export interface UserSettings {
  theme: Theme
  language: Language
  layoutMode: LayoutMode
  defaultModel: string
  defaultModelProviderId?: ProviderId | null
  modelParameters: ModelParameters
  reasoningEffort: ReasoningEffort
  openAIRequestMode: OpenAIRequestMode
  systemPrompts: SystemPrompts
  enabledProviders: ProviderId[]
}

export interface ProviderSettings {
  providers: Record<ProviderId, ProviderConfig>
}

export interface AppSettings extends UserSettings, ProviderSettings {}

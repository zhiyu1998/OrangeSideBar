/**
 * Settings Types
 */

import type { LayoutMode } from './chat'
import type { ModelParameters, ProviderId, ProviderConfig, ReasoningEffort, OpenAIRequestMode } from './provider'

export type Theme = 'light' | 'dark' | 'system'

export type PromptMode = 'default' | 'paper' | 'learning'

export interface SystemPrompts {
  default: string
  paper: string
  learning: string
}

export interface UserSettings {
  theme: Theme
  layoutMode: LayoutMode
  defaultModel: string
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

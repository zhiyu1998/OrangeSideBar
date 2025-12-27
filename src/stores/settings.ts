import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Theme, PromptMode, SystemPrompts } from '@/types/settings'
import type { ProviderId, ProviderConfig, ModelParameters } from '@/types/provider'
import { DEFAULT_SYSTEM_PROMPT, PAPER_SYSTEM_PROMPT, LEARNING_MODE_PROMPT } from '@/constants/prompts'

// Default provider configurations
const DEFAULT_PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  },
  anthropic: {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    enabled: true,
  },
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    enabled: false,
  },
  moonshot: {
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    enabled: false,
  },
  siliconflow: {
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    enabled: false,
  },
  openrouter: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: false,
  },
  groq: {
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: false,
  },
  grok: {
    apiKey: '',
    baseUrl: 'https://api.x.ai/v1',
    enabled: false,
  },
  mistral: {
    apiKey: '',
    baseUrl: 'https://api.mistral.ai/v1',
    enabled: false,
  },
  ollama: {
    apiKey: '',
    baseUrl: 'http://127.0.0.1:11434/v1',
    enabled: false,
  },
}

const DEFAULT_MODEL_PARAMS: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<Theme>('system')
  const defaultModel = ref<string>('gpt-4o-mini')
  const currentPromptMode = ref<PromptMode>('default')
  const modelParameters = ref<ModelParameters>({ ...DEFAULT_MODEL_PARAMS })
  const providers = ref<Record<ProviderId, ProviderConfig>>(
    JSON.parse(JSON.stringify(DEFAULT_PROVIDERS))
  )
  const systemPrompts = ref<SystemPrompts>({
    default: DEFAULT_SYSTEM_PROMPT,
    paper: PAPER_SYSTEM_PROMPT,
    learning: LEARNING_MODE_PROMPT,
  })

  // Getters
  const enabledProviders = computed(() =>
    (Object.keys(providers.value) as ProviderId[]).filter(
      (id) => providers.value[id].enabled
    )
  )

  const currentSystemPrompt = computed(() => systemPrompts.value[currentPromptMode.value])

  const isDarkMode = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  // Actions
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    applyTheme()
  }

  function applyTheme() {
    const root = document.documentElement
    if (isDarkMode.value) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  function setDefaultModel(modelId: string) {
    defaultModel.value = modelId
  }

  function setPromptMode(mode: PromptMode) {
    currentPromptMode.value = mode
  }

  function updateModelParameters(params: Partial<ModelParameters>) {
    Object.assign(modelParameters.value, params)
  }

  function resetModelParameters() {
    modelParameters.value = { ...DEFAULT_MODEL_PARAMS }
  }

  function getProviderConfig(providerId: ProviderId): ProviderConfig {
    return providers.value[providerId]
  }

  function updateProviderConfig(providerId: ProviderId, config: Partial<ProviderConfig>) {
    providers.value[providerId] = {
      ...providers.value[providerId],
      ...config,
    }
  }

  function setProviderEnabled(providerId: ProviderId, enabled: boolean) {
    providers.value[providerId].enabled = enabled
  }

  function updateSystemPrompt(mode: PromptMode, prompt: string) {
    systemPrompts.value[mode] = prompt
  }

  function resetSystemPrompt(mode: PromptMode) {
    const defaults: SystemPrompts = {
      default: DEFAULT_SYSTEM_PROMPT,
      paper: PAPER_SYSTEM_PROMPT,
      learning: LEARNING_MODE_PROMPT,
    }
    systemPrompts.value[mode] = defaults[mode]
  }

  function getApiKey(providerId: ProviderId): string {
    const config = providers.value[providerId]
    if (Array.isArray(config.apiKey)) {
      // Random selection for multiple keys
      return config.apiKey[Math.floor(Math.random() * config.apiKey.length)]
    }
    return config.apiKey
  }

  return {
    // State
    theme,
    defaultModel,
    currentPromptMode,
    modelParameters,
    providers,
    systemPrompts,
    // Getters
    enabledProviders,
    currentSystemPrompt,
    isDarkMode,
    // Actions
    setTheme,
    applyTheme,
    setDefaultModel,
    setPromptMode,
    updateModelParameters,
    resetModelParameters,
    getProviderConfig,
    updateProviderConfig,
    setProviderEnabled,
    updateSystemPrompt,
    resetSystemPrompt,
    getApiKey,
  }
})

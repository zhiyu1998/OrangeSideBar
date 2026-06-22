import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme, PromptMode, SystemPrompts } from '@/types/settings'
import type { ApiSpec, ProviderId, ProviderConfig, ModelParameters, CustomProvider, ReasoningEffort, OpenAIRequestMode } from '@/types/provider'
import type { ModelInfo } from '@/lib/llm/types'
import { DEFAULT_SYSTEM_PROMPT, PAPER_SYSTEM_PROMPT, LEARNING_MODE_PROMPT } from '@/constants/prompts'

// Default provider configurations
const DEFAULT_PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  },
  zhipu: {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    enabled: false,
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

const BUILTIN_PROVIDER_NAMES: Record<ProviderId, string> = {
  openai: 'OpenAI',
  zhipu: '智谱清言',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  siliconflow: 'SiliconFlow',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  grok: 'Grok',
  mistral: 'Mistral',
  ollama: 'Ollama',
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<Theme>('system')
  const defaultModel = ref<string>('gpt-4o-mini')
  const defaultModelProviderId = ref<ProviderId | null>('openai')
  const currentPromptMode = ref<PromptMode>('default')
  const modelParameters = ref<ModelParameters>({ ...DEFAULT_MODEL_PARAMS })
  const reasoningEffort = ref<ReasoningEffort>('auto')
  const openAIRequestMode = ref<OpenAIRequestMode>('chat_completions')
  const providers = ref<Record<ProviderId, ProviderConfig>>(
    JSON.parse(JSON.stringify(DEFAULT_PROVIDERS))
  )
  const customProviders = ref<CustomProvider[]>([])
  const systemPrompts = ref<SystemPrompts>({
    default: DEFAULT_SYSTEM_PROMPT,
    paper: PAPER_SYSTEM_PROMPT,
    learning: LEARNING_MODE_PROMPT,
  })

  // Cached models per provider
  const cachedModels = ref<Record<ProviderId, ModelInfo[]>>({} as Record<ProviderId, ModelInfo[]>)
  const manualModels = ref<Record<ProviderId, ModelInfo[]>>({} as Record<ProviderId, ModelInfo[]>)
  const isLoadingModels = ref<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>)

  // Getters
  const enabledProviders = computed(() => {
    const builtIn = (Object.keys(providers.value) as ProviderId[]).filter(
      (id) => providers.value[id].enabled
    )
    const custom = customProviders.value
      .filter(p => p.enabled)
      .map(p => p.id)
    return [...builtIn, ...custom]
  })

  const currentSystemPrompt = computed(() => systemPrompts.value[currentPromptMode.value])

  const isDarkMode = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  // Get all cached models across all providers
  const allCachedModels = computed(() => {
    const all: ModelInfo[] = []

    const providerIds = new Set<ProviderId>([
      ...(Object.keys(cachedModels.value) as ProviderId[]),
      ...(Object.keys(manualModels.value) as ProviderId[]),
    ])

    for (const providerId of providerIds) {
      all.push(...mergeProviderModels(providerId))
    }
    return all
  })

  const hasSelectedDefaultModel = computed(() => {
    if (!defaultModel.value) return false
    if (!defaultModelProviderId.value) return false

    return !!allCachedModels.value.find(
      (model) => model.id === defaultModel.value && model.providerId === defaultModelProviderId.value
    )
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

  function setDefaultModel(modelId: string, providerId?: ProviderId | null) {
    defaultModel.value = modelId
    if (providerId !== undefined) {
      defaultModelProviderId.value = providerId
    }
  }

  function setPromptMode(mode: PromptMode) {
    currentPromptMode.value = mode
  }

  function updateModelParameters(params: Partial<ModelParameters>) {
    Object.assign(modelParameters.value, params)
  }

  function setReasoningEffort(value: ReasoningEffort) {
    reasoningEffort.value = value
  }

  function setOpenAIRequestMode(value: OpenAIRequestMode) {
    openAIRequestMode.value = value
  }

  function resetModelParameters() {
    modelParameters.value = { ...DEFAULT_MODEL_PARAMS }
  }

  function getProviderConfig(providerId: ProviderId): ProviderConfig {
    if (String(providerId).startsWith('custom_')) {
      const custom = customProviders.value.find(p => p.id === providerId)
      return {
        apiKey: custom?.apiKey || '',
        baseUrl: custom?.baseUrl || '',
        enabled: custom?.enabled ?? false
      }
    }

    const current = providers.value[providerId]
    const defaults = DEFAULT_PROVIDERS[providerId]

    // Handle migrations: older persisted state may not contain newly added providers.
    if (!current) {
      return defaults ?? { apiKey: '', baseUrl: '', enabled: false }
    }

    // Ensure any new fields/defaults are present without overwriting user changes.
    return defaults ? { ...defaults, ...current } : current
  }

  function updateProviderConfig(providerId: ProviderId, config: Partial<ProviderConfig>) {
    if (String(providerId).startsWith('custom_')) {
      const index = customProviders.value.findIndex(p => p.id === providerId)
      if (index !== -1) {
        if (config.apiKey !== undefined) customProviders.value[index].apiKey = config.apiKey as string
        if (config.baseUrl !== undefined) customProviders.value[index].baseUrl = config.baseUrl
        if (config.enabled !== undefined) customProviders.value[index].enabled = config.enabled
      }
      return
    }

    if (!providers.value[providerId]) {
      // Initialize missing provider (migration / newly added built-in)
      providers.value[providerId] = DEFAULT_PROVIDERS[providerId] ?? { apiKey: '', baseUrl: '', enabled: false }
    }

    providers.value[providerId] = {
      ...providers.value[providerId],
      ...config,
    }
  }

  function setProviderEnabled(providerId: ProviderId, enabled: boolean) {
    if (String(providerId).startsWith('custom_')) {
      const index = customProviders.value.findIndex(p => p.id === providerId)
      if (index !== -1) customProviders.value[index].enabled = enabled
    } else {
      if (!providers.value[providerId]) {
        providers.value[providerId] = DEFAULT_PROVIDERS[providerId] ?? { apiKey: '', baseUrl: '', enabled: false }
      }
      providers.value[providerId].enabled = enabled
    }

    if (!enabled) {
      const disabledModelIds = new Set(
        (cachedModels.value[providerId] || []).map((m) => m.id)
      )

      // Remove cached models so they don't keep appearing in selectors
      clearProviderModels(providerId)

      // If current default model belongs to the disabled provider, switch to an enabled model if possible
      if (defaultModelProviderId.value === providerId || disabledModelIds.has(defaultModel.value)) {
        let nextModel: string | null = null
        let nextProviderId: ProviderId | null = null

        for (const [pid, models] of Object.entries(cachedModels.value) as Array<
          [ProviderId, ModelInfo[]]
        >) {
          if (!providers.value[pid]?.enabled) continue
          const first = models[0]?.id
          if (first) {
            nextModel = first
            nextProviderId = pid
            break
          }
        }

        if (!nextModel && providers.value.openai?.enabled) {
          nextModel = 'gpt-4o-mini'
          nextProviderId = 'openai'
        }

        if (nextModel) {
          defaultModel.value = nextModel
          defaultModelProviderId.value = nextProviderId
        }
      }
    }
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

  function addCustomProvider(provider: CustomProvider) {
    customProviders.value.push(provider)
  }

  function removeCustomProvider(id: string) {
    customProviders.value = customProviders.value.filter(p => p.id !== id)
    clearProviderModels(id)

    if (defaultModelProviderId.value === id) {
      let nextModel: string | null = null
      let nextProviderId: ProviderId | null = null

      for (const providerId of enabledProviders.value) {
        const models = cachedModels.value[providerId]
        const firstModel = models?.[0]
        if (firstModel) {
          nextModel = firstModel.id
          nextProviderId = providerId
          break
        }
      }

      if (!nextModel && providers.value.openai?.enabled) {
        nextModel = 'gpt-4o-mini'
        nextProviderId = 'openai'
      }

      if (nextModel) {
        defaultModel.value = nextModel
        defaultModelProviderId.value = nextProviderId
      } else {
        defaultModelProviderId.value = null
      }
    }
  }

  function updateCustomProvider(id: string, updates: Partial<CustomProvider>) {
    const index = customProviders.value.findIndex(p => p.id === id)
    if (index !== -1) {
      customProviders.value[index] = { ...customProviders.value[index], ...updates }
    }
  }

  function getApiKey(providerId: ProviderId): string {
    const config = getProviderConfig(providerId)
    if (Array.isArray(config.apiKey)) {
      // Random selection for multiple keys
      return config.apiKey[Math.floor(Math.random() * config.apiKey.length)]
    }
    return config.apiKey
  }

  function getProviderApiSpec(providerId: ProviderId): ApiSpec {
    if (String(providerId).startsWith('custom_')) {
      const custom = customProviders.value.find(p => p.id === providerId)
      return custom?.apiSpec || 'openai'
    }
    return providerId === 'anthropic' ? 'anthropic' : 'openai'
  }

  function getProviderName(providerId: ProviderId): string {
    // Check if it's a custom provider
    if (String(providerId).startsWith('custom_')) {
      const custom = customProviders.value.find(p => p.id === providerId)
      return custom?.name || providerId
    }

    // Look up built-in provider name
    return BUILTIN_PROVIDER_NAMES[providerId] || providerId
  }

  function mergeProviderModels(providerId: ProviderId): ModelInfo[] {
    const merged = new Map<string, ModelInfo>()

    for (const model of cachedModels.value[providerId] || []) {
      merged.set(model.id, model)
    }

    for (const model of manualModels.value[providerId] || []) {
      merged.set(model.id, model)
    }

    return Array.from(merged.values())
  }

  // Model cache actions
  function setProviderModels(providerId: ProviderId, models: ModelInfo[]) {
    cachedModels.value[providerId] = models
  }

  function getProviderModels(providerId: ProviderId): ModelInfo[] {
    return mergeProviderModels(providerId)
  }

  function addManualModel(providerId: ProviderId, model: Pick<ModelInfo, 'id' | 'name'>) {
    const normalizedId = model.id.trim()
    const normalizedName = model.name.trim() || normalizedId

    if (!normalizedId) return

    const providerModels = manualModels.value[providerId] || []
    const existingIndex = providerModels.findIndex((item) => item.id === normalizedId)
    const nextModel: ModelInfo = {
      id: normalizedId,
      name: normalizedName,
      providerId,
    }

    if (existingIndex === -1) {
      manualModels.value[providerId] = [...providerModels, nextModel]
      return
    }

    const updated = providerModels.slice()
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...nextModel,
    }
    manualModels.value[providerId] = updated
  }

  function removeManualModel(providerId: ProviderId, modelId: string) {
    const providerModels = manualModels.value[providerId] || []
    const nextModels = providerModels.filter((model) => model.id !== modelId)

    if (nextModels.length === 0) {
      delete manualModels.value[providerId]
    } else {
      manualModels.value[providerId] = nextModels
    }

    if (
      defaultModel.value === modelId &&
      defaultModelProviderId.value === providerId &&
      !getProviderModels(providerId).some((model) => model.id === modelId)
    ) {
      const fallbackModel = allCachedModels.value.find((model) => enabledProviders.value.includes(model.providerId))
      if (fallbackModel) {
        defaultModel.value = fallbackModel.id
        defaultModelProviderId.value = fallbackModel.providerId
      }
    }
  }

  function setProviderLoadingModels(providerId: ProviderId, loading: boolean) {
    isLoadingModels.value[providerId] = loading
  }

  function isProviderLoadingModels(providerId: ProviderId): boolean {
    return isLoadingModels.value[providerId] || false
  }

  function clearProviderModels(providerId: ProviderId) {
    delete cachedModels.value[providerId]
  }

  // Watch for theme changes and apply them automatically
  watch(isDarkMode, () => {
    applyTheme()
  }, { immediate: true })

  watch(
    [defaultModel, defaultModelProviderId, enabledProviders, allCachedModels],
    () => {
      if (!defaultModel.value) return

      if (hasSelectedDefaultModel.value) {
        return
      }

      const fallbackModel = allCachedModels.value.find((model) => enabledProviders.value.includes(model.providerId))
      if (fallbackModel) {
        defaultModel.value = fallbackModel.id
        defaultModelProviderId.value = fallbackModel.providerId
        return
      }

      if (providers.value.openai?.enabled) {
        defaultModel.value = 'gpt-4o-mini'
        defaultModelProviderId.value = 'openai'
      } else if (enabledProviders.value.length === 0) {
        defaultModelProviderId.value = null
      }
    },
    { deep: true, immediate: true }
  )

  // Support real-time system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme()
      }
    })
  }

  return {
    // State
    theme,
    defaultModel,
    defaultModelProviderId,
    currentPromptMode,
    modelParameters,
    reasoningEffort,
    openAIRequestMode,
    providers,
    customProviders,
    systemPrompts,
    cachedModels,
    manualModels,
    isLoadingModels,
    // Getters
    enabledProviders,
    currentSystemPrompt,
    isDarkMode,
    allCachedModels,
    // Actions
    setTheme,
    applyTheme,
    setDefaultModel,
    setPromptMode,
    updateModelParameters,
    setReasoningEffort,
    setOpenAIRequestMode,
    resetModelParameters,
    getProviderConfig,
    updateProviderConfig,
    setProviderEnabled,
    updateSystemPrompt,
    resetSystemPrompt,
    getApiKey,
    getProviderApiSpec,
    getProviderName,
    // Model cache actions
    setProviderModels,
    getProviderModels,
    addManualModel,
    removeManualModel,
    setProviderLoadingModels,
    isProviderLoadingModels,
    clearProviderModels,
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider,
  }
})

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { ChevronDown, Check, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import type { ModelInfo } from '@/lib/llm/types'
import type { ProviderId } from '@/types/provider'

const settingsStore = useSettingsStore()

const isLoading = ref(false)

const currentModel = computed(() => settingsStore.defaultModel)

// Use cached models from store, fallback to defaults
const availableModels = computed(() => {
  const enabledProviders = settingsStore.enabledProviders
  const enabled = new Set(enabledProviders)

  const cached = settingsStore.allCachedModels.filter((m) => enabled.has(m.providerId))
  const defaults = getDefaultModels().filter((m) => enabled.has(m.providerId))

  // If some providers have cached models, still show defaults for other enabled providers
  // (e.g. show Claude defaults even if only OpenAI models are cached).
  const providersWithCachedModels = new Set(cached.map((m) => m.providerId))
  const merged = [...cached]

  for (const model of defaults) {
    if (!providersWithCachedModels.has(model.providerId)) {
      merged.push(model)
    }
  }

  return merged.length > 0 ? merged : defaults
})

const currentModelName = computed(() => {
  const model = availableModels.value.find(m => m.id === currentModel.value)
  return model?.name || currentModel.value || 'Select Model'
})

// Fetch models from all enabled providers
async function fetchModels() {
  isLoading.value = true

  try {
    const enabledProviders = settingsStore.enabledProviders

    for (const providerId of enabledProviders) {
      const config = settingsStore.getProviderConfig(providerId)
      if (!config.apiKey) continue

      // Skip if already cached
      if (settingsStore.getProviderModels(providerId).length > 0) continue

      try {
        llmFactory.configureProvider(providerId, {
          apiKey: typeof config.apiKey === 'string' ? config.apiKey : config.apiKey[0],
          baseUrl: config.baseUrl,
        })

        const provider = llmFactory.getProvider(providerId)
        if (provider) {
          const models = await provider.getModels()
          settingsStore.setProviderModels(providerId, models)
        }
      } catch (error) {
        console.error(`Failed to fetch models for ${providerId}:`, error)
      }
    }
  } finally {
    isLoading.value = false
  }
}

function getDefaultModels(): ModelInfo[] {
  return [
    { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', supportsVision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', supportsVision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', providerId: 'openai', supportsVision: true },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', providerId: 'openai' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerId: 'anthropic', supportsVision: true },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', supportsVision: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', providerId: 'anthropic', supportsVision: true },
  ]
}

function selectModel(modelId: string) {
  settingsStore.setDefaultModel(modelId)
}

const providerNames: Record<ProviderId, string> = {
  openai: 'OpenAI',
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

function getProviderLabel(providerId: string): string {
  return providerNames[providerId as ProviderId] || providerId
}

// Group models by provider
const groupedModels = computed(() => {
  const groups: Record<string, ModelInfo[]> = {}
  for (const model of availableModels.value) {
    const key = model.providerId
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(model)
  }
  return groups
})

// Watch for changes in cached models
watch(() => settingsStore.allCachedModels, () => {
  // Models updated from settings page
}, { deep: true })

// React to provider enable/disable changes
watch(
  () => settingsStore.enabledProviders,
  () => {
    fetchModels()
  }
)

onMounted(() => {
  // Fetch models if not cached
  if (settingsStore.allCachedModels.length === 0) {
    fetchModels()
  }
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-7 px-2 text-xs justify-between min-w-[140px] max-w-[200px]"
        :disabled="isLoading"
      >
        <span class="truncate">{{ currentModelName }}</span>
        <Loader2 v-if="isLoading" class="ml-1 h-3 w-3 animate-spin" />
        <ChevronDown v-else class="ml-1 h-3 w-3 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-[220px] max-h-[300px] overflow-y-auto">
      <template v-for="(models, providerId) in groupedModels" :key="providerId">
        <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
          {{ getProviderLabel(providerId as string) }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="model in models"
          :key="model.id"
          class="flex items-center justify-between cursor-pointer"
          @select="selectModel(model.id)"
        >
          <span class="truncate text-sm">{{ model.name }}</span>
          <Check
            v-if="model.id === currentModel"
            class="h-4 w-4 text-primary flex-shrink-0"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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

const settingsStore = useSettingsStore()

const isLoading = ref(false)
const availableModels = ref<ModelInfo[]>([])

const currentModel = computed(() => settingsStore.defaultModel)
const currentModelName = computed(() => {
  const model = availableModels.value.find(m => m.id === currentModel.value)
  return model?.name || currentModel.value || 'Select Model'
})

// Fetch models from configured providers
async function fetchModels() {
  isLoading.value = true
  const models: ModelInfo[] = []

  try {
    // Get OpenAI models if configured
    const openaiConfig = settingsStore.getProviderConfig('openai')
    if (openaiConfig?.apiKey && typeof openaiConfig.apiKey === 'string') {
      llmFactory.configureProvider('openai', {
        apiKey: openaiConfig.apiKey,
        baseUrl: openaiConfig.baseUrl,
      })
      const provider = llmFactory.getProvider('openai')
      if (provider) {
        const providerModels = await provider.getModels()
        models.push(...providerModels)
      }
    }

    // Get Anthropic models if configured
    const anthropicConfig = settingsStore.getProviderConfig('anthropic')
    if (anthropicConfig?.apiKey && typeof anthropicConfig.apiKey === 'string') {
      llmFactory.configureProvider('anthropic', {
        apiKey: anthropicConfig.apiKey,
        baseUrl: anthropicConfig.baseUrl,
      })
      const provider = llmFactory.getProvider('anthropic')
      if (provider) {
        const providerModels = await provider.getModels()
        models.push(...providerModels)
      }
    }

    availableModels.value = models
  } catch (error) {
    console.error('Failed to fetch models:', error)
    // Use default models
    availableModels.value = getDefaultModels()
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

function getProviderLabel(providerId: string): string {
  switch (providerId) {
    case 'openai': return 'OpenAI'
    case 'anthropic': return 'Anthropic'
    default: return providerId
  }
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

onMounted(() => {
  // Load default models first, then fetch from API
  availableModels.value = getDefaultModels()
  fetchModels()
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
          @click="selectModel(model.id)"
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

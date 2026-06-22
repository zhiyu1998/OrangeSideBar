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
const currentProviderId = computed(() => settingsStore.defaultModelProviderId)

const availableModels = computed(() => {
  const enabledProviders = settingsStore.enabledProviders
  const enabled = new Set(enabledProviders)
  return settingsStore.allCachedModels.filter((m) => enabled.has(m.providerId))
})

const currentModelName = computed(() => {
  const model = availableModels.value.find((m) =>
    m.id === currentModel.value && (currentProviderId.value ? m.providerId === currentProviderId.value : true)
  ) || availableModels.value.find(m => m.id === currentModel.value)
  return model?.name || currentModel.value || 'Select Model'
})

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
          apiKey: settingsStore.getApiKey(providerId),
          baseUrl: config.baseUrl,
        }, settingsStore.getProviderApiSpec(providerId))

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

function selectModel(modelId: string, providerId: ProviderId) {
  settingsStore.setDefaultModel(modelId, providerId)
}

function getProviderLabel(providerId: string): string {
  return settingsStore.getProviderName(providerId as ProviderId)
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
  if (settingsStore.enabledProviders.length > 0) {
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
          :key="`${model.providerId}:${model.id}`"
          class="flex items-center justify-between cursor-pointer"
          @select="selectModel(model.id, model.providerId)"
        >
          <span class="truncate text-sm">{{ model.name }}</span>
          <Check
            v-if="model.id === currentModel && model.providerId === currentProviderId"
            class="h-4 w-4 text-primary flex-shrink-0"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

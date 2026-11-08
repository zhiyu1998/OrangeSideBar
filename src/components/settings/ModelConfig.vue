<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RotateCcw, RefreshCw, Sliders } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelInfo } from '@/lib/llm/types'
import type { ProviderId } from '@/types/provider'
import { t } from '@/locales'

const settingsStore = useSettingsStore()

const params = computed(() => settingsStore.modelParameters)
const defaultModel = computed(() => settingsStore.defaultModel)
const defaultModelProviderId = computed(() => settingsStore.defaultModelProviderId)

const MAX_TOKENS_LIMIT = 10000000

// Model fetching state
const isLoadingModels = ref(false)
const modelsByProvider = ref<Record<string, ModelInfo[]>>({})

interface ParamConfig {
  key: keyof typeof params.value
  labelKey: string
  descriptionKey: string
  min: number
  max: number
  step: number
  useSlider: boolean
}

interface MaxTokensPreset {
  label: string
  value: number
  descriptionKey: string
}

const maxTokensPresets: MaxTokensPreset[] = [
  { label: '1k', value: 1000, descriptionKey: 'settings.modelConfig.preset1k' },
  { label: '2k', value: 2000, descriptionKey: 'settings.modelConfig.preset2k' },
  { label: '4k', value: 4000, descriptionKey: 'settings.modelConfig.preset4k' },
  { label: '8k', value: 8000, descriptionKey: 'settings.modelConfig.preset8k' },
  { label: '16k', value: 16000, descriptionKey: 'settings.modelConfig.preset16k' },
  { label: '32k', value: 32000, descriptionKey: 'settings.modelConfig.preset32k' },
  { label: '64k', value: 64000, descriptionKey: 'settings.modelConfig.preset64k' },
  { label: '128k', value: 128000, descriptionKey: 'settings.modelConfig.preset128k' },
  { label: '200k', value: 200000, descriptionKey: 'settings.modelConfig.preset200k' },
  { label: '1M', value: 1000000, descriptionKey: 'settings.modelConfig.preset1M' },
  { label: '10M', value: 10000000, descriptionKey: 'settings.modelConfig.preset10M' },
]

const paramConfigs: ParamConfig[] = [
  {
    key: 'temperature',
    labelKey: 'settings.modelConfig.temperature',
    descriptionKey: 'settings.modelConfig.temperatureDesc',
    min: 0, max: 2, step: 0.1, useSlider: true,
  },
  {
    key: 'topP',
    labelKey: 'settings.modelConfig.topP',
    descriptionKey: 'settings.modelConfig.topPDesc',
    min: 0, max: 1, step: 0.05, useSlider: true,
  },
  {
    key: 'maxTokens',
    labelKey: 'settings.modelConfig.maxTokens',
    descriptionKey: 'settings.modelConfig.maxTokensDesc',
    min: 1, max: MAX_TOKENS_LIMIT, step: 1, useSlider: false,
  },
]

function getProviderDisplayName(providerId: ProviderId): string {
  return settingsStore.getProviderName(providerId)
}

const selectedMaxTokensPreset = computed(() => {
  const currentPreset = maxTokensPresets.find((preset) => preset.value === params.value.maxTokens)
  return currentPreset ? String(currentPreset.value) : 'custom'
})

const selectedMaxTokensLabel = computed(() => {
  return maxTokensPresets.find((preset) => preset.value === params.value.maxTokens)?.label || t('settings.modelConfig.customLabel')
})

function updateParam(key: keyof typeof params.value, value: number) {
  const config = paramConfigs.find((item) => item.key === key)
  if (!config || !Number.isFinite(value)) return

  const clampedValue = Math.min(config.max, Math.max(config.min, value))
  settingsStore.updateModelParameters({ [key]: clampedValue })
}

function selectMaxTokensPreset(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value !== 'string' || value === 'custom') return

  updateParam('maxTokens', Number(value))
}

function resetParams() {
  settingsStore.resetModelParameters()
}

function selectModel(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value !== 'string') return

  const [providerId, modelId] = value.split('::')
  if (!providerId || !modelId) return

  settingsStore.setDefaultModel(modelId, providerId as ProviderId)
}

const defaultModelSelectionValue = computed(() => {
  if (!defaultModel.value || !defaultModelProviderId.value) return ''
  return `${defaultModelProviderId.value}::${defaultModel.value}`
})

async function fetchModels() {
  isLoadingModels.value = true
  const grouped: Record<string, ModelInfo[]> = {}

  try {
    const enabledProviders = settingsStore.enabledProviders
    for (const providerId of enabledProviders) {
      const config = settingsStore.getProviderConfig(providerId)
      const manualModels = settingsStore.manualModels[providerId] || []

      if (config.apiKey) {
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
          console.error(error)
        }
      }

      const combinedModels = settingsStore.getProviderModels(providerId)
      if (combinedModels.length > 0 || manualModels.length > 0) {
        grouped[providerId] = combinedModels
      }
    }
    modelsByProvider.value = grouped
  } finally {
    isLoadingModels.value = false
  }
}

onMounted(() => {
  fetchModels()
})
</script>

<template>
  <div class="space-y-12">
    <!-- Default Model Section -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.modelConfig.activeEngine') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.modelConfig.activeEngineDesc') }}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-[10px]"
          :disabled="isLoadingModels"
          @click="fetchModels"
        >
          <RefreshCw :class="['mr-1 h-3 w-3', isLoadingModels ? 'animate-spin' : '']" />
          {{ $t('settings.modelConfig.updateModelList') }}
        </Button>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-semibold">{{ $t('settings.modelConfig.globalDefaultModel') }}</Label>
              <Badge variant="secondary" class="text-[10px]">{{ $t('settings.modelConfig.autoSynced') }}</Badge>
            </div>

            <Select :model-value="defaultModelSelectionValue" @update:model-value="selectModel">
              <SelectTrigger class="h-12 bg-background/50 border-muted">
                <SelectValue :placeholder="$t('settings.modelConfig.selectModel')" />
              </SelectTrigger>
              <SelectContent>
                <template v-if="Object.keys(modelsByProvider).length > 0">
                  <SelectGroup v-for="(models, providerId) in modelsByProvider" :key="providerId">
                    <SelectLabel class="text-[10px] uppercase text-muted-foreground">{{ getProviderDisplayName(providerId as ProviderId) }}</SelectLabel>
                    <SelectItem
                      v-for="model in models"
                      :key="`${model.providerId}:${model.id}`"
                      :value="`${model.providerId}::${model.id}`"
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-sm">{{ model.name }}</span>
                        <Badge v-if="model.supportsVision" variant="secondary" class="text-[9px] h-4 px-1">{{ $t('common.vision') }}</Badge>
                        <Badge v-if="model.isThinkingModel" variant="outline" class="text-[9px] h-4 px-1">{{ $t('common.thinking') }}</Badge>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </template>
                <template v-else>
                  <div class="px-3 py-2 text-xs text-muted-foreground">
                    {{ $t('settings.modelConfig.noModels') }}
                  </div>
                </template>
              </SelectContent>
            </Select>
            <p class="text-[10px] text-muted-foreground">{{ $t('settings.modelConfig.checkProvidersHint') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Parameters Section -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <Sliders class="h-4 w-4 text-orange-500" />
          <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.modelConfig.fineTuning') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.modelConfig.fineTuningDesc') }}
        </p>
        <Button variant="ghost" size="sm" class="h-7 text-[10px] text-muted-foreground" @click="resetParams">
          <RotateCcw class="mr-1 h-3 w-3" />
          {{ $t('settings.modelConfig.resetDefaults') }}
        </Button>
      </div>
      
      <div class="lg:col-span-2 space-y-4">
        <div class="bg-muted/20 border rounded-2xl p-6 space-y-8">
          <div
            v-for="config in paramConfigs"
            :key="config.key"
            class="space-y-4"
          >
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label :for="config.key" class="text-sm font-semibold">{{ $t(config.labelKey) }}</Label>
                <p class="text-[10px] text-muted-foreground pr-4">{{ $t(config.descriptionKey) }}</p>
              </div>
              <div class="bg-background/80 border rounded px-2 py-1 min-w-[3rem] text-center">
                <span class="text-xs font-bold tabular-nums">{{ params[config.key] }}</span>
              </div>
            </div>

            <template v-if="config.useSlider">
              <Slider
                :id="config.key"
                :model-value="[params[config.key]]"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                class="w-full"
                @update:model-value="(v) => v && updateParam(config.key, v[0])"
              />
            </template>
            <template v-else>
              <div v-if="config.key === 'maxTokens'" class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-3">
                <Input
                  :id="config.key"
                  type="number"
                  :model-value="params[config.key]"
                  :min="config.min"
                  :max="config.max"
                  :step="config.step"
                  class="h-10 bg-background/50"
                  @update:model-value="(val) => updateParam(config.key, Number(val))"
                />
                <Select :model-value="selectedMaxTokensPreset" @update:model-value="selectMaxTokensPreset">
                  <SelectTrigger class="h-10 w-full min-w-0 bg-background/50 border-muted">
                    <SelectValue as-child :placeholder="$t('settings.modelConfig.quickPickPlaceholder')">
                      <span class="truncate">{{ selectedMaxTokensLabel }}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="item-aligned" class="max-h-80 w-80 max-w-[calc(100vw-2rem)]">
                    <SelectGroup>
                      <SelectLabel class="text-[10px] uppercase text-muted-foreground">{{ $t('settings.modelConfig.quickPick') }}</SelectLabel>
                      <SelectItem value="custom" disabled>
                        {{ $t('settings.modelConfig.customValue') }}
                      </SelectItem>
                      <SelectItem
                        v-for="preset in maxTokensPresets"
                        :key="preset.value"
                        :value="String(preset.value)"
                      >
                        <div class="flex flex-col gap-0.5 py-1">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold tabular-nums">{{ preset.label }}</span>
                            <span class="text-[10px] text-muted-foreground tabular-nums">{{ $t('settings.modelConfig.tokens', { n: preset.value.toLocaleString() }) }}</span>
                          </div>
                          <span class="text-[10px] text-muted-foreground">{{ $t(preset.descriptionKey) }}</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Input
                v-else
                :id="config.key"
                type="number"
                :model-value="params[config.key]"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                class="h-10 bg-background/50"
                @update:model-value="(val) => updateParam(config.key, Number(val))"
              />
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

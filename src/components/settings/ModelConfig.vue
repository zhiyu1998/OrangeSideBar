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
  label: string
  description: string
  min: number
  max: number
  step: number
  useSlider: boolean
}

interface MaxTokensPreset {
  label: string
  value: number
  description: string
}

const maxTokensPresets: MaxTokensPreset[] = [
  { label: '1k', value: 1000, description: 'about 750 English words or 500-600 Chinese characters' },
  { label: '2k', value: 2000, description: 'about 1,500 English words' },
  { label: '4k', value: 4000, description: 'about 3,000 English words' },
  { label: '8k', value: 8000, description: 'about 6,000 English words' },
  { label: '16k', value: 16000, description: 'about 12,000 English words' },
  { label: '32k', value: 32000, description: 'about 24,000 English words' },
  { label: '64k', value: 64000, description: 'about 48,000 English words' },
  { label: '128k', value: 128000, description: 'about 96,000 English words' },
  { label: '200k', value: 200000, description: 'about 150,000 English words' },
  { label: '1M', value: 1000000, description: 'about 750,000 English words' },
  { label: '10M', value: 10000000, description: 'about 7.5 million English words' },
]

const paramConfigs: ParamConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Controls randomness. Lower values are more deterministic.',
    min: 0, max: 2, step: 0.1, useSlider: true,
  },
  {
    key: 'topP',
    label: 'Top P',
    description: 'Alternative to temperature, called nucleus sampling.',
    min: 0, max: 1, step: 0.05, useSlider: true,
  },
  {
    key: 'maxTokens',
    label: 'Max Tokens',
    description: 'Maximum response length.',
    min: 1, max: MAX_TOKENS_LIMIT, step: 1, useSlider: false,
  },
]

const providerNames: Record<ProviderId, string> = {
  openai: 'OpenAI',
  zhipu: 'Zhipu',
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

const selectedMaxTokensPreset = computed(() => {
  const currentPreset = maxTokensPresets.find((preset) => preset.value === params.value.maxTokens)
  return currentPreset ? String(currentPreset.value) : 'custom'
})

const selectedMaxTokensLabel = computed(() => {
  return maxTokensPresets.find((preset) => preset.value === params.value.maxTokens)?.label || 'Custom'
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
      if (!config.apiKey) continue
      try {
        llmFactory.configureProvider(providerId, {
          apiKey: settingsStore.getApiKey(providerId),
          baseUrl: config.baseUrl,
        }, settingsStore.getProviderApiSpec(providerId))
        const provider = llmFactory.getProvider(providerId)
        if (provider) {
          const models = await provider.getModels()
          grouped[providerId] = models
        }
      } catch (error) {
        console.error(error)
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
        <h3 class="text-sm font-bold tracking-tight">Active Engine</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Select the primary model that will power your general conversations. You can always override this in specific function settings.
        </p>
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-[10px]"
          :disabled="isLoadingModels"
          @click="fetchModels"
        >
          <RefreshCw :class="['mr-1 h-3 w-3', isLoadingModels ? 'animate-spin' : '']" />
          Update Model List
        </Button>
      </div>
      
      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-semibold">Global Default Model</Label>
              <Badge variant="secondary" class="text-[10px]">Auto-Synced</Badge>
            </div>
            
            <Select :model-value="defaultModelSelectionValue" @update:model-value="selectModel">
              <SelectTrigger class="h-12 bg-background/50 border-muted">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <template v-if="Object.keys(modelsByProvider).length > 0">
                  <SelectGroup v-for="(models, providerId) in modelsByProvider" :key="providerId">
                    <SelectLabel class="text-[10px] uppercase text-muted-foreground">{{ providerNames[providerId as ProviderId] || providerId }}</SelectLabel>
                    <SelectItem
                      v-for="model in models"
                      :key="`${model.providerId}:${model.id}`"
                      :value="`${model.providerId}::${model.id}`"
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-sm">{{ model.name }}</span>
                        <Badge v-if="model.supportsVision" variant="secondary" class="text-[9px] h-4 px-1">Vision</Badge>
                        <Badge v-if="model.isThinkingModel" variant="outline" class="text-[9px] h-4 px-1">Thinking</Badge>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </template>
                <template v-else>
                  <SelectItem value="openai::gpt-4o-mini">GPT-4o Mini (Fallback)</SelectItem>
                </template>
              </SelectContent>
            </Select>
            <p class="text-[10px] text-muted-foreground">Don't see your models? Check your API Providers configuration.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Parameters Section -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <Sliders class="h-4 w-4 text-orange-500" />
          <h3 class="text-sm font-bold tracking-tight">Fine-tuning</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Adjust how the model generates text. These parameters affect creativity, length, and coherence.
        </p>
        <Button variant="ghost" size="sm" class="h-7 text-[10px] text-muted-foreground" @click="resetParams">
          <RotateCcw class="mr-1 h-3 w-3" />
          Reset to Factory Defaults
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
                <Label :for="config.key" class="text-sm font-semibold">{{ config.label }}</Label>
                <p class="text-[10px] text-muted-foreground pr-4">{{ config.description }}</p>
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
                    <SelectValue as-child placeholder="Quick pick">
                      <span class="truncate">{{ selectedMaxTokensLabel }}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="item-aligned" class="max-h-80 w-80 max-w-[calc(100vw-2rem)]">
                    <SelectGroup>
                      <SelectLabel class="text-[10px] uppercase text-muted-foreground">Quick Pick</SelectLabel>
                      <SelectItem value="custom" disabled>
                        Custom value
                      </SelectItem>
                      <SelectItem
                        v-for="preset in maxTokensPresets"
                        :key="preset.value"
                        :value="String(preset.value)"
                      >
                        <div class="flex flex-col gap-0.5 py-1">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold tabular-nums">{{ preset.label }}</span>
                            <span class="text-[10px] text-muted-foreground tabular-nums">{{ preset.value.toLocaleString() }} tokens</span>
                          </div>
                          <span class="text-[10px] text-muted-foreground">{{ preset.description }}</span>
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

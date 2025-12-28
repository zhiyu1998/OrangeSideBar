<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RotateCcw, RefreshCw, Loader2, Check } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

// Model fetching state
const isLoadingModels = ref(false)
const availableModels = ref<ModelInfo[]>([])
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

const paramConfigs: ParamConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Controls randomness. Lower values make responses more focused and deterministic.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
  {
    key: 'topP',
    label: 'Top P',
    description: 'Controls diversity via nucleus sampling. 0.5 means half of all likelihood-weighted options are considered.',
    min: 0,
    max: 1,
    step: 0.05,
    useSlider: true,
  },
  {
    key: 'maxTokens',
    label: 'Max Tokens',
    description: 'Maximum number of tokens to generate in the response.',
    min: 1,
    max: 128000,
    step: 1,
    useSlider: false,
  },
  {
    key: 'frequencyPenalty',
    label: 'Frequency Penalty',
    description: 'Reduces repetition by penalizing tokens that have already appeared.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
  {
    key: 'presencePenalty',
    label: 'Presence Penalty',
    description: 'Encourages new topics by penalizing tokens that have appeared at all.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
]

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

function updateParam(key: keyof typeof params.value, value: number) {
  settingsStore.updateModelParameters({ [key]: value })
}

function resetParams() {
  settingsStore.resetModelParameters()
}

function selectModel(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setDefaultModel(value)
  }
}

async function fetchModels() {
  isLoadingModels.value = true
  const allModels: ModelInfo[] = []
  const grouped: Record<string, ModelInfo[]> = {}

  try {
    const enabledProviders = settingsStore.enabledProviders

    for (const providerId of enabledProviders) {
      const config = settingsStore.getProviderConfig(providerId)
      if (!config.apiKey) continue

      try {
        // Configure the provider
        llmFactory.configureProvider(providerId, {
          apiKey: typeof config.apiKey === 'string' ? config.apiKey : config.apiKey[0],
          baseUrl: config.baseUrl,
        })

        const provider = llmFactory.getProvider(providerId)
        if (provider) {
          const models = await provider.getModels()
          allModels.push(...models)
          grouped[providerId] = models
        }
      } catch (error) {
        console.error(`Failed to fetch models for ${providerId}:`, error)
      }
    }

    availableModels.value = allModels
    modelsByProvider.value = grouped
  } finally {
    isLoadingModels.value = false
  }
}

function getSelectedModelInfo(): ModelInfo | undefined {
  return availableModels.value.find((m) => m.id === defaultModel.value)
}

onMounted(() => {
  fetchModels()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Default Model Selection -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Default Model</CardTitle>
          <CardDescription>
            Select the default model for conversations.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="isLoadingModels"
          @click="fetchModels"
        >
          <Loader2 v-if="isLoadingModels" class="mr-2 h-4 w-4 animate-spin" />
          <RefreshCw v-else class="mr-2 h-4 w-4" />
          Refresh Models
        </Button>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Selected Model</Label>
          <Select :model-value="defaultModel" @update:model-value="selectModel">
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <template v-if="Object.keys(modelsByProvider).length > 0">
                <SelectGroup v-for="(models, providerId) in modelsByProvider" :key="providerId">
                  <SelectLabel>{{ providerNames[providerId as ProviderId] || providerId }}</SelectLabel>
                  <SelectItem
                    v-for="model in models"
                    :key="model.id"
                    :value="model.id"
                  >
                    <div class="flex items-center gap-2">
                      <span>{{ model.name }}</span>
                      <Badge v-if="model.supportsVision" variant="secondary" class="text-xs">Vision</Badge>
                      <Badge v-if="model.isThinkingModel" variant="outline" class="text-xs">Thinking</Badge>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </template>
              <template v-else>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Default)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
              </template>
            </SelectContent>
          </Select>
        </div>

        <!-- Current Model Info -->
        <div v-if="getSelectedModelInfo()" class="rounded-lg border p-3 bg-muted/50">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium">{{ getSelectedModelInfo()?.name }}</span>
            <Badge variant="secondary" class="text-xs">
              {{ providerNames[getSelectedModelInfo()?.providerId as ProviderId] }}
            </Badge>
            <Badge v-if="getSelectedModelInfo()?.supportsVision" variant="outline" class="text-xs">
              <Check class="mr-1 h-3 w-3" /> Vision
            </Badge>
            <Badge v-if="getSelectedModelInfo()?.isThinkingModel" variant="outline" class="text-xs">
              <Check class="mr-1 h-3 w-3" /> Thinking
            </Badge>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          Configure API keys in the Providers tab to see available models from each provider.
        </p>
      </CardContent>
    </Card>

    <!-- Model Parameters -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Model Parameters</CardTitle>
          <CardDescription>
            Fine-tune the model behavior with these parameters.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" @click="resetParams">
          <RotateCcw class="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </CardHeader>
      <CardContent class="space-y-6">
        <div
          v-for="config in paramConfigs"
          :key="config.key"
          class="space-y-3"
        >
          <div class="flex items-center justify-between">
            <Label :for="config.key">{{ config.label }}</Label>
            <span class="text-sm font-medium tabular-nums">
              {{ params[config.key] }}
            </span>
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
            <Input
              :id="config.key"
              type="number"
              :value="params[config.key]"
              :min="config.min"
              :max="config.max"
              :step="config.step"
              @input="(e: Event) => updateParam(config.key, Number((e.target as HTMLInputElement).value))"
            />
          </template>

          <p class="text-xs text-muted-foreground">
            {{ config.description }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

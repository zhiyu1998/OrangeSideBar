<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { 
  Check, 
  ChevronRight,
  CirclePlus,
  Trash2,
  Eye, 
  EyeOff, 
  Loader2, 
  X, 
  RefreshCw, 
  ExternalLink,
  Plus,
  Cpu,
  BarChart3,
  Globe,
  RotateCcw,
  Pencil,
} from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { ProviderId, CustomProvider } from '@/types/provider'
import { PROVIDER_ICONS } from '@/assets/icons/providerIcons'
import { PROVIDERS } from '@/constants/providers'
import {
  BUILTIN_PROVIDER_ICON_PRESETS,
  fetchWebsiteIcon,
  type BuiltInIconPreset,
} from '@/lib/providerIcon'
import { t } from '@/locales'
import ProviderIcon from '@/components/ProviderIcon.vue'
import AddProviderDialog from './AddProviderDialog.vue'

const settingsStore = useSettingsStore()

interface ProviderInfo {
  id: ProviderId
  name: string
  defaultBaseUrl: string
  icon?: string
  iconSvg?: string
  isCustom?: boolean
}

const builtInProviders: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', iconSvg: PROVIDER_ICONS.openai },
  { id: 'zhipu', name: '智谱清言 (GLM)', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', iconSvg: PROVIDER_ICONS.zhipu },
  { id: 'anthropic', name: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com', iconSvg: PROVIDER_ICONS.anthropic },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', iconSvg: PROVIDER_ICONS.deepseek },
  { id: 'siliconflow', name: 'SiliconFlow', defaultBaseUrl: 'https://api.siliconflow.cn/v1', iconSvg: PROVIDER_ICONS.siliconflow },
  { id: 'openrouter', name: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', iconSvg: PROVIDER_ICONS.openrouter },
  { id: 'groq', name: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', iconSvg: PROVIDER_ICONS.groq },
  { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://127.0.0.1:11434/v1', iconSvg: PROVIDER_ICONS.ollama },
]

const allProviders = computed<ProviderInfo[]>(() => {
  const builtIn: ProviderInfo[] = builtInProviders.map((p) => ({
    ...p,
    iconSvg: settingsStore.getProviderConfig(p.id).iconSvg || p.iconSvg,
  }))
  const custom: ProviderInfo[] = settingsStore.customProviders.map(p => ({
    id: p.id as ProviderId,
    name: p.name,
    defaultBaseUrl: p.baseUrl,
    icon: undefined,
    iconSvg: p.iconSvg,
    isCustom: true
  }))
  return [...builtIn, ...custom]
})

const builtInProviderList = computed(() => allProviders.value.filter((p) => !p.isCustom))
const customProviderList = computed(() => allProviders.value.filter((p) => p.isCustom))

const isAddDialogOpen = ref(false)
const isIconPickerOpen = ref(false)
const selectedProviderId = ref<ProviderId>('openai')
const modelPage = ref(1)
const modelsPerPage = 10

// Reset page and close icon picker when provider changes
watch(selectedProviderId, () => {
  modelPage.value = 1
  isIconPickerOpen.value = false
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isIconPickerOpen.value) {
    isIconPickerOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const showApiKey = ref<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>)
const testingProvider = ref<ProviderId | null>(null)
const testResult = ref<Record<ProviderId, 'success' | 'error' | null>>({} as Record<ProviderId, 'success' | 'error' | null>)
const fetchingIconProvider = ref<ProviderId | null>(null)
const iconFetchNotice = ref<Record<ProviderId, { type: 'success' | 'error'; text: string } | null>>({} as Record<ProviderId, { type: 'success' | 'error'; text: string } | null>)
const manualModelDrafts = ref<Record<ProviderId, { id: string; name: string }>>({} as Record<ProviderId, { id: string; name: string }>)

const selectedProvider = computed(() => allProviders.value.find(p => p.id === selectedProviderId.value))

// Compute the actual request URL based on current base URL and API spec
const actualRequestUrl = computed(() => {
  if (!selectedProvider.value) return ''

  const config = settingsStore.getProviderConfig(selectedProviderId.value)
  const baseUrl = config.baseUrl || selectedProvider.value.defaultBaseUrl

  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')

  // Get API path from provider info
  const providerInfo = PROVIDERS[selectedProviderId.value]
  if (!providerInfo) {
    // For custom providers, determine path based on API spec
    const customProvider = settingsStore.customProviders.find(p => p.id === selectedProviderId.value)
    if (customProvider) {
      if (customProvider.apiSpec === 'anthropic') {
        return `${cleanBaseUrl}/v1/messages`
      } else if (customProvider.apiSpec === 'google') {
        return `${cleanBaseUrl}/v1beta/models`
      } else {
        // OpenAI spec - check request mode
        const mode = settingsStore.openAIRequestMode
        return mode === 'responses'
          ? `${cleanBaseUrl}/responses`
          : `${cleanBaseUrl}/chat/completions`
      }
    }
    return cleanBaseUrl
  }

  // For built-in providers
  if (providerInfo.id === 'anthropic') {
    return `${cleanBaseUrl}${providerInfo.apiPath}`
  }

  // For OpenAI-compatible providers, check request mode
  const mode = settingsStore.openAIRequestMode
  if (mode === 'responses') {
    return `${cleanBaseUrl}/responses`
  }

  return `${cleanBaseUrl}${providerInfo.apiPath}`
})

function toggleShowApiKey(providerId: ProviderId) {
  showApiKey.value[providerId] = !showApiKey.value[providerId]
}

function updateApiKey(providerId: ProviderId, value: string) {
  settingsStore.updateProviderConfig(providerId, { apiKey: value })
}

function updateBaseUrl(providerId: ProviderId, value: string) {
  settingsStore.updateProviderConfig(providerId, { baseUrl: value })
}

function toggleEnabled(providerId: ProviderId, checked: boolean) {
  settingsStore.setProviderEnabled(providerId, checked)
}

async function testConnection(providerId: ProviderId) {
  const config = settingsStore.getProviderConfig(providerId)
  if (!config.apiKey) {
    testResult.value[providerId] = 'error'
    return
  }

  testingProvider.value = providerId
  testResult.value[providerId] = null

  try {
    llmFactory.configureProvider(providerId, {
      apiKey: settingsStore.getApiKey(providerId),
      baseUrl: config.baseUrl,
    }, settingsStore.getProviderApiSpec(providerId))

    const provider = llmFactory.getProvider(providerId)
    if (provider) {
      const models = await provider.getModels()
      settingsStore.setProviderModels(providerId, models)
      testResult.value[providerId] = 'success'
    } else {
      testResult.value[providerId] = 'error'
    }
  } catch {
    testResult.value[providerId] = 'error'
  } finally {
    testingProvider.value = null
  }
}

async function refreshModels(providerId: ProviderId) {
  settingsStore.setProviderLoadingModels(providerId, true)
  try {
    const config = settingsStore.getProviderConfig(providerId)
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
  } finally {
    settingsStore.setProviderLoadingModels(providerId, false)
  }
}

function handleAddCustomProvider(provider: CustomProvider) {
  settingsStore.addCustomProvider(provider)
  selectedProviderId.value = provider.id
}

function handleDeleteCustomProvider(id: string) {
  settingsStore.removeCustomProvider(id)
  selectedProviderId.value = 'openai'
}

function updateCustomProviderName(id: string, name: string) {
  settingsStore.updateCustomProvider(id, { name })
}

function updateProviderIcon(providerId: ProviderId, value: string) {
  settingsStore.updateProviderConfig(providerId, { iconSvg: value.trim() || undefined })
  iconFetchNotice.value[providerId] = null
}

function clearProviderIcon(providerId: ProviderId) {
  updateProviderIcon(providerId, '')
}

function selectBuiltInIcon(providerId: ProviderId, preset: BuiltInIconPreset) {
  const providerMeta = allProviders.value.find((p) => p.id === providerId)
  if (providerMeta && !providerMeta.isCustom && preset.id === providerId) {
    clearProviderIcon(providerId)
  } else {
    updateProviderIcon(providerId, preset.icon)
  }
  isIconPickerOpen.value = false
}

async function autoFetchProviderIcon(providerId: ProviderId) {
  const providerMeta = allProviders.value.find((p) => p.id === providerId)
  const targetUrl = (
    settingsStore.getProviderConfig(providerId).baseUrl ||
    providerMeta?.defaultBaseUrl ||
    ''
  ).trim()

  if (!targetUrl) {
    iconFetchNotice.value[providerId] = {
      type: 'error',
      text: t('settings.providers.fetchIconNoUrl'),
    }
    return
  }

  fetchingIconProvider.value = providerId
  iconFetchNotice.value[providerId] = null

  try {
    const icon = await fetchWebsiteIcon(targetUrl)
    settingsStore.updateProviderConfig(providerId, { iconSvg: icon })
    iconFetchNotice.value[providerId] = {
      type: 'success',
      text: t('settings.providers.fetchIconSuccess'),
    }
  } catch {
    iconFetchNotice.value[providerId] = {
      type: 'error',
      text: t('settings.providers.fetchIconFailed'),
    }
  } finally {
    if (fetchingIconProvider.value === providerId) {
      fetchingIconProvider.value = null
    }
  }
}

function getManualModelDraft(providerId: ProviderId) {
  if (!manualModelDrafts.value[providerId]) {
    manualModelDrafts.value[providerId] = { id: '', name: '' }
  }

  return manualModelDrafts.value[providerId]
}

function updateManualModelId(providerId: ProviderId, value: string) {
  const draft = getManualModelDraft(providerId)
  const previousId = draft.id
  draft.id = value
  if (!draft.name || draft.name === previousId || draft.name.trim().length === 0) {
    draft.name = value
  }
}

function updateManualModelName(providerId: ProviderId, value: string) {
  getManualModelDraft(providerId).name = value
}

function addManualModel(providerId: ProviderId) {
  const draft = getManualModelDraft(providerId)
  const modelId = draft.id.trim()
  const modelName = draft.name.trim() || modelId

  if (!modelId) return

  settingsStore.addManualModel(providerId, {
    id: modelId,
    name: modelName,
  })

  manualModelDrafts.value[providerId] = { id: '', name: '' }
}

function removeManualModel(providerId: ProviderId, modelId: string) {
  settingsStore.removeManualModel(providerId, modelId)
}

const onlyFreeModels = ref(false)

const ZHIPU_FREE_MODELS = new Set(['glm-4.7-flash', 'glm-4.5-flash', 'glm-4-flash-250414'])

function setOnlyFreeModels(v: boolean) {
  onlyFreeModels.value = v
}

function isFreeModel(providerId: ProviderId, modelId: string): boolean {
  if (providerId !== 'zhipu') return false
  return ZHIPU_FREE_MODELS.has(modelId.toLowerCase())
}

const currentProviderModels = computed(() => settingsStore.getProviderModels(selectedProviderId.value))
const currentManualModels = computed(() => settingsStore.manualModels[selectedProviderId.value] || [])

const filteredProviderModels = computed(() => {
  const models = currentProviderModels.value
  if (onlyFreeModels.value && selectedProviderId.value === 'zhipu') {
    return models.filter((m) => isFreeModel('zhipu', m.id))
  }
  return models
})

const paginatedModels = computed(() => {
  const start = (modelPage.value - 1) * modelsPerPage
  return filteredProviderModels.value.slice(start, start + modelsPerPage)
})

// Clamp page if models shrink after refresh / config change
watch(filteredProviderModels, () => {
  const maxPage = Math.max(1, Math.ceil(filteredProviderModels.value.length / modelsPerPage))
  if (modelPage.value > maxPage) {
    modelPage.value = maxPage
  }
})

watch(onlyFreeModels, () => {
  modelPage.value = 1
})
</script>

<template>
  <div class="flex flex-col md:flex-row items-start gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <!-- Master: Provider List -->
    <div class="w-full md:w-52 flex-shrink-0 flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        class="w-full justify-start gap-2 border-dashed h-8 rounded-lg bg-muted/5 group hover:border-primary/50 transition-colors px-3 text-xs font-medium"
        @click="isAddDialogOpen = true"
      >
        <Plus class="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span>{{ $t('settings.providers.addCustom') }}</span>
      </Button>

      <div class="space-y-3 pt-1">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between px-1.5">
            <span class="text-[11px] font-medium text-muted-foreground/60">{{ $t('settings.providers.builtInGroup') }}</span>
            <span class="text-[10px] text-muted-foreground/40 tabular-nums">{{ builtInProviderList.length }}</span>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="provider in builtInProviderList"
              :key="provider.id"
              class="group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border"
              :class="selectedProviderId === provider.id
                ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/20'
                : 'bg-background/80 hover:bg-muted/40 border-border/60'"
              @click="selectedProviderId = provider.id"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-6 h-6 rounded-md bg-muted/20 border border-border/50 flex items-center justify-center overflow-hidden p-1 flex-shrink-0"
                  :class="{ 'border-primary/30 bg-primary/5': selectedProviderId === provider.id }"
                >
                  <ProviderIcon :icon="provider.iconSvg || provider.icon" :alt="provider.name">
                    <Cpu class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </ProviderIcon>
                </div>
                <span class="text-xs font-medium tracking-tight text-foreground truncate">{{ provider.name }}</span>
              </div>

              <Switch
                class="scale-75 flex-shrink-0"
                :model-value="settingsStore.getProviderConfig(provider.id).enabled"
                @click.stop
                @update:model-value="(enabled: boolean) => toggleEnabled(provider.id, enabled)"
              />
            </div>
          </div>
        </div>

        <div v-if="customProviderList.length > 0" class="space-y-1.5">
          <div class="flex items-center justify-between px-1.5">
            <span class="text-[11px] font-medium text-muted-foreground/60">{{ $t('settings.providers.customGroup') }}</span>
            <span class="text-[10px] text-muted-foreground/40 tabular-nums">{{ customProviderList.length }}</span>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="provider in customProviderList"
              :key="provider.id"
              class="group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border"
              :class="selectedProviderId === provider.id
                ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/20'
                : 'bg-background/80 hover:bg-muted/40 border-border/60'"
              @click="selectedProviderId = provider.id"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-6 h-6 rounded-md bg-muted/20 border border-border/50 flex items-center justify-center overflow-hidden p-1 flex-shrink-0"
                  :class="{ 'border-primary/30 bg-primary/5': selectedProviderId === provider.id }"
                >
                  <ProviderIcon :icon="provider.iconSvg || provider.icon" :alt="provider.name">
                    <Cpu class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </ProviderIcon>
                </div>
                <span class="text-xs font-medium tracking-tight text-foreground truncate">{{ provider.name }}</span>
              </div>

              <Switch
                class="scale-75 flex-shrink-0"
                :model-value="settingsStore.getProviderConfig(provider.id).enabled"
                @click.stop
                @update:model-value="(enabled: boolean) => toggleEnabled(provider.id, enabled)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail: Provider Configuration -->
    <div class="flex-1 w-full min-w-0 bg-card/50 border border-border/70 rounded-xl p-5 overflow-visible flex flex-col gap-4 relative shadow-sm">
      <template v-if="selectedProvider">
        <div class="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="relative flex-shrink-0">
              <button
                type="button"
                class="group/icon relative w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/20 shadow-xs transition-all hover:border-primary/40 overflow-hidden p-1.5 cursor-pointer"
                :class="{ 'ring-2 ring-primary/20 border-primary/50': isIconPickerOpen }"
                :title="$t('settings.providers.clickToChangeIcon')"
                @click="isIconPickerOpen = !isIconPickerOpen"
              >
                <ProviderIcon :icon="selectedProvider.iconSvg || selectedProvider.icon" :alt="selectedProvider.name">
                  <Cpu class="w-4 h-4 text-muted-foreground" />
                </ProviderIcon>
                <span class="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover/icon:opacity-100 transition-opacity">
                  <Pencil class="w-3 h-3 text-primary" />
                </span>
              </button>

              <div
                v-if="isIconPickerOpen"
                class="fixed inset-0 z-20"
                @click="isIconPickerOpen = false"
              />

              <div
                v-if="isIconPickerOpen"
                class="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[330px] max-w-[calc(100vw-3rem)] rounded-xl border bg-background/95 backdrop-blur-xl shadow-xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                @click.stop
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold tracking-tight">{{ $t('settings.providers.chooseIcon') }}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      v-if="settingsStore.getProviderConfig(selectedProviderId).iconSvg"
                      variant="ghost"
                      size="sm"
                      class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded-md"
                      @click="clearProviderIcon(selectedProviderId)"
                    >
                      <RotateCcw v-if="!selectedProvider.isCustom" class="h-3 w-3" />
                      <X v-else class="h-3 w-3" />
                      {{ selectedProvider.isCustom ? $t('settings.providers.clearIcon') : $t('settings.providers.resetIcon') }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                      @click="isIconPickerOpen = false"
                    >
                      <X class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <span class="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {{ $t('settings.providers.builtInIcons') }}
                  </span>
                  <div class="grid grid-cols-5 gap-1.5">
                    <button
                      v-for="preset in BUILTIN_PROVIDER_ICON_PRESETS"
                      :key="preset.id"
                      type="button"
                      class="flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all cursor-pointer"
                      :class="(selectedProvider.iconSvg || selectedProvider.icon || '') === preset.icon
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-muted/40 bg-muted/10 hover:bg-muted/30 hover:border-primary/40'"
                      :title="preset.label"
                      @click="selectBuiltInIcon(selectedProviderId, preset)"
                    >
                      <div class="w-5 h-5 flex items-center justify-center overflow-hidden">
                        <ProviderIcon :icon="preset.icon" :alt="preset.label" />
                      </div>
                      <span class="w-full truncate text-center text-[10px] font-medium leading-tight">
                        {{ preset.label }}
                      </span>
                    </button>
                  </div>
                </div>

                <div class="space-y-2 border-t border-muted/30 pt-2.5">
                  <span class="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {{ $t('settings.providers.customIconOrFetch') }}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full h-8 rounded-lg border-muted/40 bg-background hover:bg-primary/5 hover:border-primary/40 transition-all gap-1.5 font-medium text-xs"
                    :disabled="fetchingIconProvider === selectedProviderId"
                    @click="autoFetchProviderIcon(selectedProviderId)"
                  >
                    <Loader2 v-if="fetchingIconProvider === selectedProviderId" class="h-3.5 w-3.5 animate-spin text-primary" />
                    <Globe v-else class="h-3.5 w-3.5 text-primary" />
                    <span>{{ fetchingIconProvider === selectedProviderId ? $t('settings.providers.fetchingIcon') : $t('settings.providers.autoFetchIcon') }}</span>
                  </Button>
                  <Input
                    :model-value="settingsStore.getProviderConfig(selectedProviderId).iconSvg || ''"
                    :placeholder="$t('settings.providers.providerIconPlaceholder')"
                    class="h-8 bg-background border-muted/40 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-lg text-xs font-mono"
                    @update:model-value="(value) => updateProviderIcon(selectedProviderId, String(value))"
                  />
                  <p
                    v-if="iconFetchNotice[selectedProviderId]"
                    class="text-[11px] font-medium"
                    :class="iconFetchNotice[selectedProviderId]?.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
                  >
                    {{ iconFetchNotice[selectedProviderId]?.text }}
                  </p>
                </div>
              </div>
            </div>

            <div class="min-w-0">
              <Input
                v-if="selectedProvider.isCustom"
                :model-value="selectedProvider.name"
                class="h-7 text-sm p-0 font-semibold tracking-tight bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 w-auto min-w-[120px]"
                @update:model-value="(val) => updateCustomProviderName(selectedProviderId, String(val))"
              />
              <h3 v-else class="text-sm font-semibold tracking-tight text-foreground truncate">{{ selectedProvider.name }}</h3>
            </div>
          </div>
          <a href="#" class="text-[11px] font-medium text-primary flex items-center gap-1 hover:underline decoration-1 underline-offset-4 flex-shrink-0">
            {{ $t('settings.providers.guide') }} <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <div class="space-y-4">
          <!-- API Key Section -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label class="text-xs font-medium">{{ $t('settings.providers.apiKeyAuth') }}</Label>
              <Button
                variant="outline"
                size="sm"
                class="h-6 px-2.5 text-[11px] rounded-md gap-1.5 font-medium transition-colors"
                :class="testResult[selectedProviderId] === 'success'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : testResult[selectedProviderId] === 'error'
                    ? 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15'
                    : ''"
                :disabled="testingProvider === selectedProviderId || !settingsStore.getProviderConfig(selectedProviderId).apiKey"
                @click="testConnection(selectedProviderId)"
              >
                <Loader2 v-if="testingProvider === selectedProviderId" class="h-3 w-3 animate-spin" />
                <Check v-else-if="testResult[selectedProviderId] === 'success'" class="h-3 w-3" />
                <X v-else-if="testResult[selectedProviderId] === 'error'" class="h-3 w-3" />
                <span v-if="testResult[selectedProviderId] === 'success'">{{ $t('settings.providers.testSuccess') }}</span>
                <span v-else-if="testResult[selectedProviderId] === 'error'">{{ $t('settings.providers.testError') }}</span>
                <span v-else>{{ $t('settings.providers.testIdle') }}</span>
              </Button>
            </div>
            <div class="relative">
              <Input
                :type="showApiKey[selectedProviderId] ? 'text' : 'password'"
                :model-value="settingsStore.getProviderConfig(selectedProviderId).apiKey as string"
                :placeholder="$t('settings.providers.apiKeyPlaceholder')"
                class="pr-9 h-9 bg-background border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors rounded-lg text-xs"
                @update:model-value="(value) => updateApiKey(selectedProviderId, String(value))"
              />
              <Button
                variant="ghost"
                size="icon"
                class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground rounded-md hover:bg-accent/50 transition-colors"
                @click="toggleShowApiKey(selectedProviderId)"
              >
                <EyeOff v-if="showApiKey[selectedProviderId]" class="h-3.5 w-3.5" />
                <Eye v-else class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <!-- Endpoint Section -->
          <div class="space-y-1.5">
            <Label class="text-xs font-medium">{{ $t('settings.providers.baseEndpoint') }}</Label>
            <Input
              :model-value="settingsStore.getProviderConfig(selectedProviderId).baseUrl"
              :placeholder="selectedProvider.defaultBaseUrl"
              class="h-9 bg-background border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors rounded-lg text-xs"
              @update:model-value="(value) => updateBaseUrl(selectedProviderId, String(value))"
            />
            <div class="flex items-start gap-1.5 px-0.5 text-[11px] text-muted-foreground/70">
              <span class="font-medium flex-shrink-0">{{ $t('settings.providers.requestUrl') }}</span>
              <span class="font-mono break-all">{{ actualRequestUrl }}</span>
            </div>
          </div>

          <!-- Manual Models Section -->
          <div class="pt-3 border-t border-border/50">
            <div class="rounded-lg border border-dashed border-border bg-muted/15 p-3 space-y-2.5">
              <div class="flex items-center gap-2">
                <CirclePlus class="h-3.5 w-3.5 text-primary/80" />
                <Label class="text-xs font-medium">{{ $t('settings.providers.manualModels') }}</Label>
                <Badge variant="outline" class="text-[9px] uppercase tracking-wider bg-background/70 px-1.5 py-0">
                  {{ $t('common.optional') }}
                </Badge>
              </div>

              <div class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input
                  :model-value="getManualModelDraft(selectedProviderId).id"
                  :placeholder="$t('settings.providers.modelIdPlaceholder')"
                  class="h-8 text-xs rounded-md bg-background/80"
                  @update:model-value="(value) => updateManualModelId(selectedProviderId, String(value))"
                />
                <Input
                  :model-value="getManualModelDraft(selectedProviderId).name"
                  :placeholder="$t('settings.providers.modelNamePlaceholder')"
                  class="h-8 text-xs rounded-md bg-background/80"
                  @update:model-value="(value) => updateManualModelName(selectedProviderId, String(value))"
                />
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 px-3 text-xs rounded-md"
                  :disabled="!getManualModelDraft(selectedProviderId).id.trim()"
                  @click="addManualModel(selectedProviderId)"
                >
                  {{ $t('common.add') }}
                </Button>
              </div>

              <p class="text-[11px] text-muted-foreground/80">
                {{ $t('settings.providers.manualHint') }}
              </p>

              <div v-if="currentManualModels.length > 0" class="space-y-1.5">
                <div
                  v-for="model in currentManualModels"
                  :key="`manual:${model.id}`"
                  class="flex items-center justify-between rounded-md border bg-background/70 px-2.5 py-1.5"
                >
                  <div class="min-w-0">
                    <div class="truncate text-xs font-medium">{{ model.name }}</div>
                    <div class="truncate text-[10px] font-mono text-muted-foreground/60">{{ model.id }}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive"
                    @click="removeManualModel(selectedProviderId, model.id)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Model Cache Section -->
          <transition name="fade">
            <div v-if="settingsStore.getProviderModels(selectedProviderId).length > 0" class="space-y-2.5 pt-3 border-t border-border/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <BarChart3 class="w-3.5 h-3.5 text-primary/80" />
                  <Label class="text-xs font-semibold text-muted-foreground">{{ $t('settings.providers.engineInventory') }}</Label>
                </div>
                <Button variant="ghost" size="icon" class="h-7 w-7 rounded-md hover:bg-primary/5 transition-colors" @click="refreshModels(selectedProviderId)">
                  <RefreshCw :class="['h-3.5 w-3.5 text-primary', settingsStore.isProviderLoadingModels(selectedProviderId) ? 'animate-spin' : '']" />
                </Button>
              </div>

              <div v-if="selectedProviderId === 'zhipu'" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Switch
                    class="scale-75"
                    :model-value="onlyFreeModels"
                    @update:model-value="setOnlyFreeModels"
                  />
                  <span class="text-xs font-medium text-muted-foreground">{{ $t('settings.providers.onlyFreeModels') }}</span>
                  <Badge variant="outline" class="text-[9px] uppercase tracking-wider bg-muted/20 px-1.5 py-0 border-muted/50">{{ $t('settings.providers.zhipuBadge') }}</Badge>
                </div>
              </div>

              <div v-if="filteredProviderModels.length === 0" class="py-4 text-center text-xs text-muted-foreground/60">
                {{ $t('settings.providers.noMatchingModels') }}
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  v-for="model in paginatedModels"
                  :key="model.id"
                  class="px-2.5 py-2 rounded-lg border bg-background/60 hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer group flex items-center justify-between gap-2"
                  :class="{ 'border-primary/50 bg-primary/5 ring-1 ring-primary/20': settingsStore.defaultModel === model.id && settingsStore.defaultModelProviderId === selectedProviderId }"
                  @click="settingsStore.setDefaultModel(model.id, selectedProviderId)"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium truncate text-foreground">{{ model.name }}</span>
                    <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span class="text-[10px] text-muted-foreground/60 truncate font-mono">{{ model.id }}</span>
                      <Badge
                        v-if="isFreeModel(selectedProviderId, model.id)"
                        variant="outline"
                        class="text-[9px] uppercase tracking-wider bg-muted/10 px-1 py-0 border-muted/40 flex-shrink-0"
                      >
                        {{ $t('common.free') }}
                      </Badge>
                    </div>
                  </div>
                  <div class="w-6 h-6 rounded-md bg-muted/20 flex items-center justify-center group-hover:bg-primary/10 transition-colors flex-shrink-0">
                    <Check v-if="settingsStore.defaultModel === model.id && settingsStore.defaultModelProviderId === selectedProviderId" class="h-3.5 w-3.5 text-primary" />
                    <ChevronRight v-else class="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>

              <!-- Model Pagination -->
              <div v-if="filteredProviderModels.length > modelsPerPage" class="pt-2 flex justify-center">
                <Pagination v-slot="{ page }" :total="filteredProviderModels.length" :items-per-page="modelsPerPage" v-model:page="modelPage">
                  <PaginationContent>
                    <PaginationPrevious class="rounded-md h-7 hover:bg-primary/5 transition-colors border-muted/30" />

                    <template v-for="(_, index) in page > 0 ? [1] : []" :key="index">
                      <div class="flex items-center gap-1 px-3">
                        <span class="text-xs font-semibold text-muted-foreground">{{ modelPage }}</span>
                        <span class="text-[10px] text-muted-foreground/40">/</span>
                        <span class="text-xs text-muted-foreground/60">{{ Math.ceil(filteredProviderModels.length / modelsPerPage) }}</span>
                      </div>
                    </template>

                    <PaginationNext class="rounded-md h-7 hover:bg-primary/5 transition-colors border-muted/30" />
                  </PaginationContent>
                </Pagination>
              </div>
              <p class="text-[10px] text-center text-muted-foreground/40 font-medium uppercase tracking-wider pt-1">{{ $t('settings.providers.synced') }}</p>
            </div>
          </transition>

          <!-- Delete Custom Provider -->
          <div v-if="selectedProvider.isCustom" class="pt-3 border-t border-border/50 flex justify-end items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              class="rounded-lg px-3 h-8 text-xs font-medium"
              @click="handleDeleteCustomProvider(selectedProviderId)"
            >
              {{ $t('settings.providers.deleteProvider') }}
            </Button>
          </div>
        </div>
      </template>
      <div v-else class="flex-1 py-12 flex flex-col items-center justify-center text-muted-foreground/40 text-xs font-medium">
        <Cpu class="w-16 h-16 mb-3 stroke-1 opacity-15" />
        {{ $t('settings.providers.selectToBegin') }}
      </div>
    </div>
  </div>

  <AddProviderDialog 
    v-model:open="isAddDialogOpen"
    @add="handleAddCustomProvider"
  />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

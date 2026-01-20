<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  Check, 
  ChevronRight,
  Eye, 
  EyeOff, 
  Loader2, 
  X, 
  RefreshCw, 
  ExternalLink,
  Plus,
  Cpu,
} from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Pagination,
  PaginationContent,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import BorderBeam from '@/components/inspira/ui/BorderBeam.vue'
import type { ProviderId, CustomProvider } from '@/types/provider'
import { PROVIDER_ICONS } from '@/assets/icons/providerIcons'
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
  const custom: ProviderInfo[] = settingsStore.customProviders.map(p => ({
    id: p.id as ProviderId,
    name: p.name,
    defaultBaseUrl: p.baseUrl,
    icon: undefined,
    iconSvg: p.iconSvg,
    isCustom: true
  }))
  return [...builtInProviders, ...custom]
})

const isAddDialogOpen = ref(false)
const selectedProviderId = ref<ProviderId>('openai')
const modelPage = ref(1)
const modelsPerPage = 10

// Reset page when provider changes
watch(selectedProviderId, () => {
  modelPage.value = 1
})

const showApiKey = ref<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>)
const testingProvider = ref<ProviderId | null>(null)
const testResult = ref<Record<ProviderId, 'success' | 'error' | null>>({} as Record<ProviderId, 'success' | 'error' | null>)

const selectedProvider = computed(() => allProviders.value.find(p => p.id === selectedProviderId.value))

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
  <div class="flex gap-10 min-h-[700px] animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Master: Provider List -->
    <div class="w-60 flex flex-col gap-3">
      <div class="flex items-center justify-between px-2">
        <h4 class="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Providers</h4>
        <Badge variant="outline" class="text-[9px] opacity-50 px-1.5 h-4">{{ allProviders.length }}</Badge>
      </div>

      <Button 
        variant="outline" 
        class="w-full justify-start gap-2 border-dashed h-10 rounded-xl bg-muted/5 group hover:border-primary/50 transition-all px-3"
        @click="isAddDialogOpen = true"
      >
        <Plus class="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span class="text-xs font-semibold">Add Custom</span>
      </Button>
      
      <ScrollArea class="flex-1 -mr-4 pr-4">
        <div class="space-y-5 pb-4">
          <div
            v-for="provider in allProviders"
            :key="provider.id"
            class="group relative flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all border box-border shadow-sm hover:shadow-md"
            :class="selectedProviderId === provider.id 
              ? 'bg-primary/5 border-primary/40' 
              : 'bg-background hover:bg-muted/30 border-muted/30'"
            @click="selectedProviderId = provider.id"
          >
            <div class="flex items-center gap-3">
              <div 
                class="w-8 h-8 rounded-lg bg-muted/10 border flex items-center justify-center transition-all group-hover:scale-105 shadow-inner overflow-hidden"
                :class="{ 'border-primary/20 bg-primary/5': selectedProviderId === provider.id }"
              >
                <div v-if="provider.iconSvg" v-html="provider.iconSvg" class="w-5 h-5 flex items-center justify-center provider-logo" />
                <img v-else-if="provider.icon" :src="provider.icon" class="w-5 h-5 flex-shrink-0" />
                <Cpu v-else class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-semibold tracking-tight text-foreground">{{ provider.name }}</span>
              </div>
            </div>
            
            <Switch
              class="scale-75"
              :model-value="settingsStore.getProviderConfig(provider.id).enabled"
              @click.stop
              @update:model-value="(enabled: boolean) => toggleEnabled(provider.id, enabled)"
            />

            <!-- Selected indicator -->
            <BorderBeam 
              v-if="selectedProviderId === provider.id"
              :size="100" 
              :duration="6" 
              :border-width="2.5" 
              color-from="#f97316"
              color-to="#fb923c"
            />
          </div>
        </div>
      </ScrollArea>
    </div>

    <!-- Detail: Provider Configuration -->
    <div class="flex-1 bg-muted/5 border border-muted/50 rounded-[2rem] p-8 overflow-hidden flex flex-col gap-8 relative shadow-inner">
      <template v-if="selectedProvider">
        <div class="flex items-center justify-between border-b border-muted/30 pb-8">
          <div class="flex items-center gap-4">
            <div 
              v-if="selectedProvider.iconSvg || selectedProvider.icon"
              class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/20 shadow-sm transition-transform hover:scale-105 overflow-hidden"
            >
              <div v-if="selectedProvider.iconSvg" v-html="selectedProvider.iconSvg" class="w-7 h-7 flex items-center justify-center provider-logo" />
              <img v-else :src="selectedProvider.icon" class="w-7 h-7" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <Input
                  v-if="selectedProvider.isCustom"
                  :model-value="selectedProvider.name"
                  class="h-7 text-xl p-0 font-black tracking-tighter bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 w-auto min-w-[120px]"
                  @update:model-value="(val) => updateCustomProviderName(selectedProviderId, String(val))"
                />
                <h3 v-else class="text-xl font-black tracking-tighter text-foreground">{{ selectedProvider.name }}</h3>
              </div>
              <p class="text-[9px] font-medium text-muted-foreground/60 mt-0.5 uppercase tracking-[0.15em]">Configuration</p>
            </div>
          </div>
          <a href="#" class="text-[10px] font-bold text-primary flex items-center gap-1.5 hover:underline decoration-1 underline-offset-4 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/20 transition-colors hover:bg-primary/10">
            Guide <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <ScrollArea class="flex-1 -mr-6 pr-6">
          <div class="space-y-12 pb-10">
            <!-- API Key Section -->
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Label class="text-sm font-extrabold tracking-tight">API Key Authentication</Label>
                </div>
                <Badge variant="outline" class="text-[9px] uppercase tracking-widest bg-muted/20 px-2 py-0.5 border-muted/50">Encrypted Storage</Badge>
              </div>
              <div class="relative group">
                <Input
                  :type="showApiKey[selectedProviderId] ? 'text' : 'password'"
                  :model-value="settingsStore.getProviderConfig(selectedProviderId).apiKey as string"
                  placeholder="Paste your private key..."
                  class="pr-14 h-15 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-base shadow-sm"
                  @update:model-value="(value) => updateApiKey(selectedProviderId, String(value))"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  class="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground rounded-xl hover:bg-accent/50 transition-colors"
                  @click="toggleShowApiKey(selectedProviderId)"
                >
                  <EyeOff v-if="showApiKey[selectedProviderId]" class="h-5 w-5" />
                  <Eye v-else class="h-5 w-5" />
                </Button>
              </div>
            </div>

            <!-- Endpoint Section -->
            <div class="space-y-6">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-primary" />
                <Label class="text-sm font-extrabold tracking-tight">Base API Endpoint</Label>
              </div>
              <div class="space-y-2">
                <Input
                  :model-value="settingsStore.getProviderConfig(selectedProviderId).baseUrl"
                  :placeholder="selectedProvider.defaultBaseUrl"
                  class="h-15 bg-background border-muted/30 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-2xl shadow-sm"
                  @update:model-value="(value) => updateBaseUrl(selectedProviderId, String(value))"
                />
                <div class="flex items-center gap-2 px-1">
                  <span class="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.1em]">Recommended:</span>
                  <span class="text-[10px] font-mono text-muted-foreground/60 break-all">{{ selectedProvider.defaultBaseUrl }}</span>
                </div>
              </div>
            </div>

            <!-- Actions Section -->
            <div class="flex items-center gap-6 pt-6">
              <Button
                variant="default"
                class="flex-1 h-15 font-black text-sm rounded-2xl shadow-xl transition-all gap-3 hover:scale-[1.02] active:scale-95"
                :class="testResult[selectedProviderId] === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-600/90 shadow-emerald-500/20 border-emerald-600'
                  : 'shadow-primary/20'"
                :disabled="testingProvider === selectedProviderId || !settingsStore.getProviderConfig(selectedProviderId).apiKey"
                @click="testConnection(selectedProviderId)"
              >
                <Loader2 v-if="testingProvider === selectedProviderId" class="h-5 w-5 animate-spin" />
                <Check v-else-if="testResult[selectedProviderId] === 'success'" class="h-5 w-5 text-white" />
                <X v-else-if="testResult[selectedProviderId] === 'error'" class="h-5 w-5 text-white" />
                <span v-if="testResult[selectedProviderId] === 'success'">Configuration Verified</span>
                <span v-else-if="testResult[selectedProviderId] === 'error'">Connection Error</span>
                <span v-else>Initialize Connection Test</span>
              </Button>
            </div>

            <!-- Model Cache Section -->
            <transition name="fade">
              <div v-if="settingsStore.getProviderModels(selectedProviderId).length > 0" class="space-y-6 pt-10 border-t border-muted/30">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <BarChart3 class="w-4 h-4 text-primary/80" />
                    <Label class="text-sm font-extrabold tracking-tight uppercase tracking-wider opacity-60">Engine Inventory</Label>
                  </div>
                  <Button variant="ghost" size="sm" class="h-9 w-9 rounded-xl hover:bg-primary/5 transition-colors" @click="refreshModels(selectedProviderId)">
                    <RefreshCw :class="['h-4 w-4 text-primary', settingsStore.isProviderLoadingModels(selectedProviderId) ? 'animate-spin' : '']" />
                  </Button>
                </div>

                <div v-if="selectedProviderId === 'zhipu'" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Switch
                      class="scale-75"
                      :model-value="onlyFreeModels"
                      @update:model-value="setOnlyFreeModels"
                    />
                    <span class="text-xs font-semibold text-muted-foreground">只看免费模型</span>
                    <Badge variant="outline" class="text-[9px] uppercase tracking-widest bg-muted/20 px-2 py-0.5 border-muted/50">Zhipu</Badge>
                  </div>
                </div>
                
                <div v-if="filteredProviderModels.length === 0" class="py-6 text-center text-xs text-muted-foreground/60">
                  没有匹配的模型（可关闭“只看免费模型”）
                </div>

                <div v-else class="grid grid-cols-2 gap-3">
                  <div
                    v-for="model in paginatedModels"
                    :key="model.id"
                    class="p-4 rounded-2xl border bg-background/50 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer group flex items-center justify-between shadow-sm relative overflow-hidden"
                    :class="{ 'border-primary/50 bg-primary/5 ring-1 ring-primary/20': settingsStore.defaultModel === model.id }"
                    @click="settingsStore.setDefaultModel(model.id)"
                  >
                    <div class="flex flex-col min-w-0 pr-3 z-10">
                      <span class="text-[13px] font-bold truncate leading-none text-foreground">{{ model.name }}</span>
                      <div class="flex items-center gap-2 mt-1.5 min-w-0">
                        <span class="text-[10px] text-muted-foreground/50 truncate uppercase tracking-widest font-mono">{{ model.id }}</span>
                        <Badge
                          v-if="isFreeModel(selectedProviderId, model.id)"
                          variant="outline"
                          class="text-[9px] uppercase tracking-widest bg-muted/10 px-1.5 py-0.5 border-muted/40"
                        >
                          FREE
                        </Badge>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 z-10">
                      <div v-if="settingsStore.defaultModel === model.id" class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <div class="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Check v-if="settingsStore.defaultModel === model.id" class="h-4 w-4 text-primary" />
                        <ChevronRight v-else class="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Model Pagination -->
                <div v-if="filteredProviderModels.length > modelsPerPage" class="pt-4 flex justify-center">
                  <Pagination v-slot="{ page }" :total="filteredProviderModels.length" :items-per-page="modelsPerPage" v-model:page="modelPage">
                    <PaginationContent>
                      <PaginationPrevious class="rounded-xl h-9 hover:bg-primary/5 transition-colors border-muted/30" />
                      
                      <template v-for="(_, index) in page > 0 ? [1] : []" :key="index">
                        <!-- Simplified pagination display -->
                        <div class="flex items-center gap-1 px-4">
                          <span class="text-xs font-bold text-muted-foreground">{{ modelPage }}</span>
                          <span class="text-[10px] text-muted-foreground/30 px-1">/</span>
                          <span class="text-xs font-medium text-muted-foreground/40">{{ Math.ceil(filteredProviderModels.length / modelsPerPage) }}</span>
                        </div>
                      </template>

                      <PaginationNext class="rounded-xl h-9 hover:bg-primary/5 transition-colors border-muted/30" />
                    </PaginationContent>
                  </Pagination>
                </div>
                <p class="text-[10px] text-center text-muted-foreground/30 font-medium uppercase tracking-[0.2em] pt-4">Synchronized with remote endpoint</p>
              </div>
            </transition>

            <!-- Delete Custom Provider -->
            <div v-if="selectedProvider.isCustom" class="pt-8 border-t border-muted/30 flex justify-end items-center gap-4 group/del">
              <Button 
                variant="destructive"
                class="rounded-xl px-6 h-11 font-bold shadow-lg shadow-destructive/20 hover:scale-105 transition-all"
                @click="handleDeleteCustomProvider(selectedProviderId)"
              >
                Delete Provider
              </Button>
            </div>
          </div>
        </ScrollArea>
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center text-muted-foreground/20 italic font-medium tracking-tighter">
        <Cpu class="w-32 h-32 mb-4 stroke-1 opacity-10" />
        Select a provider to begin
      </div>
    </div>
  </div>

  <AddProviderDialog 
    v-model:open="isAddDialogOpen"
    @add="handleAddCustomProvider"
  />
</template>

<style scoped>
:deep(.provider-logo svg) {
  width: 100%;
  height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

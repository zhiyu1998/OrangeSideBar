<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Check, 
  Eye, 
  EyeOff, 
  Loader2, 
  X, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Plus,
  Cpu
} from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import BorderBeam from '@/components/inspira/ui/BorderBeam.vue'
import type { ProviderId } from '@/types/provider'

const settingsStore = useSettingsStore()

interface ProviderInfo {
  id: ProviderId
  name: string
  description: string
  defaultBaseUrl: string
  icon?: string
}

const providers: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4o-mini', defaultBaseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet', defaultBaseUrl: 'https://api.anthropic.com' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek-V3, R1', defaultBaseUrl: 'https://api.deepseek.com/v1' },
  { id: 'siliconflow', name: 'SiliconFlow', description: 'Open-source models', defaultBaseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Universal API gateway', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq', name: 'Groq', description: 'Ultra-fast LLaMA', defaultBaseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'ollama', name: 'Ollama', description: 'Local LLM server', defaultBaseUrl: 'http://127.0.0.1:11434/v1' },
]

const selectedProviderId = ref<ProviderId>('openai')
const showApiKey = ref<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>)
const testingProvider = ref<ProviderId | null>(null)
const testResult = ref<Record<ProviderId, 'success' | 'error' | null>>({} as Record<ProviderId, 'success' | 'error' | null>)

const selectedProvider = computed(() => providers.find(p => p.id === selectedProviderId.value))

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
      apiKey: typeof config.apiKey === 'string' ? config.apiKey : config.apiKey[0],
      baseUrl: config.baseUrl,
    })

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
      apiKey: typeof config.apiKey === 'string' ? config.apiKey : config.apiKey[0],
      baseUrl: config.baseUrl,
    })
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
</script>

<template>
  <div class="flex gap-12 min-h-[750px] animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Master: Provider List -->
    <div class="w-80 flex flex-col gap-4">
      <div class="flex items-center justify-between px-2">
        <h4 class="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Service Providers</h4>
        <Badge variant="outline" class="text-[9px] opacity-50 px-1.5 h-4">{{ providers.length }} Available</Badge>
      </div>

      <Button variant="outline" class="w-full justify-start gap-3 border-dashed h-14 rounded-2xl bg-muted/5 group hover:border-primary/50 transition-all">
        <Plus class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span class="text-xs font-semibold">Custom Endpoint</span>
      </Button>
      
      <ScrollArea class="flex-1 -mr-4 pr-4">
        <div class="space-y-3 pb-8">
          <div
            v-for="provider in providers"
            :key="provider.id"
            class="group relative flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border box-border shadow-sm hover:shadow-md"
            :class="selectedProviderId === provider.id 
              ? 'bg-primary/5 border-primary/40' 
              : 'bg-background hover:bg-muted/30 border-muted/30'"
            @click="selectedProviderId = provider.id"
          >
            <div class="flex items-center gap-4">
              <div 
                class="w-12 h-12 rounded-xl bg-muted/10 border flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3 shadow-inner"
                :class="{ 'border-primary/20 bg-primary/5': selectedProviderId === provider.id }"
              >
                <img v-if="provider.icon" :src="provider.icon" class="w-7 h-7" />
                <Cpu v-else class="w-6 h-6 text-muted-foreground" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold tracking-tight text-foreground">{{ provider.name }}</span>
                <span class="text-[11px] text-muted-foreground/60 truncate leading-tight mt-0.5">{{ provider.description }}</span>
              </div>
            </div>
            
            <Switch
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
    <div class="flex-1 bg-muted/10 border border-muted/50 rounded-[2.5rem] p-10 overflow-hidden flex flex-col gap-10 relative shadow-inner">
      <template v-if="selectedProvider">
        <div class="flex items-center justify-between border-b border-muted/30 pb-10">
          <div class="flex items-center gap-6">
            <div class="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg shadow-primary/5 transition-transform hover:scale-105">
              <Zap class="w-8 h-8 fill-primary/10" />
            </div>
            <div>
              <h3 class="text-2xl font-black tracking-tighter text-foreground">{{ selectedProvider.name }}</h3>
              <p class="text-xs font-medium text-muted-foreground/60 mt-1 uppercase tracking-widest">Advanced Configuration</p>
            </div>
          </div>
          <a href="#" class="text-[11px] font-bold text-primary flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/20 transition-colors hover:bg-primary/10">
            Setup Guide <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <ScrollArea class="flex-1 -mr-6 pr-6">
          <div class="space-y-12 pb-10">
            <!-- API Key Section -->
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <ShieldCheck class="w-4 h-4 text-orange-500" />
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
                class="flex-1 h-15 font-black text-sm rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3"
                :disabled="testingProvider === selectedProviderId || !settingsStore.getProviderConfig(selectedProviderId).apiKey"
                @click="testConnection(selectedProviderId)"
              >
                <Loader2 v-if="testingProvider === selectedProviderId" class="h-5 w-5 animate-spin" />
                <ShieldCheck v-else-if="testResult[selectedProviderId] === 'success'" class="h-5 w-5 text-white" />
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
                
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="model in settingsStore.getProviderModels(selectedProviderId).slice(0, 10)"
                    :key="model.id"
                    class="p-4 rounded-2xl border bg-background/50 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer group flex items-center justify-between shadow-sm relative overflow-hidden"
                    :class="{ 'border-primary/50 bg-primary/5 ring-1 ring-primary/20': settingsStore.defaultModel === model.id }"
                    @click="settingsStore.setDefaultModel(model.id)"
                  >
                    <div class="flex flex-col min-w-0 pr-3 z-10">
                      <span class="text-[13px] font-bold truncate leading-none text-foreground">{{ model.name }}</span>
                      <span class="text-[10px] text-muted-foreground/50 truncate mt-1 font-mono uppercase tracking-tighter">{{ model.id }}</span>
                    </div>
                    <Check v-if="settingsStore.defaultModel === model.id" class="h-4 w-4 text-primary flex-shrink-0 z-10" />
                    <div v-if="settingsStore.defaultModel === model.id" class="absolute -right-2 -bottom-2 w-12 h-12 bg-primary/5 rounded-full blur-xl" />
                  </div>
                </div>
                <p class="text-[10px] text-center text-muted-foreground/30 font-medium uppercase tracking-[0.2em] pt-4">Synchronized with remote endpoint</p>
              </div>
            </transition>
          </div>
        </ScrollArea>
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center text-muted-foreground/20 italic font-medium tracking-tighter">
        <Cpu class="w-32 h-32 mb-4 stroke-1 opacity-10" />
        Select a provider to begin
      </div>
    </div>
  </div>
</template>

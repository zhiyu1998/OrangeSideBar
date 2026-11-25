<script setup lang="ts">
import { ref } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  Cpu, 
  Globe, 
  ChevronRight, 
  Hash,
  Link as LinkIcon,
  Loader2,
  X,
} from 'lucide-vue-next'
import type { ApiSpec, CustomProvider } from '@/types/provider'
import { BUILTIN_PROVIDER_ICON_PRESETS, fetchWebsiteIcon } from '@/lib/providerIcon'
import { t } from '@/locales'
import ProviderIcon from '@/components/ProviderIcon.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'add', provider: CustomProvider): void
}>()

const step = ref(1)
const selectedSpec = ref<ApiSpec>('openai')
const providerName = ref('')
const customIconSvg = ref('')
const baseUrl = ref('https://api.openai.com/v1')
const isFetchingIcon = ref(false)
const iconFetchNotice = ref<{ type: 'success' | 'error'; text: string } | null>(null)
let iconFetchSeq = 0

const specs = [
  { id: 'openai', name: 'OpenAI', descriptionKey: 'settings.addProvider.specOpenaiDesc', icon: Globe, enabled: true },
  { id: 'anthropic', name: 'Claude', descriptionKey: 'settings.addProvider.specAnthropicDesc', icon: Bot, enabled: true },
  { id: 'google', name: 'Google', descriptionKey: 'settings.addProvider.specGoogleDesc', icon: Cpu, enabled: false },
]

function handleSelectSpec(specId: ApiSpec) {
  if (specId === 'google') return
  selectedSpec.value = specId
  
  // Set default base URL based on spec
  if (specId === 'openai') baseUrl.value = 'https://api.openai.com/v1'
  if (specId === 'anthropic') baseUrl.value = 'https://api.anthropic.com'
  
  step.value = 2
}

function reset() {
  step.value = 1
  providerName.value = ''
  customIconSvg.value = ''
  selectedSpec.value = 'openai'
  baseUrl.value = 'https://api.openai.com/v1'
  iconFetchSeq += 1
  isFetchingIcon.value = false
  iconFetchNotice.value = null
}

function handleDialogOpenChange(val: boolean) {
  emit('update:open', val)
  if (!val) {
    reset()
  }
}

async function handleAutoFetchIcon() {
  const targetUrl = baseUrl.value.trim()
  if (!targetUrl) {
    iconFetchNotice.value = {
      type: 'error',
      text: t('settings.providers.fetchIconNoUrl'),
    }
    return
  }

  const seq = ++iconFetchSeq
  isFetchingIcon.value = true
  iconFetchNotice.value = null

  try {
    const icon = await fetchWebsiteIcon(targetUrl)
    if (seq !== iconFetchSeq) return
    customIconSvg.value = icon
    iconFetchNotice.value = {
      type: 'success',
      text: t('settings.providers.fetchIconSuccess'),
    }
  } catch {
    if (seq !== iconFetchSeq) return
    iconFetchNotice.value = {
      type: 'error',
      text: t('settings.providers.fetchIconFailed'),
    }
  } finally {
    if (seq === iconFetchSeq) {
      isFetchingIcon.value = false
    }
  }
}

function handleSave() {
  if (!providerName.value) return

  const newProvider: CustomProvider = {
    id: `custom_${Date.now()}`,
    name: providerName.value,
    iconSvg: customIconSvg.value.trim() || undefined,
    apiSpec: selectedSpec.value,
    baseUrl: baseUrl.value,
    apiKey: '',
    enabled: true,
  }

  emit('add', newProvider)
  emit('update:open', false)
  reset()
}
</script>

<template>
  <Dialog :open="open" @update:open="handleDialogOpenChange">
    <DialogContent class="sm:max-w-[500px] p-0 overflow-hidden border-none bg-background/80 backdrop-blur-2xl shadow-2xl rounded-[2.5rem]">
      <!-- Header with Progress -->
      <div class="p-8 pb-4">
        <div class="flex items-center gap-2 mb-2">
          <Badge variant="outline" class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-primary/5 border-primary/20 text-primary">
            {{ $t('settings.addProvider.stepOf', { step }) }}
          </Badge>
          <div class="flex-1 h-[1px] bg-muted/30" />
        </div>
        <h2 class="text-2xl font-black tracking-tighter text-foreground">
          {{ step === 1 ? $t('settings.addProvider.selectSpec') : $t('settings.addProvider.providerDetails') }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ step === 1 ? $t('settings.addProvider.selectSpecDesc') : $t('settings.addProvider.providerDetailsDesc') }}
        </p>
      </div>

      <div class="p-8 pt-4">
        <!-- Step 1: Spec Selection -->
        <div v-if="step === 1" class="space-y-3">
          <div
            v-for="spec in specs"
            :key="spec.id"
            class="group relative flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer box-border"
            :class="[
              spec.enabled 
                ? 'bg-background hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:bg-primary/[0.02]' 
                : 'opacity-50 grayscale cursor-not-allowed bg-muted/5'
            ]"
            @click="handleSelectSpec(spec.id as ApiSpec)"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-muted/10 border flex items-center justify-center transition-all group-hover:scale-110">
                <component :is="spec.icon" class="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div class="flex flex-col">
                <span class="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  {{ spec.name }}
                  <Badge v-if="!spec.enabled" variant="secondary" class="text-[8px] h-4 uppercase">{{ $t('settings.addProvider.comingSoon') }}</Badge>
                </span>
                <span class="text-xs text-muted-foreground/60 leading-tight mt-0.5">{{ $t(spec.descriptionKey) }}</span>
              </div>
            </div>
            <ChevronRight v-if="spec.enabled" class="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        <!-- Step 2: Information -->
        <div v-else class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div class="space-y-4">
            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{{ $t('settings.addProvider.providerName') }}</Label>
              <div class="relative group">
                <Input
                  v-model="providerName"
                  :placeholder="$t('settings.addProvider.providerNamePlaceholder')"
                  class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-base pr-12"
                />
                <Hash class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 pointer-events-none" />
              </div>
            </div>

            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{{ $t('settings.addProvider.baseEndpoint') }}</Label>
              <div class="relative group">
                <Input 
                  v-model="baseUrl"
                  placeholder="https://your-api.com/v1"
                  class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-sm pr-12"
                />
                <LinkIcon class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 pointer-events-none" />
              </div>
            </div>

            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{{ $t('settings.addProvider.customIcon') }}</Label>
              <div class="flex items-center gap-2">
                <div class="relative group flex-1">
                  <Input
                    v-model="customIconSvg"
                    :placeholder="$t('settings.addProvider.customIconPlaceholder')"
                    class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-xs font-mono pr-16"
                    @update:model-value="iconFetchNotice = null"
                  />
                  <button
                    v-if="customIconSvg"
                    type="button"
                    class="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
                    :aria-label="$t('settings.providers.clearIcon')"
                    @click="customIconSvg = ''; iconFetchNotice = null"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                  <div class="absolute right-3.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center pointer-events-none">
                    <ProviderIcon :icon="customIconSvg">
                      <Cpu class="h-5 w-5 text-muted-foreground/30" />
                    </ProviderIcon>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  class="h-14 px-3.5 rounded-2xl border-muted/30 bg-background hover:bg-primary/5 hover:border-primary/40 transition-all gap-1.5 flex-shrink-0 text-xs font-semibold"
                  :disabled="isFetchingIcon || !baseUrl.trim()"
                  @click="handleAutoFetchIcon"
                >
                  <Loader2 v-if="isFetchingIcon" class="h-4 w-4 animate-spin text-primary" />
                  <Globe v-else class="h-4 w-4 text-primary" />
                  <span>{{ isFetchingIcon ? $t('settings.providers.fetchingIcon') : $t('settings.providers.autoFetchIcon') }}</span>
                </Button>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  v-for="preset in BUILTIN_PROVIDER_ICON_PRESETS"
                  :key="preset.id"
                  type="button"
                  class="w-8 h-8 rounded-lg border p-1.5 flex items-center justify-center transition-all cursor-pointer"
                  :class="customIconSvg === preset.icon
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-muted/40 bg-background hover:bg-muted/30 hover:border-primary/40'"
                  :title="preset.label"
                  @click="customIconSvg = preset.icon; iconFetchNotice = null"
                >
                  <ProviderIcon :icon="preset.icon" :alt="preset.label" />
                </button>
              </div>
              <p class="text-[9px] text-muted-foreground/60 px-1 italic">{{ $t('settings.addProvider.customIconHint') }}</p>
              <p
                v-if="iconFetchNotice"
                class="text-[11px] px-1 font-medium"
                :class="iconFetchNotice.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
              >
                {{ iconFetchNotice.text }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <DialogFooter class="p-8 bg-muted/10 border-t border-muted/30 gap-3">
        <Button
          v-if="step === 2"
          variant="ghost"
          class="h-12 rounded-2xl font-bold transition-all px-6 hover:bg-background/50"
          @click="step = 1"
        >
          {{ $t('common.back') }}
        </Button>
        <div class="flex-1" />
        <Button
          variant="ghost"
          class="h-12 rounded-2xl font-bold transition-all px-6 text-muted-foreground"
          @click="emit('update:open', false); reset()"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button
          v-if="step === 2"
          class="h-12 px-8 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          :disabled="!providerName"
          @click="handleSave"
        >
          {{ $t('settings.addProvider.create') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
</style>

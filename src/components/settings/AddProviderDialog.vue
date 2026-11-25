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
    <DialogContent class="sm:max-w-[440px] p-0 overflow-hidden border bg-background/95 backdrop-blur-2xl shadow-xl rounded-2xl">
      <!-- Header with Progress -->
      <div class="p-5 pb-3">
        <div class="flex items-center gap-2 mb-1.5">
          <Badge variant="outline" class="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 bg-primary/5 border-primary/20 text-primary">
            {{ $t('settings.addProvider.stepOf', { step }) }}
          </Badge>
          <div class="flex-1 h-[1px] bg-muted/30" />
        </div>
        <h2 class="text-lg font-bold tracking-tight text-foreground">
          {{ step === 1 ? $t('settings.addProvider.selectSpec') : $t('settings.addProvider.providerDetails') }}
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ step === 1 ? $t('settings.addProvider.selectSpecDesc') : $t('settings.addProvider.providerDetailsDesc') }}
        </p>
      </div>

      <div class="px-5 py-3">
        <!-- Step 1: Spec Selection -->
        <div v-if="step === 1" class="space-y-2.5">
          <div
            v-for="spec in specs"
            :key="spec.id"
            class="group relative flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer box-border"
            :class="[
              spec.enabled 
                ? 'bg-background hover:border-primary/50 hover:bg-primary/[0.02]' 
                : 'opacity-50 grayscale cursor-not-allowed bg-muted/5'
            ]"
            @click="handleSelectSpec(spec.id as ApiSpec)"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-muted/15 border flex items-center justify-center transition-colors">
                <component :is="spec.icon" class="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                  {{ spec.name }}
                  <Badge v-if="!spec.enabled" variant="secondary" class="text-[8px] h-4 uppercase">{{ $t('settings.addProvider.comingSoon') }}</Badge>
                </span>
                <span class="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{{ $t(spec.descriptionKey) }}</span>
              </div>
            </div>
            <ChevronRight v-if="spec.enabled" class="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        <!-- Step 2: Information -->
        <div v-else class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label class="text-[11px] font-semibold text-muted-foreground">{{ $t('settings.addProvider.providerName') }}</Label>
              <div class="relative group">
                <Input
                  v-model="providerName"
                  :placeholder="$t('settings.addProvider.providerNamePlaceholder')"
                  class="h-9 bg-background border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors rounded-lg text-xs pr-9"
                />
                <Hash class="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
              </div>
            </div>

            <div class="space-y-1.5">
              <Label class="text-[11px] font-semibold text-muted-foreground">{{ $t('settings.addProvider.baseEndpoint') }}</Label>
              <div class="relative group">
                <Input 
                  v-model="baseUrl"
                  placeholder="https://your-api.com/v1"
                  class="h-9 bg-background border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors rounded-lg text-xs pr-9"
                />
                <LinkIcon class="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
              </div>
            </div>

            <div class="space-y-1.5">
              <Label class="text-[11px] font-semibold text-muted-foreground">{{ $t('settings.addProvider.customIcon') }}</Label>
              <div class="flex items-center gap-2">
                <div class="relative group flex-1">
                  <Input
                    v-model="customIconSvg"
                    :placeholder="$t('settings.addProvider.customIconPlaceholder')"
                    class="h-9 bg-background border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors rounded-lg text-xs font-mono pr-14"
                    @update:model-value="iconFetchNotice = null"
                  />
                  <button
                    v-if="customIconSvg"
                    type="button"
                    class="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
                    :aria-label="$t('settings.providers.clearIcon')"
                    @click="customIconSvg = ''; iconFetchNotice = null"
                  >
                    <X class="h-3 w-3" />
                  </button>
                  <div class="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center pointer-events-none">
                    <ProviderIcon :icon="customIconSvg">
                      <Cpu class="h-4 w-4 text-muted-foreground/40" />
                    </ProviderIcon>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  class="h-9 px-3 rounded-lg border-border/70 bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors gap-1.5 flex-shrink-0 text-xs font-medium"
                  :disabled="isFetchingIcon || !baseUrl.trim()"
                  @click="handleAutoFetchIcon"
                >
                  <Loader2 v-if="isFetchingIcon" class="h-3.5 w-3.5 animate-spin text-primary" />
                  <Globe v-else class="h-3.5 w-3.5 text-primary" />
                  <span>{{ isFetchingIcon ? $t('settings.providers.fetchingIcon') : $t('settings.providers.autoFetchIcon') }}</span>
                </Button>
              </div>
              <div class="flex flex-wrap items-center gap-1 pt-0.5">
                <button
                  v-for="preset in BUILTIN_PROVIDER_ICON_PRESETS"
                  :key="preset.id"
                  type="button"
                  class="w-7 h-7 rounded-md border p-1 flex items-center justify-center transition-colors cursor-pointer"
                  :class="customIconSvg === preset.icon
                    ? 'border-primary bg-primary/10 shadow-xs'
                    : 'border-muted/40 bg-background hover:bg-muted/30 hover:border-primary/40'"
                  :title="preset.label"
                  @click="customIconSvg = preset.icon; iconFetchNotice = null"
                >
                  <ProviderIcon :icon="preset.icon" :alt="preset.label" />
                </button>
              </div>
              <p class="text-[10px] text-muted-foreground/70 px-0.5">{{ $t('settings.addProvider.customIconHint') }}</p>
              <p
                v-if="iconFetchNotice"
                class="text-[11px] px-0.5 font-medium"
                :class="iconFetchNotice.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
              >
                {{ iconFetchNotice.text }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <DialogFooter class="px-5 py-3.5 bg-muted/10 border-t border-muted/30 gap-2">
        <Button
          v-if="step === 2"
          variant="ghost"
          size="sm"
          class="h-8 rounded-lg font-medium px-3 text-xs hover:bg-background/50"
          @click="step = 1"
        >
          {{ $t('common.back') }}
        </Button>
        <div class="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          class="h-8 rounded-lg font-medium px-3 text-xs text-muted-foreground"
          @click="emit('update:open', false); reset()"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button
          v-if="step === 2"
          size="sm"
          class="h-8 px-4 rounded-lg font-semibold text-xs shadow-sm"
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

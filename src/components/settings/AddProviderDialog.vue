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
} from 'lucide-vue-next'
import type { ApiSpec, CustomProvider } from '@/types/provider'

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

const specs = [
  { id: 'openai', name: 'OpenAI', description: 'Compatible with standard /chat/completions', icon: Globe, enabled: true },
  { id: 'anthropic', name: 'Claude', description: 'Anthropic Claude Messages API', icon: Bot, enabled: true },
  { id: 'google', name: 'Google', description: 'Google Gemini API', icon: Cpu, enabled: false },
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
}

function handleSave() {
  if (!providerName.value) return

  const newProvider: CustomProvider = {
    id: `custom_${Date.now()}`,
    name: providerName.value,
    iconSvg: customIconSvg.value || undefined,
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
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-[500px] p-0 overflow-hidden border-none bg-background/80 backdrop-blur-2xl shadow-2xl rounded-[2.5rem]">
      <!-- Header with Progress -->
      <div class="p-8 pb-4">
        <div class="flex items-center gap-2 mb-2">
          <Badge variant="outline" class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-primary/5 border-primary/20 text-primary">
            Step {{ step }} of 2
          </Badge>
          <div class="flex-1 h-[1px] bg-muted/30" />
        </div>
        <h2 class="text-2xl font-black tracking-tighter text-foreground">
          {{ step === 1 ? 'Select API Specification' : 'Provider Details' }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ step === 1 ? 'Choose the protocol your provider uses' : 'Customize your new endpoint connection' }}
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
                  <Badge v-if="!spec.enabled" variant="secondary" class="text-[8px] h-4 uppercase">Coming Soon</Badge>
                </span>
                <span class="text-xs text-muted-foreground/60 leading-tight mt-0.5">{{ spec.description }}</span>
              </div>
            </div>
            <ChevronRight v-if="spec.enabled" class="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        <!-- Step 2: Information -->
        <div v-else class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div class="space-y-4">
            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Provider Name</Label>
              <div class="relative group">
                <Input 
                  v-model="providerName"
                  placeholder="e.g., My Private API"
                  class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-base pr-12"
                />
                <Hash class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 pointer-events-none" />
              </div>
            </div>

            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Custom SVG Icon (Optional)</Label>
              <div class="relative group">
                <Input 
                  v-model="customIconSvg"
                  placeholder="Paste SVG code from iconfont.cn..."
                  class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-xs font-mono pr-12"
                />
                <Cpu v-if="!customIconSvg" class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 pointer-events-none" />
                <div v-else v-html="customIconSvg" class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center opacity-50 provider-logo pointer-events-none" />
              </div>
              <p class="text-[9px] text-muted-foreground/40 px-1 italic">Leave empty to use default engine icon</p>
            </div>

            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Base Endpoint</Label>
              <div class="relative group">
                <Input 
                  v-model="baseUrl"
                  placeholder="https://your-api.com/v1"
                  class="h-14 bg-background border-muted/30 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all rounded-2xl text-sm pr-12"
                />
                <LinkIcon class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 pointer-events-none" />
              </div>
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
          Back
        </Button>
        <div class="flex-1" />
        <Button 
          variant="ghost" 
          class="h-12 rounded-2xl font-bold transition-all px-6 text-muted-foreground"
          @click="emit('update:open', false); reset()"
        >
          Cancel
        </Button>
        <Button 
          v-if="step === 2"
          class="h-12 px-8 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          :disabled="!providerName"
          @click="handleSave"
        >
          Create Provider
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:deep(.provider-logo svg) {
  width: 100%;
  height: 100%;
}
</style>

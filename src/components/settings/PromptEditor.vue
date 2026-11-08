<script setup lang="ts">
import { ref, computed } from 'vue'
import { RotateCcw, Brain, MessageSquare } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { PromptMode } from '@/types/settings'

const settingsStore = useSettingsStore()

const activeMode = ref<PromptMode>('default')

interface PromptInfo {
  mode: PromptMode
  labelKey: string
  descriptionKey: string
}

const promptModes: PromptInfo[] = [
  { mode: 'default', labelKey: 'settings.prompts.modeDefault', descriptionKey: 'settings.prompts.modeDescDefault' },
  { mode: 'paper', labelKey: 'settings.prompts.modeAcademic', descriptionKey: 'settings.prompts.modeDescAcademic' },
  { mode: 'learning', labelKey: 'settings.prompts.modeLearning', descriptionKey: 'settings.prompts.modeDescLearning' },
]

const prompts = computed(() => settingsStore.systemPrompts)

function updatePrompt(mode: PromptMode, value: string) {
  settingsStore.updateSystemPrompt(mode, value)
}

function resetPrompt(mode: PromptMode) {
  settingsStore.resetSystemPrompt(mode)
}

function getCharCount(mode: PromptMode): number {
  return prompts.value[mode]?.length || 0
}
</script>

<template>
  <div class="space-y-12">
    <!-- Active Prompt Configuration -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <Brain class="h-4 w-4 text-orange-500" />
          <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.prompts.persona') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.prompts.personaDesc') }}
        </p>

        <div class="flex flex-col gap-1">
          <button
            v-for="info in promptModes"
            :key="info.mode"
            class="text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
            :class="activeMode === info.mode ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-accent'"
            @click="activeMode = info.mode"
          >
            {{ $t('settings.prompts.modeTitle', { label: $t(info.labelKey) }) }}
          </button>
        </div>
      </div>
      
      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-sm font-semibold">{{ $t('settings.prompts.instructions', { label: $t(promptModes.find(p => p.mode === activeMode)?.labelKey ?? '') }) }}</Label>
              <p class="text-[10px] text-muted-foreground">{{ $t(promptModes.find(p => p.mode === activeMode)?.descriptionKey ?? '') }}</p>
            </div>
            <Button variant="ghost" size="sm" class="h-7 text-[10px]" @click="resetPrompt(activeMode)">
              <RotateCcw class="mr-1 h-3 w-3" /> {{ $t('common.reset') }}
            </Button>
          </div>

          <Textarea
            :model-value="prompts[activeMode]"
            class="min-h-[350px] font-mono text-xs bg-background/50 border-muted resize-none leading-relaxed"
            @update:model-value="(v) => updatePrompt(activeMode, String(v ?? ''))"
          />
          
          <div class="flex justify-between items-center px-1">
            <span class="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
              {{ $t('settings.prompts.chars', { n: getCharCount(activeMode).toLocaleString() }) }}
            </span>
            <span class="text-[10px] text-primary/60 italic">{{ $t('settings.prompts.autosave') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Selection Section -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <MessageSquare class="h-4 w-4 text-muted-foreground" />
          <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.prompts.activeTrigger') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.prompts.activeTriggerDesc') }}
        </p>
      </div>
      
      <div class="lg:col-span-2 flex flex-wrap gap-3">
        <div
          v-for="info in promptModes"
          :key="info.mode"
          class="flex-1 min-w-[140px] p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md"
          :class="settingsStore.currentPromptMode === info.mode ? 'bg-primary/5 border-primary shadow-sm' : 'bg-muted/10 border-transparent'"
          @click="settingsStore.setPromptMode(info.mode)"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold">{{ $t(info.labelKey) }}</span>
              <div v-if="settingsStore.currentPromptMode === info.mode" class="w-2 h-2 rounded-full bg-primary" />
            </div>
            <p class="text-[10px] text-muted-foreground leading-tight">{{ $t(info.descriptionKey) }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

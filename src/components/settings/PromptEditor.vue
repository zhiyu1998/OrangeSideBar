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
  label: string
  description: string
}

const promptModes: PromptInfo[] = [
  { mode: 'default', label: 'Default', description: 'General-purpose system prompt.' },
  { mode: 'paper', label: 'Academic', description: 'Optimized for paper analysis.' },
  { mode: 'learning', label: 'Learning', description: 'Socratic tutoring mode.' },
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
          <h3 class="text-sm font-bold tracking-tight">System Persona</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Define the AI's personality and rules. Choose a preset mode to edit its specific instructions below.
        </p>
        
        <div class="flex flex-col gap-1">
          <button
            v-for="info in promptModes"
            :key="info.mode"
            class="text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
            :class="activeMode === info.mode ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-accent'"
            @click="activeMode = info.mode"
          >
            {{ info.label }} Mode
          </button>
        </div>
      </div>
      
      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-sm font-semibold">{{ promptModes.find(p => p.mode === activeMode)?.label }} Instructions</Label>
              <p class="text-[10px] text-muted-foreground">{{ promptModes.find(p => p.mode === activeMode)?.description }}</p>
            </div>
            <Button variant="ghost" size="sm" class="h-7 text-[10px]" @click="resetPrompt(activeMode)">
              <RotateCcw class="mr-1 h-3 w-3" /> Reset
            </Button>
          </div>

          <Textarea
            :model-value="prompts[activeMode]"
            class="min-h-[350px] font-mono text-xs bg-background/50 border-muted resize-none leading-relaxed"
            @update:model-value="(v) => updatePrompt(activeMode, String(v ?? ''))"
          />
          
          <div class="flex justify-between items-center px-1">
            <span class="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
              {{ getCharCount(activeMode).toLocaleString() }} Chars
            </span>
            <span class="text-[10px] text-primary/60 italic">Changes save automatically</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Selection Section -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <MessageSquare class="h-4 w-4 text-muted-foreground" />
          <h3 class="text-sm font-bold tracking-tight">Active Trigger</h3>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          The selected mode below will be used as the starting persona for all new chat sessions.
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
              <span class="text-xs font-bold">{{ info.label }}</span>
              <div v-if="settingsStore.currentPromptMode === info.mode" class="w-2 h-2 rounded-full bg-primary" />
            </div>
            <p class="text-[10px] text-muted-foreground leading-tight">{{ info.description }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

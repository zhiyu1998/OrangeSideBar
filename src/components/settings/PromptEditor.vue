<script setup lang="ts">
import { ref, computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { PromptMode } from '@/types/settings'

const settingsStore = useSettingsStore()

const activeTab = ref<PromptMode>('default')

interface PromptInfo {
  mode: PromptMode
  label: string
  description: string
}

const promptModes: PromptInfo[] = [
  {
    mode: 'default',
    label: 'Default',
    description: 'General-purpose system prompt for everyday conversations.',
  },
  {
    mode: 'paper',
    label: 'Paper',
    description: 'Optimized for academic paper analysis and summarization.',
  },
  {
    mode: 'learning',
    label: 'Learning',
    description: 'Interactive Socratic tutoring mode for learning.',
  },
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
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>System Prompts</CardTitle>
        <CardDescription>
          Customize the system prompts for different modes. These prompts define how the AI assistant behaves.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid w-full grid-cols-3 mb-4">
            <TabsTrigger
              v-for="info in promptModes"
              :key="info.mode"
              :value="info.mode"
            >
              {{ info.label }}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="info in promptModes"
            :key="info.mode"
            :value="info.mode"
            class="space-y-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <Label>{{ info.label }} Mode</Label>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ info.description }}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                @click="resetPrompt(info.mode)"
              >
                <RotateCcw class="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            <Textarea
              :value="prompts[info.mode]"
              :placeholder="`Enter ${info.label.toLowerCase()} system prompt...`"
              class="min-h-[300px] font-mono text-sm"
              @input="(e: Event) => updatePrompt(info.mode, (e.target as HTMLTextAreaElement).value)"
            />

            <div class="flex justify-between items-center text-xs text-muted-foreground">
              <span>{{ getCharCount(info.mode).toLocaleString() }} characters</span>
              <span>Tip: Use clear, specific instructions for better results.</span>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Prompt Mode Selection</CardTitle>
        <CardDescription>
          Choose the default prompt mode for the sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex gap-2">
          <Button
            v-for="info in promptModes"
            :key="info.mode"
            :variant="settingsStore.currentPromptMode === info.mode ? 'default' : 'outline'"
            size="sm"
            @click="settingsStore.setPromptMode(info.mode)"
          >
            {{ info.label }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          Current mode: <strong>{{ promptModes.find(p => p.mode === settingsStore.currentPromptMode)?.label }}</strong>
        </p>
      </CardContent>
    </Card>
  </div>
</template>

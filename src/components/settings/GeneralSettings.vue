<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Theme } from '@/types/settings'
import type { OpenAIRequestMode } from '@/types/provider'

const settingsStore = useSettingsStore()

function handleThemeChange(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setTheme(value as Theme)
  }
}

function handleOpenAIRequestModeChange(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setOpenAIRequestMode(value as OpenAIRequestMode)
  }
}
</script>

<template>
  <div class="space-y-12">
    <!-- Theme Selection -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">Appearance</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Customize how OrangeSideBar looks on your screen. Choose between light, dark, or follow your system settings.
        </p>
      </div>
      
      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-sm font-semibold">Interface Theme</Label>
              <p class="text-[10px] text-muted-foreground">Select your preferred color scheme</p>
            </div>
            <Select :model-value="settingsStore.theme" @update:model-value="handleThemeChange">
              <SelectTrigger class="w-[180px] bg-background/50">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    <!-- OpenAI Request API -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">OpenAI Request API</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Choose which API style OpenAI-compatible providers use for chat requests.
        </p>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between gap-6">
            <div class="space-y-0.5 min-w-0">
              <Label class="text-sm font-semibold">Request Mode</Label>
              <p class="text-[10px] text-muted-foreground">
                Applies to OpenAI-compatible providers. Third-party support depends on their /responses endpoint compatibility.
              </p>
            </div>
            <Select :model-value="settingsStore.openAIRequestMode" @update:model-value="handleOpenAIRequestModeChange">
              <SelectTrigger class="w-[190px] bg-background/50 flex-shrink-0">
                <SelectValue placeholder="Select API" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat_completions">Chat Completions</SelectItem>
                <SelectItem value="responses">Responses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    <!-- Language & Region (Placeholder for future) -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">System Status</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Monitor your extension's connectivity and performance.
        </p>
      </div>
      
      <div class="lg:col-span-2 space-y-4">
        <div class="bg-muted/20 border rounded-2xl p-6">
          <div class="flex items-center justify-between opacity-50 outline-dotted outline-1 outline-muted rounded-lg p-4">
            <span class="text-xs font-medium italic">Developer Mode and advanced statistics coming soon...</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

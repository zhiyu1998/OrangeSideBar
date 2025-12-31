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

const settingsStore = useSettingsStore()

function handleThemeChange(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setTheme(value as Theme)
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

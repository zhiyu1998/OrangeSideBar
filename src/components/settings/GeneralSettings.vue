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
import type { Theme, Language } from '@/types/settings'
import type { OpenAIRequestMode } from '@/types/provider'

const settingsStore = useSettingsStore()

function handleThemeChange(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setTheme(value as Theme)
  }
}

function handleLanguageChange(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string') {
    settingsStore.setLanguage(value as Language)
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
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.general.appearance') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.general.appearanceDesc') }}
        </p>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-sm font-semibold">{{ $t('settings.general.interfaceTheme') }}</Label>
              <p class="text-[10px] text-muted-foreground">{{ $t('settings.general.interfaceThemeHint') }}</p>
            </div>
            <Select :model-value="settingsStore.theme" @update:model-value="handleThemeChange">
              <SelectTrigger class="w-[180px] bg-background/50">
                <SelectValue :placeholder="$t('settings.general.selectTheme')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{{ $t('settings.general.themeLight') }}</SelectItem>
                <SelectItem value="dark">{{ $t('settings.general.themeDark') }}</SelectItem>
                <SelectItem value="system">{{ $t('settings.general.themeSystem') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-sm font-semibold">{{ $t('settings.general.language') }}</Label>
              <p class="text-[10px] text-muted-foreground">{{ $t('settings.general.languageHint') }}</p>
            </div>
            <Select :model-value="settingsStore.language" @update:model-value="handleLanguageChange">
              <SelectTrigger class="w-[180px] bg-background/50">
                <SelectValue :placeholder="$t('settings.general.selectLanguage')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{{ $t('settings.general.languageAuto') }}</SelectItem>
                <SelectItem value="en">{{ $t('settings.general.languageEn') }}</SelectItem>
                <SelectItem value="zh-CN">{{ $t('settings.general.languageZh') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    <!-- OpenAI Request API -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.general.openaiRequestApi') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.general.openaiRequestApiDesc') }}
        </p>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between gap-6">
            <div class="space-y-0.5 min-w-0">
              <Label class="text-sm font-semibold">{{ $t('settings.general.requestMode') }}</Label>
              <p class="text-[10px] text-muted-foreground">
                {{ $t('settings.general.requestModeDesc') }}
              </p>
            </div>
            <Select :model-value="settingsStore.openAIRequestMode" @update:model-value="handleOpenAIRequestModeChange">
              <SelectTrigger class="w-[190px] bg-background/50 flex-shrink-0">
                <SelectValue :placeholder="$t('settings.general.selectApi')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat_completions">{{ $t('settings.general.chatCompletions') }}</SelectItem>
                <SelectItem value="responses">{{ $t('settings.general.responses') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    <!-- System Status -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.general.systemStatus') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.general.systemStatusDesc') }}
        </p>
      </div>

      <div class="lg:col-span-2 space-y-4">
        <div class="bg-muted/20 border rounded-2xl p-6">
          <div class="flex items-center justify-between opacity-50 outline-dotted outline-1 outline-muted rounded-lg p-4">
            <span class="text-xs font-medium italic">{{ $t('settings.general.comingSoonStats') }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

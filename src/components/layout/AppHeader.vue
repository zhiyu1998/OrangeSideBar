<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Settings, Moon, Sun, Monitor, Trash2 } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  hasMessages?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  clear: []
}>()

const settingsStore = useSettingsStore()

function openSettings() {
  chrome.runtime.openOptionsPage()
}

function setTheme(theme: 'light' | 'dark' | 'system') {
  settingsStore.setTheme(theme)
}

function handleClear() {
  emit('clear')
}
</script>

<template>
  <header class="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
    <div class="flex items-center gap-2">
      <img src="/logo_48.png" class="w-7 h-7" alt="OrangeSideBar">
      <h1 class="text-base font-semibold tracking-tight">OrangeSideBar</h1>
    </div>

    <div class="flex items-center gap-1">
      <!-- Clear Conversation -->
      <Button
        v-if="hasMessages"
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Clear conversation"
        @click="handleClear"
      >
        <Trash2 class="h-4 w-4" />
      </Button>

      <!-- Theme Toggle -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="h-8 w-8">
            <Sun v-if="settingsStore.theme === 'light'" class="h-4 w-4" />
            <Moon v-else-if="settingsStore.theme === 'dark'" class="h-4 w-4" />
            <Monitor v-else class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="setTheme('light')">
            <Sun class="mr-2 h-4 w-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem @click="setTheme('dark')">
            <Moon class="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem @click="setTheme('system')">
            <Monitor class="mr-2 h-4 w-4" />
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Settings -->
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="openSettings">
        <Settings class="h-4 w-4" />
      </Button>
    </div>
  </header>
</template>

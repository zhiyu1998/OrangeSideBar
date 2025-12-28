<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/types/settings'

const settingsStore = useSettingsStore()

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const currentTheme = computed(() => settingsStore.theme)

function setTheme(theme: Theme) {
  settingsStore.setTheme(theme)
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the appearance of the application.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Theme</Label>
          <div class="flex gap-2">
            <Button
              v-for="option in themeOptions"
              :key="option.value"
              :variant="currentTheme === option.value ? 'default' : 'outline'"
              size="sm"
              class="flex-1"
              @click="setTheme(option.value)"
            >
              <component :is="option.icon" class="mr-2 h-4 w-4" />
              {{ option.label }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
        <CardDescription>
          OrangeSideBar - 网页总结助手
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="text-sm text-muted-foreground">
          <p class="mb-2">
            大橘侧边栏：一个开源的网页侧边栏 AI 对话总结工具
          </p>
          <p>
            支持 OpenAI、Gemini、Anthropic 规范的 API，支持自动摘要、联网搜索、多轮对话、视频字幕总结、知识库对话、论文模式等功能
          </p>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            as="a"
            href="https://github.com/zhiyu1998/OrangeSideBar"
            target="_blank"
          >
            GitHub
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-background">
    <!-- Header -->
    <header class="flex items-center justify-between p-4 border-b">
      <div class="flex items-center gap-2">
        <img src="/logo_48.png" class="w-8 h-8" alt="OrangeSideBar">
        <h1 class="text-lg font-semibold">OrangeSideBar</h1>
      </div>
      <Button variant="ghost" size="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </Button>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto p-4">
      <Card class="mb-4">
        <CardHeader>
          <CardTitle>Welcome to OrangeSideBar 2.0</CardTitle>
          <CardDescription>
            AI-powered sidebar for webpage summarization and interaction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">
            Phase 1 setup complete. The following features are being built:
          </p>
          <ul class="mt-2 text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li>LLM Provider Integration (OpenAI, Anthropic)</li>
            <li>Chat Interface with Markdown Support</li>
            <li>Content Extraction (Web, PDF, YouTube)</li>
            <li>Dual Column Comparison Mode</li>
          </ul>
        </CardContent>
      </Card>

      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" class="h-auto py-3 flex-col gap-1">
          <span class="text-lg">📝</span>
          <span class="text-xs">Summary</span>
        </Button>
        <Button variant="outline" class="h-auto py-3 flex-col gap-1">
          <span class="text-lg">🌐</span>
          <span class="text-xs">Translate</span>
        </Button>
        <Button variant="outline" class="h-auto py-3 flex-col gap-1">
          <span class="text-lg">📄</span>
          <span class="text-xs">PDF</span>
        </Button>
        <Button variant="outline" class="h-auto py-3 flex-col gap-1">
          <span class="text-lg">🎬</span>
          <span class="text-xs">Subtitles</span>
        </Button>
      </div>
    </main>

    <!-- Input Area -->
    <footer class="border-t p-4">
      <div class="flex gap-2">
        <input
          type="text"
          placeholder="Ask anything..."
          class="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
        <Button>Send</Button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
</style>

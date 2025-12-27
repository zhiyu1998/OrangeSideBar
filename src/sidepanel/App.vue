<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChat } from '@/composables/useChat'
import { AppHeader, FeatureGrid } from '@/components/layout'
import { MessageList, InputGroup } from '@/components/chat'

const settingsStore = useSettingsStore()
const { sendMessage, stopStreaming, isStreaming, messages } = useChat()

// Feature handlers
function handleSummary() {
  // TODO: Implement content extraction and summary
  sendMessage('Please summarize the current page content.')
}

function handleTranslate() {
  // TODO: Implement translation feature
  sendMessage('Please translate the following content to English:')
}

function handlePdf() {
  // TODO: Implement PDF analysis
  sendMessage('Please analyze the PDF document.')
}

function handleSubtitles() {
  // TODO: Implement YouTube subtitle extraction
  sendMessage('Please extract and process the video subtitles.')
}

function handleSend(content: string, images?: string[]) {
  sendMessage(content, images)
}

function handleStop() {
  stopStreaming()
}

function handleCopy(content: string) {
  navigator.clipboard.writeText(content)
}

function handleRegenerate() {
  // TODO: Implement regenerate
}

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-background">
    <!-- Header -->
    <AppHeader />

    <!-- Feature Grid -->
    <FeatureGrid
      @summary="handleSummary"
      @translate="handleTranslate"
      @pdf="handlePdf"
      @subtitles="handleSubtitles"
    />

    <!-- Separator -->
    <div class="h-px bg-border" />

    <!-- Messages -->
    <MessageList
      :messages="messages"
      :is-streaming="isStreaming"
      class="flex-1"
      @copy="handleCopy"
      @regenerate="handleRegenerate"
    />

    <!-- Input -->
    <InputGroup
      :is-streaming="isStreaming"
      @send="handleSend"
      @stop="handleStop"
    />
  </div>
</template>

<style scoped>
</style>

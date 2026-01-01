<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChat } from '@/composables/useChat'
import { useContent } from '@/composables/useContent'
import { AppHeader, FeatureGrid } from '@/components/layout'
import { MessageList, InputGroup } from '@/components/chat'
import { SUMMARY_PROMPT, YOUTUBE_SUBTITLE_SUMMARY_PROMPT, BILIBILI_SUBTITLE_SUMMARY_PROMPT } from '@/constants/prompts'

const settingsStore = useSettingsStore()
const { sendMessage, stopStreaming, clearConversation, regenerate, isStreaming, messages } = useChat()
const { extractCurrentTabText, extractSubtitles, getCurrentUrl, isLoading: isContentLoading, error: contentError } = useContent()

// Feature handlers
async function handleSummary() {
  const content = await extractCurrentTabText()
  if (content) {
    // Truncate if too long (e.g., 15000 chars)
    const truncatedContent = content.length > 15000
      ? content.slice(0, 15000) + '\n\n[Content truncated...]'
      : content
    // Use SUMMARY_PROMPT from constants
    const llmContent = `${SUMMARY_PROMPT}${truncatedContent}`
    const displayContent = `请帮我总结当前网页内容 [已提取 ${truncatedContent.length.toLocaleString()} 字符]`
    sendMessage(displayContent, undefined, llmContent)
  } else {
    sendMessage(`无法提取页面内容${contentError.value ? `：${contentError.value}` : '，请确保页面已完全加载。'}`)
  }
}

async function handleTranslate() {
  const content = await extractCurrentTabText()
  if (content) {
    const truncatedContent = content.length > 15000
      ? content.slice(0, 15000) + '\n\n[Content truncated...]'
      : content
    const llmContent = `请将以下内容翻译成中文：\n\n${truncatedContent}`
    const displayContent = `请将当前网页内容翻译成中文 [已提取 ${truncatedContent.length.toLocaleString()} 字符]`
    sendMessage(displayContent, undefined, llmContent)
  } else {
    sendMessage(`无法提取页面内容${contentError.value ? `：${contentError.value}` : '，请确保页面已完全加载。'}`)
  }
}

async function handlePdf() {
  const content = await extractCurrentTabText()
  if (content) {
    const truncatedContent = content.length > 20000
      ? content.slice(0, 20000) + '\n\n[Content truncated...]'
      : content
    const llmContent = `请帮我分析以下 PDF 文档内容：\n\n${truncatedContent}`
    const displayContent = `请帮我分析 PDF 文档 [已提取 ${truncatedContent.length.toLocaleString()} 字符]`
    sendMessage(displayContent, undefined, llmContent)
  } else {
    sendMessage(`无法提取 PDF 内容${contentError.value ? `：${contentError.value}` : '，请确保 PDF 已加载。'}`)
  }
}

async function handleSubtitles() {
  const subtitles = await extractSubtitles('text_with_timestamps')
  if (subtitles) {
    const truncatedSubtitles = subtitles.length > 20000
      ? subtitles.slice(0, 20000) + '\n\n[Subtitles truncated...]'
      : subtitles

    // Detect platform and use appropriate prompt
    const url = await getCurrentUrl()
    const isBilibili = url?.includes('bilibili.com')
    const subtitlePrompt = isBilibili
      ? BILIBILI_SUBTITLE_SUMMARY_PROMPT
      : YOUTUBE_SUBTITLE_SUMMARY_PROMPT

    const llmContent = `${subtitlePrompt}${truncatedSubtitles}`
    const platformName = isBilibili ? 'Bilibili' : 'YouTube'
    const displayContent = `请帮我总结 ${platformName} 视频字幕 [已提取 ${truncatedSubtitles.length.toLocaleString()} 字符]`
    sendMessage(displayContent, undefined, llmContent)
  } else {
    sendMessage(`无法提取字幕${contentError.value ? `：${contentError.value}` : '，请确保视频正在播放或已开启字幕。'}`)
  }
}

function handleSend(content: string, images?: string[]) {
  sendMessage(content, images)
}

function handleStop() {
  stopStreaming()
}

function handleCopy(content: string) {
  navigator.clipboard.writeText(content).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  })
}

function handleRegenerate(messageId: string) {
  regenerate(messageId)
}

function handleClearConversation() {
  clearConversation()
}

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-background overflow-hidden">
    <!-- Header -->
    <AppHeader
      :has-messages="messages.length > 0"
      @clear="handleClearConversation"
    />

    <!-- Feature Grid -->
    <FeatureGrid
      :loading="isContentLoading"
      :disabled="isStreaming"
      :collapsed="messages.length > 0"
      @summary="handleSummary"
      @translate="handleTranslate"
      @pdf="handlePdf"
      @subtitles="handleSubtitles"
    />

    <!-- Separator -->
    <div class="h-px bg-border flex-shrink-0" />

    <!-- Messages -->
    <MessageList
      :messages="messages"
      :is-streaming="isStreaming"
      class="flex-1 min-h-0"
      @copy="handleCopy"
      @regenerate="handleRegenerate"
    />

    <!-- Input -->
    <InputGroup
      :is-streaming="isStreaming"
      class="flex-shrink-0"
      @send="handleSend"
      @stop="handleStop"
    />
  </div>
</template>

<style scoped>
</style>

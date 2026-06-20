<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { useChat } from '@/composables/useChat'
import { useContent } from '@/composables/useContent'
import type { ExtractedContent } from '@/lib/content/types'
import { AppHeader, FeatureGrid, SessionHistoryPanel } from '@/components/layout'
import { MessageList, InputGroup } from '@/components/chat'
import ShareImageDialog from '@/components/share/ShareImageDialog.vue'
import {
  SUMMARY_PROMPT,
  LINUX_DO_SUMMARY_PROMPT,
  YOUTUBE_SUBTITLE_SUMMARY_PROMPT,
  BILIBILI_SUBTITLE_SUMMARY_PROMPT,
} from '@/constants/prompts'

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const { sendMessage, stopStreaming, clearConversation, regenerate, isStreaming, messages } = useChat()
const {
  extractCurrentTab,
  extractCurrentTabText,
  extractCurrentTabMarkdown,
  extractLinuxDoThreadText,
  extractSubtitles,
  getCurrentUrl,
  isLoading: isContentLoading,
  error: contentError,
} = useContent()

const shareOpen = ref(false)
const sharePageTitle = ref<string>('')
const sharePageUrl = ref<string>('')
const historyOpen = ref(false)
const actionNotice = ref<{ type: 'success' | 'error'; text: string } | null>(null)
let actionNoticeTimer: number | null = null

const sortedSessions = computed(() => chatStore.sortedSessions)

function formatSummaryContext(extracted: ExtractedContent): string {
  const metadataLines = [
    ['title', extracted.title],
    ['author', extracted.author || extracted.byline],
    ['site', extracted.siteName],
    ['published', extracted.published],
    ['source', extracted.url],
    ['domain', extracted.domain],
    ['language', extracted.language],
    ['description', extracted.description || extracted.excerpt],
    ['word_count', extracted.wordCount?.toString()],
  ].filter(([, value]) => value)

  const frontmatter = metadataLines.length > 0
    ? `---\n${metadataLines.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n`
    : ''

  return `${frontmatter}${extracted.textContent}`.trim()
}

async function copyToClipboard(content: string) {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
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
  }
}

function showActionNotice(type: 'success' | 'error', text: string) {
  actionNotice.value = { type, text }

  if (actionNoticeTimer !== null) {
    window.clearTimeout(actionNoticeTimer)
  }

  actionNoticeTimer = window.setTimeout(() => {
    actionNotice.value = null
    actionNoticeTimer = null
  }, 2400)
}

// Feature handlers
async function handleSummary() {
  const url = await getCurrentUrl()
  const isLinuxDoThread = (() => {
    if (!url) return false
    try {
      const { hostname, pathname } = new URL(url)
      const isLinuxDoHost = hostname === 'linux.do' || hostname.endsWith('.linux.do')
      if (!isLinuxDoHost) return false
      return (
        /\/topic\/\d+/.test(pathname) ||
        /\/t\/[^/]+\/\d+/.test(pathname) ||
        /\/t\/\d+/.test(pathname)
      )
    } catch {
      return false
    }
  })()

  const extracted = isLinuxDoThread
    ? null
    : await extractCurrentTab()
  const content = isLinuxDoThread
    ? await extractLinuxDoThreadText({ maxPosts: 40, headPosts: 15, maxPostChars: 1200 })
    : extracted
      ? formatSummaryContext(extracted)
      : await extractCurrentTabText()
  if (content) {
    const truncatedContent = content.length > 15000
      ? content.slice(0, 15000) + '\n\n[Content truncated...]'
      : content
    const prompt = isLinuxDoThread ? LINUX_DO_SUMMARY_PROMPT : SUMMARY_PROMPT
    const llmContent = `${prompt}${truncatedContent}`
    const displayContent = isLinuxDoThread
      ? `请帮我总结当前 Linux.do 帖子 [已提取 ${truncatedContent.length.toLocaleString()} 字符]`
      : `请帮我总结当前网页内容 [已提取 ${truncatedContent.length.toLocaleString()} 字符]`
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

    const url = await getCurrentUrl()
    const isBilibili = url?.includes('bilibili.com')
    const subtitlePrompt = isBilibili
      ? BILIBILI_SUBTITLE_SUMMARY_PROMPT
      : YOUTUBE_SUBTITLE_SUMMARY_PROMPT

    const llmContent = `${subtitlePrompt}${truncatedSubtitles}`
    const platformName = isBilibili ? 'Bilibili' : 'YouTube'
    const displayContent = `请帮我总结 ${platformName}视频字幕 [已提取 ${truncatedSubtitles.length.toLocaleString()} 字符]`
    sendMessage(displayContent, undefined, llmContent)
  } else {
    sendMessage(`无法提取字幕${contentError.value ? `：${contentError.value}` : '，请确保视频正在播放或已开启字幕。'}`)
  }
}

async function handleMarkdown() {
  const markdown = await extractCurrentTabMarkdown()
  if (markdown) {
    await copyToClipboard(markdown)
    showActionNotice('success', `Markdown copied to clipboard · ${markdown.length.toLocaleString()} chars`)
  } else {
    showActionNotice(
      'error',
      `Failed to extract Markdown${contentError.value ? `: ${contentError.value}` : '. Please refresh the page and try again.'}`
    )
  }
}

interface SelectedTab {
  type: 'all' | 'single'
  tabId?: number
  tabTitle?: string
}

async function handleSend(content: string, images?: string[], selectedTabs?: SelectedTab[]) {
  let llmContent = undefined
  
  if (selectedTabs && selectedTabs.length > 0) {
    let combinedContent = ''
    let tabsToProcess: { id?: number; title: string }[] = []

    if (selectedTabs[0].type === 'all') {
      const allTabs = await chrome.tabs.query({ currentWindow: true })
      tabsToProcess = allTabs.map(t => ({ id: t.id, title: t.title || 'Untitled' }))
    } else {
      tabsToProcess = selectedTabs.map(t => ({ id: t.tabId, title: t.tabTitle || 'Untitled' }))
    }

    // Extract content from each tab sequentially
    for (const tab of tabsToProcess) {
      if (tab.id) {
        try {
          const [{ result: text }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return document.body.innerText || ''
            }
          })
          
          if (text) {
            const truncated = text.length > 8000 
              ? text.slice(0, 8000) + '... [Tab content truncated]' 
              : text
            combinedContent += `\n\n--- Content from Tab: ${tab.title} ---\n${truncated}\n`
          }
        } catch (err) {
          console.warn(`Could not extract content from tab ${tab.id}:`, err)
          combinedContent += `\n\n--- Could not extract content from Tab: ${tab.title} ---\n`
        }
      }
    }

    if (combinedContent) {
      llmContent = `${content}\n\n[Context from ${tabsToProcess.length} tabs]:\n${combinedContent}`
      const displayContent = `${content} [Context: ${tabsToProcess.length} tabs]`
      
      // Send the message with full context
      await sendMessage(displayContent, images, llmContent)
      
      // Cleanup: Find that user message and clear its voluminous llmContent 
      // so subsequent turns don't carry the dead weight.
      // Note: messages is computed from chatStore.currentMessages
      const lastUserMsg = [...messages.value].reverse().find(m => m.role === 'user')
      if (lastUserMsg && lastUserMsg.llmContent) {
        const { useChatStore } = await import('@/stores/chat')
        const chatStore = useChatStore()
        chatStore.updateMessage(lastUserMsg.id, { 
          llmContent: `${content}\n\n[Tab context used once]` 
        })
      }
      return
    }
  }

  sendMessage(content, images)
}

function handleStop() {
  stopStreaming()
}

function handleCopy(content: string) {
  void copyToClipboard(content)
}

function handleRegenerate(messageId: string) {
  regenerate(messageId)
}

function handleClearConversation() {
  clearConversation()
}

function handleSelectSession(sessionId: string) {
  if (chatStore.isStreaming) {
    stopStreaming()
  }
  chatStore.selectSession(sessionId)
  historyOpen.value = false
}

function handleDeleteSession(sessionId: string) {
  if (chatStore.currentSessionId === sessionId && chatStore.isStreaming) {
    stopStreaming()
  }
  chatStore.deleteSession(sessionId)
}

function handleNewChat() {
  if (chatStore.isStreaming) {
    stopStreaming()
  }
  chatStore.createSession(settingsStore.defaultModel)
  historyOpen.value = false
}

function handleToggleHistory() {
  historyOpen.value = !historyOpen.value
}

async function handleShareConversation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    sharePageTitle.value = tab?.title || 'Untitled'
    sharePageUrl.value = tab?.url || ''
  } catch {
    sharePageTitle.value = 'Untitled'
    sharePageUrl.value = ''
  } finally {
    shareOpen.value = true
  }
}

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <div class="relative flex flex-col h-screen bg-background overflow-hidden">
    <!-- Header -->
    <AppHeader
      :has-messages="messages.length > 0"
      :history-open="historyOpen"
      @clear="handleClearConversation"
      @share="handleShareConversation"
      @new-chat="handleNewChat"
      @toggle-history="handleToggleHistory"
    />

    <ShareImageDialog
      :open="shareOpen"
      :messages="messages"
      :page-title="sharePageTitle"
      :page-url="sharePageUrl"
      @update:open="(val) => (shareOpen = val)"
    />

    <div
      v-if="historyOpen"
      class="absolute right-3 top-[4.25rem] z-30 w-[min(24rem,calc(100%-1.5rem))]"
    >
      <SessionHistoryPanel
        class="shadow-2xl"
        :sessions="sortedSessions"
        :current-session-id="chatStore.currentSessionId"
        :disabled="isStreaming"
        @select="handleSelectSession"
        @create="handleNewChat"
        @delete="handleDeleteSession"
      />
    </div>

    <button
      v-if="historyOpen"
      class="absolute inset-x-0 bottom-0 top-[4rem] z-20 bg-transparent"
      aria-label="Close history"
      @click="historyOpen = false"
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
      @markdown="handleMarkdown"
    />

    <div
      v-if="actionNotice"
      class="pointer-events-none absolute left-1/2 top-[4.5rem] z-40 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      :class="actionNotice.type === 'success'
        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : 'border border-destructive/30 bg-destructive/10 text-destructive'"
    >
      {{ actionNotice.text }}
    </div>

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

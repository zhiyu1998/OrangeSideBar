import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message, ChatSession, DualColumnState, LayoutMode } from '@/types/chat'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const useChatStore = defineStore('chat', () => {
  // State
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const layoutMode = ref<LayoutMode>('single')
  const dualColumnState = ref<DualColumnState>({
    leftSessionId: null,
    rightSessionId: null,
    leftModelId: 'gpt-4o-mini',
    rightModelId: 'claude-3-5-sonnet-20241022',
  })

  // Getters
  const currentSession = computed(() =>
    sessions.value.find((s) => s.id === currentSessionId.value)
  )

  const currentMessages = computed(() => currentSession.value?.messages || [])

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)
  )

  const hasActiveSession = computed(() => currentSessionId.value !== null)

  function deriveSessionTitleFromMessage(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return `New Chat ${sessions.value.length + 1}`
    }

    return normalized.length > 32 ? `${normalized.slice(0, 32)}...` : normalized
  }

  // Actions
  function createSession(modelId: string, title?: string): ChatSession {
    const session: ChatSession = {
      id: generateId(),
      title: title || `New Chat ${sessions.value.length + 1}`,
      modelId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sessions.value.unshift(session)
    currentSessionId.value = session.id
    return session
  }

  function selectSession(sessionId: string) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      currentSessionId.value = sessionId
    }
  }

  function deleteSession(sessionId: string) {
    const index = sessions.value.findIndex((s) => s.id === sessionId)
    if (index !== -1) {
      sessions.value.splice(index, 1)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = sessions.value[0]?.id || null
      }
    }
  }

  function addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    if (!currentSession.value) {
      throw new Error('No active session')
    }

    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    }

    currentSession.value.messages.push(newMessage)

    if (message.role === 'user' && currentSession.value.messages.length === 1) {
      currentSession.value.title = deriveSessionTitleFromMessage(message.content)
    }

    currentSession.value.updatedAt = Date.now()

    return newMessage
  }

  function updateMessage(messageId: string, updates: Partial<Message>) {
    if (!currentSession.value) return

    const message = currentSession.value.messages.find((m) => m.id === messageId)
    if (message) {
      Object.assign(message, updates)
      currentSession.value.updatedAt = Date.now()
    }
  }

  function appendToMessage(messageId: string, content: string) {
    if (!currentSession.value) return

    const message = currentSession.value.messages.find((m) => m.id === messageId)
    if (message) {
      message.content += content
      currentSession.value.updatedAt = Date.now()
    }
  }

  function appendThinkingToMessage(messageId: string, content: string) {
    if (!currentSession.value) return

    const message = currentSession.value.messages.find((m) => m.id === messageId)
    if (message) {
      message.thinking = `${message.thinking || ''}${content}`
      currentSession.value.updatedAt = Date.now()
    }
  }

  function deleteMessage(messageId: string) {
    if (!currentSession.value) return

    const index = currentSession.value.messages.findIndex((m) => m.id === messageId)
    if (index !== -1) {
      currentSession.value.messages.splice(index, 1)
      currentSession.value.updatedAt = Date.now()
    }
  }

  function removeMessagesAfter(messageId: string) {
    if (!currentSession.value) return

    const index = currentSession.value.messages.findIndex((m) => m.id === messageId)
    if (index === -1) return

    const keepCount = index + 1
    if (currentSession.value.messages.length > keepCount) {
      currentSession.value.messages.splice(keepCount)
      currentSession.value.updatedAt = Date.now()
    }
  }

  function clearCurrentSession() {
    if (currentSession.value) {
      currentSession.value.messages = []
      currentSession.value.updatedAt = Date.now()
    }
  }

  function setStreaming(value: boolean) {
    isStreaming.value = value
  }

  function setAbortController(controller: AbortController | null) {
    abortController.value = controller
  }

  function stopStreaming() {
    // Always reset streaming state first
    isStreaming.value = false

    // Try to abort, but don't fail if controller is invalid
    if (abortController.value) {
      try {
        if (typeof abortController.value.abort === 'function') {
          abortController.value.abort()
        }
      } catch (error) {
        console.warn('[chat store] Failed to abort:', error)
      }
      abortController.value = null
    }
  }

  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
  }

  function updateDualColumnState(updates: Partial<DualColumnState>) {
    Object.assign(dualColumnState.value, updates)
  }

  return {
    // State
    sessions,
    currentSessionId,
    isStreaming,
    abortController,
    layoutMode,
    dualColumnState,
    // Getters
    currentSession,
    currentMessages,
    sortedSessions,
    hasActiveSession,
    // Actions
    createSession,
    selectSession,
    deleteSession,
    addMessage,
    updateMessage,
    appendToMessage,
    appendThinkingToMessage,
    deleteMessage,
    removeMessagesAfter,
    clearCurrentSession,
    setStreaming,
    setAbortController,
    stopStreaming,
    setLayoutMode,
    updateDualColumnState,
  }
})

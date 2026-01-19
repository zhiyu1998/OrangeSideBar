/**
 * useChat Composable
 * Provides chat functionality with LLM providers
 */

import { ref, computed } from 'vue'
import { llmFactory } from '@/lib/llm/factory'
import type { ChatMessage, ContentPart, StreamChunk } from '@/lib/llm/types'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { getSystemPrompt } from '@/constants/prompts'
import type { ProviderId } from '@/types/provider'

export interface UseChatOptions {
  modelId?: string
  sessionId?: string
}

export function useChat(options: UseChatOptions = {}) {
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()

  // Local state
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentThinking = ref<string>('')

  // Computed
  const modelId = computed(() => options.modelId || settingsStore.defaultModel)
  const isStreaming = computed(() => chatStore.isStreaming)
  const messages = computed(() => chatStore.currentMessages)

  /**
   * Configure provider with current settings
   */
  function configureProvider(providerId: ProviderId) {
    const config = settingsStore.getProviderConfig(providerId)
    if (config && config.apiKey) {
      llmFactory.configureProvider(providerId, {
        apiKey: settingsStore.getApiKey(providerId),
        baseUrl: config.baseUrl,
      }, settingsStore.getProviderApiSpec(providerId))
    }
  }

  /**
   * Resolve provider for a model ID.
   * Prefer the provider captured in the cached model list (supports OpenAI-compatible 3rd-party models
   * whose IDs don't match our prefix mapping), then fallback to prefix-based detection.
   */
  function resolveProviderForModel(model: string) {
    // Find provider from cached model lists (including disabled providers)
    for (const [providerId, models] of Object.entries(settingsStore.cachedModels) as Array<
      [ProviderId, { id: string }[]]
    >) {
      if (!models?.some((m) => m.id === model)) continue

      const config = settingsStore.getProviderConfig(providerId)
      if (!config.enabled) {
        return null
      }

      configureProvider(providerId)
      return llmFactory.getProvider(providerId) ?? llmFactory.getProviderForModel(model)
    }

    const detected = llmFactory.getProviderForModel(model)
    if (detected) {
      const config = settingsStore.getProviderConfig(detected.providerId)
      if (!config.enabled) {
        return null
      }
      configureProvider(detected.providerId)
    }
    return detected
  }

  function getDisabledProviderForModel(model: string): ProviderId | null {
    for (const [providerId, models] of Object.entries(settingsStore.cachedModels) as Array<
      [ProviderId, { id: string }[]]
    >) {
      if (!models?.some((m) => m.id === model)) continue
      if (!settingsStore.getProviderConfig(providerId).enabled) return providerId
    }

    const detected = llmFactory.getProviderForModel(model)
    if (detected && !settingsStore.getProviderConfig(detected.providerId).enabled) {
      return detected.providerId
    }

    return null
  }

  function parseImageDataUrl(
    dataUrl: string
  ): { mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } | null {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl)
    if (!match) return null
    const rawMediaType = match[1].toLowerCase()
    const data = match[2]

    const mediaType = rawMediaType === 'image/jpg' ? 'image/jpeg' : rawMediaType
    if (
      mediaType !== 'image/jpeg' &&
      mediaType !== 'image/png' &&
      mediaType !== 'image/gif' &&
      mediaType !== 'image/webp'
    ) {
      return null
    }

    return { mediaType, data }
  }

  function buildApiMessages(excludeMessageId: string): ChatMessage[] {
    return messages.value
      .filter((m) => m.id !== excludeMessageId)
      .map((m) => {
        const text = m.llmContent || m.content

        if (m.role === 'user' && m.images && m.images.length > 0) {
          const parts: ContentPart[] = []

          if (text) {
            parts.push({ type: 'text', text })
          }

          for (const img of m.images) {
            const parsed = parseImageDataUrl(img)
            if (!parsed) continue
            parts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: parsed.mediaType,
                data: parsed.data,
              },
            })
          }

          if (parts.length > 0) {
            return {
              role: 'user' as const,
              content: parts,
            }
          }
        }

        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: text,
        }
      })
  }

  async function streamAssistantResponse(assistantMessageId: string): Promise<void> {
    // Get provider for the model
    const provider = resolveProviderForModel(modelId.value)

    if (!provider) {
      const disabledProvider = getDisabledProviderForModel(modelId.value)
      error.value = disabledProvider
        ? `Provider "${disabledProvider}" is disabled. Please enable it in settings or choose another model.`
        : `No provider found for model: ${modelId.value}`
      chatStore.updateMessage(assistantMessageId, { error: error.value })
      return
    }

    if (!provider.isConfigured()) {
      error.value = `Provider "${provider.providerName}" is not configured. Please set API key in settings.`
      chatStore.updateMessage(assistantMessageId, { error: error.value })
      return
    }

    const apiMessages = buildApiMessages(assistantMessageId)

    // Create abort controller
    const abortController = new AbortController()
    chatStore.setAbortController(abortController)
    chatStore.setStreaming(true)
    isLoading.value = true

    try {
      // Get system prompt
      const systemPrompt = getSystemPrompt(settingsStore.currentSystemPrompt)

      // Stream response
      const stream = provider.chatStream({
        model: modelId.value,
        messages: apiMessages,
        systemPrompt,
        temperature: settingsStore.modelParameters.temperature,
        topP: settingsStore.modelParameters.topP,
        maxTokens: settingsStore.modelParameters.maxTokens,
        frequencyPenalty: settingsStore.modelParameters.frequencyPenalty,
        presencePenalty: settingsStore.modelParameters.presencePenalty,
        signal: abortController.signal,
      })

      for await (const chunk of stream) {
        // Check if streaming was aborted
        if (!chatStore.isStreaming) {
          break
        }
        handleStreamChunk(chunk, assistantMessageId)
      }
    } catch (err) {
      console.error('[useChat] Stream error:', err)
      if (err instanceof Error) {
        if (err.name !== 'AbortError') {
          error.value = err.message
          chatStore.updateMessage(assistantMessageId, { error: err.message })
        }
      } else {
        error.value = 'Unknown error occurred'
        chatStore.updateMessage(assistantMessageId, { error: 'Unknown error occurred' })
      }
    } finally {
      // Always reset streaming state
      isLoading.value = false
      chatStore.setStreaming(false)
      chatStore.setAbortController(null)

      // Update message with thinking content if any
      if (currentThinking.value) {
        chatStore.updateMessage(assistantMessageId, { thinking: currentThinking.value })
        currentThinking.value = ''
      }
    }
  }

  /**
   * Send a message and get streaming response
   * @param content - Display content for UI (may be placeholder)
   * @param images - Optional images for multimodal
   * @param llmContent - Optional full content for LLM API (if different from display)
   */
  async function sendMessage(
    content: string,
    images?: string[],
    llmContent?: string
  ): Promise<void> {
    if (!content.trim() && (!images || images.length === 0)) {
      return
    }

    error.value = null
    currentThinking.value = ''

    // Create session if needed
    if (!chatStore.hasActiveSession) {
      chatStore.createSession(modelId.value)
    }

    // Add user message (store display content and optionally llmContent)
    chatStore.addMessage({
      role: 'user',
      content, // UI display content
      llmContent: llmContent || undefined, // Full LLM content if different
      images,
    })

    // Create placeholder for assistant message
    const assistantMessage = chatStore.addMessage({
      role: 'assistant',
      content: '',
    })

    await streamAssistantResponse(assistantMessage.id)
  }

  /**
   * Handle stream chunk
   */
  function handleStreamChunk(chunk: StreamChunk, messageId: string) {
    switch (chunk.type) {
      case 'text':
        chatStore.appendToMessage(messageId, chunk.content)
        break
      case 'thinking':
        currentThinking.value += chunk.content
        break
      case 'error':
        error.value = chunk.content
        chatStore.updateMessage(messageId, { error: chunk.content })
        break
      case 'done':
        // Stream completed
        break
    }
  }

  /**
   * Stop current streaming
   */
  function stopStreaming() {
    chatStore.stopStreaming()
  }

  /**
   * Clear current conversation
   */
  function clearConversation() {
    chatStore.clearCurrentSession()
    error.value = null
    currentThinking.value = ''
  }

  /**
   * Regenerate last response
   */
  async function regenerate(targetAssistantMessageId?: string) {
    if (!chatStore.hasActiveSession) return

    // Stop any ongoing stream before regenerating
    if (chatStore.isStreaming) {
      chatStore.stopStreaming()
    }

    error.value = null
    currentThinking.value = ''

    const snapshot = messages.value.slice()

    // Resolve which assistant message to regenerate
    let assistantIndex = -1
    if (targetAssistantMessageId) {
      assistantIndex = snapshot.findIndex((m) => m.id === targetAssistantMessageId)
    }
    if (assistantIndex === -1) {
      assistantIndex = snapshot.map((m) => m.role).lastIndexOf('assistant')
    }
    if (assistantIndex === -1) return

    // Find the user message immediately before that assistant message
    let userIndex = -1
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (snapshot[i]?.role === 'user') {
        userIndex = i
        break
      }
    }
    if (userIndex === -1) return

    const userMessageId = snapshot[userIndex].id

    // Truncate conversation to that user message (drops the selected assistant and any later messages)
    chatStore.removeMessagesAfter(userMessageId)

    // Create a new assistant placeholder and stream into it
    const assistantMessage = chatStore.addMessage({
      role: 'assistant',
      content: '',
    })

    await streamAssistantResponse(assistantMessage.id)
  }

  return {
    // State
    isLoading,
    isStreaming,
    error,
    currentThinking,
    messages,
    modelId,

    // Actions
    sendMessage,
    stopStreaming,
    clearConversation,
    regenerate,
  }
}

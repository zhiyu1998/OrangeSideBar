/**
 * useChat Composable
 * Provides chat functionality with LLM providers
 */

import { ref, computed } from 'vue'
import { llmFactory } from '@/lib/llm/factory'
import type { ChatMessage, StreamChunk } from '@/lib/llm/types'
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
      })
    }
  }

  /**
   * Resolve provider for a model ID.
   * Prefer the provider captured in the cached model list (supports OpenAI-compatible 3rd-party models
   * whose IDs don't match our prefix mapping), then fallback to prefix-based detection.
   */
  function resolveProviderForModel(model: string) {
    const cached = settingsStore.allCachedModels.find((m) => m.id === model)
    if (cached) {
      configureProvider(cached.providerId)
      return llmFactory.getProvider(cached.providerId) ?? llmFactory.getProviderForModel(model)
    }

    const detected = llmFactory.getProviderForModel(model)
    if (detected) {
      configureProvider(detected.providerId)
    }
    return detected
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

    // Get provider for the model
    const provider = resolveProviderForModel(modelId.value)

    if (!provider) {
      error.value = `No provider found for model: ${modelId.value}`
      chatStore.updateMessage(assistantMessage.id, { error: error.value })
      return
    }

    if (!provider.isConfigured()) {
      error.value = `Provider "${provider.providerName}" is not configured. Please set API key in settings.`
      chatStore.updateMessage(assistantMessage.id, { error: error.value })
      return
    }

    // Prepare messages for API (use llmContent if available, otherwise content)
    const apiMessages: ChatMessage[] = messages.value
      .filter((m) => m.id !== assistantMessage.id)
      .map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.llmContent || m.content,
      }))

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
        handleStreamChunk(chunk, assistantMessage.id)
      }
    } catch (err) {
      console.error('[useChat] Stream error:', err)
      if (err instanceof Error) {
        if (err.name !== 'AbortError') {
          error.value = err.message
          chatStore.updateMessage(assistantMessage.id, { error: err.message })
        }
      } else {
        error.value = 'Unknown error occurred'
        chatStore.updateMessage(assistantMessage.id, { error: 'Unknown error occurred' })
      }
    } finally {
      // Always reset streaming state
      isLoading.value = false
      chatStore.setStreaming(false)
      chatStore.setAbortController(null)

      // Update message with thinking content if any
      if (currentThinking.value) {
        chatStore.updateMessage(assistantMessage.id, { thinking: currentThinking.value })
        currentThinking.value = ''
      }
    }
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
  async function regenerate() {
    const lastUserMessage = [...messages.value]
      .reverse()
      .find((m) => m.role === 'user')

    if (!lastUserMessage) return

    // Remove last assistant message
    const lastAssistantIndex = messages.value.length - 1
    if (messages.value[lastAssistantIndex]?.role === 'assistant') {
      // We need to implement delete message in store
    }

    // Resend the message
    await sendMessage(lastUserMessage.content, lastUserMessage.images)
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

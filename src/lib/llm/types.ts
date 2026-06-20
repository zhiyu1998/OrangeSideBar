/**
 * LLM Types
 */

import type { ProviderId } from '@/types/provider'
import type { ReasoningEffort } from '@/types/provider'
import type { OpenAIRequestMode } from '@/types/provider'

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant'

/**
 * Content part for multimodal messages
 */
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data: string
  }
}

export type ContentPart = TextContent | ImageContent

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: MessageRole
  content: string | ContentPart[]
}

/**
 * Chat request parameters
 */
export interface ChatParams {
  model: string
  messages: ChatMessage[]
  systemPrompt?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  reasoningEffort?: ReasoningEffort
  openAIRequestMode?: OpenAIRequestMode
  stream?: boolean
  signal?: AbortSignal
}

/**
 * Streaming chunk types
 */
export interface StreamChunk {
  type: 'text' | 'thinking' | 'error' | 'done'
  content: string
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string
  name: string
  providerId: ProviderId
  contextLength?: number
  isThinkingModel?: boolean
  supportsVision?: boolean
}

/**
 * Provider configuration for LLM calls
 */
export interface LLMProviderConfig {
  apiKey: string
  baseUrl: string
}

/**
 * Chat completion result (non-streaming)
 */
export interface ChatCompletionResult {
  content: string
  thinking?: string
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

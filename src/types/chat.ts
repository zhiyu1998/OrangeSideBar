/**
 * Chat and Message Types
 */

export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string // UI display content (may be placeholder for extracted content)
  llmContent?: string // Optional full content for LLM API (if different from display)
  images?: string[] // Base64 encoded images
  thinking?: string // Reasoning content for thinking models
  thinkingStartedAt?: number
  thinkingFinishedAt?: number
  timestamp: number
  error?: string
}

export interface ChatSession {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export type LayoutMode = 'single' | 'dual'

export interface DualColumnState {
  leftSessionId: string | null
  rightSessionId: string | null
  leftModelId: string
  rightModelId: string
}

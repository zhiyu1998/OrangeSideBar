/**
 * Chat and Message Types
 */

export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[] // Base64 encoded images
  thinking?: string // Reasoning content for thinking models
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

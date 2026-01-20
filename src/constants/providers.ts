/**
 * Provider Definitions
 */

import type { ProviderId, ProviderInfo } from '@/types/provider'

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    icon: 'openai.svg',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: false,
    },
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱清言 (GLM)',
    icon: 'zhipu.svg',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiPath: '/chat/completions',
    supportedFeatures: {
      streaming: true,
      vision: false,
      thinking: false,
    },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    icon: 'anthropic.svg',
    defaultBaseUrl: 'https://api.anthropic.com',
    apiPath: '/v1/messages',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: true,
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'deepseek.svg',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: false,
      thinking: true,
    },
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    icon: 'moonshot.svg',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: false,
      thinking: true,
    },
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    icon: 'siliconflow.svg',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: true,
    },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'openrouter.svg',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: true,
    },
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    icon: 'groq.svg',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: false,
    },
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    icon: 'grok.svg',
    defaultBaseUrl: 'https://api.x.ai/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: false,
    },
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    icon: 'mistral.svg',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: false,
      thinking: false,
    },
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    icon: 'ollama.svg',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    apiPath: '/chat/completions',
    modelsEndpoint: '/models',
    supportedFeatures: {
      streaming: true,
      vision: true,
      thinking: false,
    },
  },
}

/**
 * Model prefix to provider mapping
 * Used to auto-detect provider from model ID
 */
export const MODEL_PROVIDER_MAPPING: Record<string, ProviderId> = {
  'gpt-': 'openai',
  'o1-': 'openai',
  'o3-': 'openai',
  'chatgpt-': 'openai',
  'glm': 'zhipu',
  'claude-': 'anthropic',
  'deepseek-': 'deepseek',
  'moonshot-': 'moonshot',
  'kimi-': 'moonshot',
  'Qwen': 'siliconflow',
  'qwen': 'siliconflow',
  'llama-': 'groq',
  'mixtral-': 'groq',
  'gemma-': 'groq',
  'grok-': 'grok',
  'mistral-': 'mistral',
  'codestral-': 'mistral',
}

/**
 * Thinking/reasoning models list
 */
export const THINKING_MODELS = [
  'o1-preview',
  'o1-mini',
  'o1',
  'o3-mini',
  'deepseek-reasoner',
  'deepseek-r1',
  'kimi-k2-thinking',
  'claude-3-5-sonnet-20241022', // Extended thinking
]

/**
 * Detect provider from model ID
 */
export function detectProvider(modelId: string): ProviderId | null {
  for (const [prefix, providerId] of Object.entries(MODEL_PROVIDER_MAPPING)) {
    if (modelId.toLowerCase().startsWith(prefix.toLowerCase())) {
      return providerId
    }
  }
  return null
}

/**
 * Check if model supports thinking/reasoning
 */
export function isThinkingModel(modelId: string): boolean {
  return THINKING_MODELS.some((m) => modelId.includes(m))
}

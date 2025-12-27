<script setup lang="ts">
import { ref } from 'vue'
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { ProviderId } from '@/types/provider'

const settingsStore = useSettingsStore()

interface ProviderInfo {
  id: ProviderId
  name: string
  description: string
  defaultBaseUrl: string
}

const providers: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, GPT-4 Turbo',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 4, Claude 3.5 Sonnet, Claude 3.5 Haiku',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek-V3, DeepSeek-R1',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    description: 'Kimi-K2, Moonshot-v1',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    description: 'Various open-source models',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple providers via one API',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Fast inference for LLaMA and Mixtral',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    description: 'Grok-2, Grok-3',
    defaultBaseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Mistral Medium',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
  },
]

// State for password visibility
const showApiKey = ref<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>)
const testingProvider = ref<ProviderId | null>(null)
const testResult = ref<Record<ProviderId, 'success' | 'error' | null>>({} as Record<ProviderId, 'success' | 'error' | null>)

function toggleShowApiKey(providerId: ProviderId) {
  showApiKey.value[providerId] = !showApiKey.value[providerId]
}

function getProviderConfig(providerId: ProviderId) {
  return settingsStore.getProviderConfig(providerId)
}

function updateApiKey(providerId: ProviderId, value: string) {
  settingsStore.updateProviderConfig(providerId, { apiKey: value })
}

function updateBaseUrl(providerId: ProviderId, value: string) {
  settingsStore.updateProviderConfig(providerId, { baseUrl: value })
}

function toggleEnabled(providerId: ProviderId, checked: boolean) {
  settingsStore.setProviderEnabled(providerId, checked)
}

function resetBaseUrl(providerId: ProviderId) {
  const provider = providers.find((p) => p.id === providerId)
  if (provider) {
    settingsStore.updateProviderConfig(providerId, { baseUrl: provider.defaultBaseUrl })
  }
}

async function testConnection(providerId: ProviderId) {
  const config = getProviderConfig(providerId)
  if (!config.apiKey) {
    testResult.value[providerId] = 'error'
    return
  }

  testingProvider.value = providerId
  testResult.value[providerId] = null

  try {
    // Simple connection test - try to fetch models
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      testResult.value[providerId] = 'success'
    } else {
      testResult.value[providerId] = 'error'
    }
  } catch {
    testResult.value[providerId] = 'error'
  } finally {
    testingProvider.value = null
  }
}

function getTestButtonContent(providerId: ProviderId) {
  if (testingProvider.value === providerId) {
    return { icon: Loader2, text: 'Testing...', class: 'animate-spin' }
  }
  if (testResult.value[providerId] === 'success') {
    return { icon: Check, text: 'Connected', class: 'text-green-500' }
  }
  if (testResult.value[providerId] === 'error') {
    return { icon: X, text: 'Failed', class: 'text-red-500' }
  }
  return { icon: null, text: 'Test Connection', class: '' }
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>LLM Providers</CardTitle>
        <CardDescription>
          Configure API keys and endpoints for different LLM providers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible class="w-full">
          <AccordionItem
            v-for="provider in providers"
            :key="provider.id"
            :value="provider.id"
          >
            <AccordionTrigger class="hover:no-underline">
              <div class="flex items-center gap-3">
                <Switch
                  :checked="getProviderConfig(provider.id).enabled"
                  @click.stop
                  @update:checked="(checked: boolean) => toggleEnabled(provider.id, checked)"
                />
                <div class="text-left">
                  <div class="font-medium">{{ provider.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ provider.description }}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div class="space-y-4 pt-4">
                <!-- API Key -->
                <div class="space-y-2">
                  <Label :for="`${provider.id}-api-key`">API Key</Label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <Input
                        :id="`${provider.id}-api-key`"
                        :type="showApiKey[provider.id] ? 'text' : 'password'"
                        :value="getProviderConfig(provider.id).apiKey as string"
                        placeholder="Enter your API key"
                        @input="(e: Event) => updateApiKey(provider.id, (e.target as HTMLInputElement).value)"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        @click="toggleShowApiKey(provider.id)"
                      >
                        <EyeOff v-if="showApiKey[provider.id]" class="h-4 w-4" />
                        <Eye v-else class="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- Base URL -->
                <div class="space-y-2">
                  <Label :for="`${provider.id}-base-url`">Base URL</Label>
                  <div class="flex gap-2">
                    <Input
                      :id="`${provider.id}-base-url`"
                      :value="getProviderConfig(provider.id).baseUrl"
                      :placeholder="provider.defaultBaseUrl"
                      @input="(e: Event) => updateBaseUrl(provider.id, (e.target as HTMLInputElement).value)"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      @click="resetBaseUrl(provider.id)"
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                <!-- Test Connection -->
                <div class="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="testingProvider === provider.id || !getProviderConfig(provider.id).apiKey"
                    @click="testConnection(provider.id)"
                  >
                    <component
                      v-if="getTestButtonContent(provider.id).icon"
                      :is="getTestButtonContent(provider.id).icon"
                      :class="['mr-2 h-4 w-4', getTestButtonContent(provider.id).class]"
                    />
                    {{ getTestButtonContent(provider.id).text }}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  </div>
</template>

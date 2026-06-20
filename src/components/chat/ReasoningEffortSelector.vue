<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/stores/settings'
import { llmFactory } from '@/lib/llm/factory'
import type { ReasoningEffort } from '@/types/provider'

interface EffortOption {
  value: ReasoningEffort
  label: string
  description: string
}

const settingsStore = useSettingsStore()

const effortOptions: EffortOption[] = [
  { value: 'auto', label: 'Auto', description: 'Only send when needed by the selected model/provider mapping.' },
  { value: 'none', label: 'None', description: 'Fastest response, minimal internal reasoning.' },
  { value: 'minimal', label: 'Minimal', description: 'Very light reasoning.' },
  { value: 'low', label: 'Low', description: 'Lower latency and cost.' },
  { value: 'medium', label: 'Medium', description: 'Balanced quality and speed.' },
  { value: 'high', label: 'High', description: 'More deliberate reasoning.' },
  { value: 'xhigh', label: 'XHigh', description: 'Deepest reasoning, highest latency.' },
]

const currentModel = computed(() => settingsStore.defaultModel)
const currentEffort = computed(() => settingsStore.reasoningEffort)

const currentProvider = computed(() => {
  const cachedModel = settingsStore.allCachedModels.find((model) => model.id === currentModel.value)
  if (cachedModel) {
    const config = settingsStore.getProviderConfig(cachedModel.providerId)
    llmFactory.configureProvider(
      cachedModel.providerId,
      {
        apiKey: settingsStore.getApiKey(cachedModel.providerId),
        baseUrl: config.baseUrl,
      },
      settingsStore.getProviderApiSpec(cachedModel.providerId)
    )
  }

  const provider = cachedModel
    ? llmFactory.getProvider(cachedModel.providerId)
    : llmFactory.getProviderForModel(currentModel.value)
  return provider
})

const supportsReasoningControl = computed(() => {
  return !!currentProvider.value
})

const currentLabel = computed(() => {
  return effortOptions.find((option) => option.value === currentEffort.value)?.label || 'Auto'
})

const isThinkingDisabled = computed(() => currentEffort.value === 'none')

function selectEffort(value: ReasoningEffort) {
  settingsStore.setReasoningEffort(value)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-7 w-9 px-0"
        :title="supportsReasoningControl ? `Reasoning: ${currentLabel}` : 'Reasoning control unavailable for current model'"
      >
        <svg
          v-if="isThinkingDisabled"
          viewBox="0 0 1024 1024"
          class="h-4 w-4"
          :class="supportsReasoningControl ? 'text-muted-foreground' : 'text-muted-foreground/60'"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M180.138667 180.138667C248.704 111.573333 378.24 121.813333 512 194.133333c133.717333-72.32 263.253333-82.56 331.818667-13.994666 68.565333 68.565333 58.325333 198.101333-13.994667 331.904 72.32 133.717333 82.56 263.253333 13.994667 331.818666-68.565333 68.565333-198.101333 58.325333-331.904-13.994666-133.717333 72.32-263.253333 82.56-331.818667 13.994666-68.565333-68.565333-58.325333-198.101333 13.994667-331.904-72.32-133.717333-82.56-263.253333-13.994667-331.818666z m596.181333 416.085333l-4.096 5.546667a844.16 844.16 0 0 1-79.189333 91.264 841.472 841.472 0 0 1-96.810667 83.285333c83.882667 36.266667 155.306667 39.210667 187.306667 7.210667 32-32 29.056-103.424-7.253334-187.306667zM391.338667 391.338667A740.608 740.608 0 0 0 293.205333 512c26.026667 40.277333 58.794667 81.365333 98.133334 120.661333 39.296 39.338667 80.384 72.106667 120.661333 98.133334a740.778667 740.778667 0 0 0 120.661333-98.133334 740.608 740.608 0 0 0 98.133334-120.661333 740.778667 740.778667 0 0 0-98.133334-120.661333A740.608 740.608 0 0 0 512 293.205333a740.778667 740.778667 0 0 0-120.661333 98.133334z m-143.658667 204.885333c-36.266667 84.096-39.168 155.349333-7.210667 187.306667 32 32 103.424 29.056 187.306667-7.253334a838.4 838.4 0 0 1-96.810667-83.242666 841.472 841.472 0 0 1-83.285333-96.810667z m348.544-348.544l5.546667 4.096c31.146667 23.296 61.781333 49.749333 91.264 79.189333a841.472 841.472 0 0 1 83.285333 96.810667c36.266667-83.882667 39.210667-155.306667 7.210667-187.306667-32-32-103.424-29.056-187.306667 7.253334zM426.666667 512a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0zM240.469333 240.469333c-32 32-29.056 103.424 7.253334 187.306667a838.4 838.4 0 0 1 83.242666-96.810667 841.472 841.472 0 0 1 96.810667-83.285333c-83.882667-36.266667-155.306667-39.210667-187.306667-7.210667z" />
        </svg>
        <svg
          v-else
          viewBox="0 0 1024 1024"
          class="h-4 w-4"
          :class="supportsReasoningControl ? 'text-[#4D5C92]' : 'text-muted-foreground/60'"
          aria-hidden="true"
        >
          <path d="M180.138667 180.138667C248.704 111.573333 378.24 121.813333 512 194.133333c133.717333-72.32 263.253333-82.56 331.818667-13.994666 68.565333 68.565333 58.325333 198.101333-13.994667 331.904 72.32 133.717333 82.56 263.253333 13.994667 331.818666-68.565333 68.565333-198.101333 58.325333-331.904-13.994666-133.717333 72.32-263.253333 82.56-331.818667 13.994666-68.565333-68.565333-58.325333-198.101333 13.994667-331.904-72.32-133.717333-82.56-263.253333-13.994667-331.818666z m596.181333 416.085333l-4.096 5.546667a844.16 844.16 0 0 1-79.189333 91.264 841.472 841.472 0 0 1-96.810667 83.285333c83.882667 36.266667 155.306667 39.210667 187.306667 7.210667 32-32 29.056-103.424-7.253334-187.306667zM391.338667 391.338667A740.608 740.608 0 0 0 293.205333 512c26.026667 40.277333 58.794667 81.365333 98.133334 120.661333 39.296 39.338667 80.384 72.106667 120.661333 98.133334a740.778667 740.778667 0 0 0 120.661333-98.133334 740.608 740.608 0 0 0 98.133334-120.661333 740.778667 740.778667 0 0 0-98.133334-120.661333A740.608 740.608 0 0 0 512 293.205333a740.778667 740.778667 0 0 0-120.661333 98.133334z m-143.658667 204.885333c-36.266667 84.096-39.168 155.349333-7.210667 187.306667 32 32 103.424 29.056 187.306667-7.253334a838.4 838.4 0 0 1-96.810667-83.242666 841.472 841.472 0 0 1-83.285333-96.810667z m348.544-348.544l5.546667 4.096c31.146667 23.296 61.781333 49.749333 91.264 79.189333a841.472 841.472 0 0 1 83.285333 96.810667c36.266667-83.882667 39.210667-155.306667 7.210667-187.306667-32-32-103.424-29.056-187.306667 7.253334zM426.666667 512a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0zM240.469333 240.469333c-32 32-29.056 103.424 7.253334 187.306667a838.4 838.4 0 0 1 83.242666-96.810667 841.472 841.472 0 0 1 96.810667-83.285333c-83.882667-36.266667-155.306667-39.210667-187.306667-7.210667z" fill="currentColor" />
        </svg>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[260px]">
      <DropdownMenuLabel class="text-xs">Reasoning Effort</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="option in effortOptions"
        :key="option.value"
        class="flex items-start justify-between gap-3 py-2"
        :disabled="!supportsReasoningControl && option.value !== 'auto'"
        @select="selectEffort(option.value)"
      >
        <div class="min-w-0">
          <div class="text-sm">{{ option.label }}</div>
          <div class="text-[10px] text-muted-foreground leading-relaxed">{{ option.description }}</div>
        </div>
        <Check
          v-if="option.value === currentEffort"
          class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

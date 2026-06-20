<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { User, Bot, Copy, RotateCcw, ChevronDown, ChevronUp, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import MarkdownRenderer from './MarkdownRenderer.vue'

interface Props {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  thinkingStartedAt?: number
  thinkingFinishedAt?: number
  error?: string
  images?: string[]
  isStreaming?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  copy: [content: string]
  regenerate: [messageId: string]
}>()

const showThinking = ref(false)
const copied = ref(false)
const now = ref(Date.now())
let timer: number | null = null

const isUser = computed(() => props.role === 'user')
const hasThinking = computed(() => !!props.thinking && props.thinking.length > 0)
const isThinkingStreaming = computed(() => {
  return !!props.isStreaming && !!props.thinkingStartedAt && !props.thinkingFinishedAt
})

const isThinkingComplete = computed(() => {
  return !!props.thinking && !!props.thinkingFinishedAt
})

const thinkingPreview = computed(() => {
  if (!props.thinking) return ''

  const lines = props.thinking
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  return lines.slice(-5).join('\n')
})

const thinkingDisplay = computed(() => {
  return showThinking.value ? (props.thinking || '') : thinkingPreview.value
})

const shouldShowThinkingBody = computed(() => {
  return showThinking.value || isThinkingStreaming.value
})

const thinkingDurationSeconds = computed(() => {
  if (!props.thinkingStartedAt) return 0

  const end = props.thinkingFinishedAt || now.value
  return Math.max(0, (end - props.thinkingStartedAt) / 1000)
})

const formattedThinkingDuration = computed(() => {
  return `${thinkingDurationSeconds.value.toFixed(1)}s`
})

function copyContent() {
  emit('copy', props.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function regenerate() {
  emit('regenerate', props.id)
}

function toggleThinking() {
  if (!isThinkingStreaming.value && !showThinking.value && isThinkingComplete.value) {
    showThinking.value = true
    return
  }
  showThinking.value = !showThinking.value
}

function startTimer() {
  if (timer !== null) return
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  if (isThinkingStreaming.value) {
    startTimer()
  }
})

watchEffect(() => {
  if (isThinkingStreaming.value) {
    startTimer()
    showThinking.value = false
  } else {
    stopTimer()
  }
})

watchEffect(() => {
  if (isThinkingComplete.value && !isThinkingStreaming.value) {
    showThinking.value = false
  }
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <div
    class="group flex gap-3 px-4 py-3"
    :class="[isUser ? 'bg-muted/30' : 'bg-background']"
  >
    <!-- Avatar -->
    <div
      class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
      :class="[isUser ? 'bg-primary text-primary-foreground' : 'bg-orange-500 text-white']"
    >
      <User v-if="isUser" class="w-4 h-4" />
      <Bot v-else class="w-4 h-4" />
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0 space-y-2">
      <!-- Role Label -->
      <div class="text-xs font-medium text-muted-foreground">
        {{ isUser ? 'You' : 'Assistant' }}
      </div>

      <!-- Images (for user messages) -->
      <div v-if="images && images.length > 0" class="flex flex-wrap gap-2 mb-2">
        <img
          v-for="(img, idx) in images"
          :key="idx"
          :src="img"
          class="max-w-[200px] max-h-[150px] rounded-md border object-cover"
          alt="Uploaded image"
        >
      </div>

      <!-- Thinking Process (for assistant with reasoning) -->
      <div v-if="hasThinking" class="mb-3">
        <div class="rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(250,251,255,0.94),rgba(245,247,252,0.90))] px-4 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.10)] dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,rgba(33,37,47,0.96),rgba(24,28,36,0.92))] dark:shadow-[0_12px_28px_rgba(2,6,23,0.35)]">
          <button
            class="flex w-full items-center gap-3 text-left"
            @click="toggleThinking"
          >
            <svg viewBox="0 0 1024 1024" class="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-300" aria-hidden="true">
              <path d="M180.138667 180.138667C248.704 111.573333 378.24 121.813333 512 194.133333c133.717333-72.32 263.253333-82.56 331.818667-13.994666 68.565333 68.565333 58.325333 198.101333-13.994667 331.904 72.32 133.717333 82.56 263.253333 13.994667 331.818666-68.565333 68.565333-198.101333 58.325333-331.904-13.994666-133.717333 72.32-263.253333 82.56-331.818667 13.994666-68.565333-68.565333-58.325333-198.101333 13.994667-331.904-72.32-133.717333-82.56-263.253333-13.994667-331.818666z m596.181333 416.085333l-4.096 5.546667a844.16 844.16 0 0 1-79.189333 91.264 841.472 841.472 0 0 1-96.810667 83.285333c83.882667 36.266667 155.306667 39.210667 187.306667 7.210667 32-32 29.056-103.424-7.253334-187.306667zM391.338667 391.338667A740.608 740.608 0 0 0 293.205333 512c26.026667 40.277333 58.794667 81.365333 98.133334 120.661333 39.296 39.338667 80.384 72.106667 120.661333 98.133334a740.778667 740.778667 0 0 0 120.661333-98.133334 740.608 740.608 0 0 0 98.133334-120.661333 740.778667 740.778667 0 0 0-98.133334-120.661333A740.608 740.608 0 0 0 512 293.205333a740.778667 740.778667 0 0 0-120.661333 98.133334z m-143.658667 204.885333c-36.266667 84.096-39.168 155.349333-7.210667 187.306667 32 32 103.424 29.056 187.306667-7.253334a838.4 838.4 0 0 1-96.810667-83.242666 841.472 841.472 0 0 1-83.285333-96.810667z m348.544-348.544l5.546667 4.096c31.146667 23.296 61.781333 49.749333 91.264 79.189333a841.472 841.472 0 0 1 83.285333 96.810667c36.266667-83.882667 39.210667-155.306667 7.210667-187.306667-32-32-103.424-29.056-187.306667 7.253334zM426.666667 512a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0zM240.469333 240.469333c-32 32-29.056 103.424 7.253334 187.306667a838.4 838.4 0 0 1 83.242666-96.810667 841.472 841.472 0 0 1 96.810667-83.285333c-83.882667-36.266667-155.306667-39.210667-187.306667-7.210667z" fill="currentColor" />
            </svg>

            <div class="min-w-0 flex-1 flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2">
                <span class="thinking-badge relative inline-flex overflow-hidden rounded-full border border-white/80 bg-white/75 px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/85 dark:text-slate-200">
                  <span class="relative z-10">深度思考</span>
                </span>
                <span class="text-sm text-slate-400 dark:text-slate-400">({{ formattedThinkingDuration }})</span>
              </div>

              <component :is="showThinking ? ChevronUp : ChevronDown" class="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-400" />
            </div>
          </button>

          <div v-if="shouldShowThinkingBody" class="relative mt-3 overflow-hidden rounded-2xl bg-white/55 dark:bg-slate-900/35">
            <div v-if="showThinking" class="absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#f4f6fb] via-[#f4f6fb]/70 to-transparent pointer-events-none dark:bg-gradient-to-b dark:from-[#1f2530] dark:via-[#1f2530]/75 dark:to-transparent" />
            <div class="absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[#f4f6fb] via-[#f4f6fb]/70 to-transparent pointer-events-none dark:bg-gradient-to-t dark:from-[#1f2530] dark:via-[#1f2530]/75 dark:to-transparent" />

            <div
              v-if="showThinking"
              class="max-h-56 overflow-hidden"
            >
              <ScrollArea class="h-56">
                <div class="px-4 py-3 text-sm leading-7 text-slate-600 whitespace-pre-wrap dark:text-slate-300">
                  {{ thinkingDisplay }}
                </div>
              </ScrollArea>
            </div>

            <div
              v-else
              class="h-32 overflow-hidden"
            >
              <div class="flex h-full items-end">
                <div class="px-4 py-3 text-sm leading-7 text-slate-600 whitespace-pre-wrap dark:text-slate-300">
                  {{ thinkingDisplay }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Content -->
      <div v-if="error" class="text-sm text-destructive">
        {{ error }}
      </div>
      <div v-else-if="isUser" class="text-sm whitespace-pre-wrap break-words">
        {{ content }}
      </div>
      <MarkdownRenderer v-else :content="content" :is-streaming="isStreaming" />

      <!-- Streaming Indicator -->
      <div v-if="isStreaming && !isUser" class="flex items-center gap-1 text-xs text-muted-foreground">
        <span class="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
        Generating...
      </div>

      <!-- Actions (shown on hover for assistant messages) -->
      <div
        v-if="!isUser && !isStreaming && content"
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs transition-all duration-200"
          :class="{ 'text-green-500 bg-green-500/10': copied }"
          @click="copyContent"
        >
          <component :is="copied ? Check : Copy" class="w-3 h-3 mr-1" />
          {{ copied ? 'Copied!' : 'Copy' }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs"
          @click="regenerate"
        >
          <RotateCcw class="w-3 h-3 mr-1" />
          Regenerate
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thinking-badge::after {
  content: '';
  position: absolute;
  inset: -20%;
  background: linear-gradient(
    110deg,
    transparent 15%,
    rgba(255, 255, 255, 0.18) 35%,
    rgba(255, 255, 255, 0.88) 50%,
    rgba(255, 255, 255, 0.18) 65%,
    transparent 85%
  );
  transform: translateX(-140%);
  animation: thinking-shimmer 2.8s linear infinite;
}

:global(.dark) .thinking-badge::after {
  background: linear-gradient(
    110deg,
    transparent 15%,
    rgba(148, 163, 184, 0.04) 35%,
    rgba(226, 232, 240, 0.28) 50%,
    rgba(148, 163, 184, 0.06) 65%,
    transparent 85%
  );
}

@keyframes thinking-shimmer {
  to {
    transform: translateX(140%);
  }
}
</style>

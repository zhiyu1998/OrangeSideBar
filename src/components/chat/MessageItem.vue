<script setup lang="ts">
import { computed } from 'vue'
import { User, Bot, Copy, RotateCcw, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ref } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

interface Props {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  error?: string
  images?: string[]
  isStreaming?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  copy: [content: string]
  regenerate: []
}>()

const showThinking = ref(false)

const isUser = computed(() => props.role === 'user')
const hasThinking = computed(() => !!props.thinking && props.thinking.length > 0)

function copyContent() {
  emit('copy', props.content)
}

function regenerate() {
  emit('regenerate')
}

function toggleThinking() {
  showThinking.value = !showThinking.value
}
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
      <div v-if="hasThinking" class="mb-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          @click="toggleThinking"
        >
          <component :is="showThinking ? ChevronUp : ChevronDown" class="w-3 h-3 mr-1" />
          {{ showThinking ? 'Hide' : 'Show' }} thinking process
        </Button>
        <div
          v-if="showThinking"
          class="mt-2 p-3 rounded-md bg-muted/50 border border-dashed text-sm text-muted-foreground italic whitespace-pre-wrap"
        >
          {{ thinking }}
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
          class="h-7 px-2 text-xs"
          @click="copyContent"
        >
          <Copy class="w-3 h-3 mr-1" />
          Copy
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

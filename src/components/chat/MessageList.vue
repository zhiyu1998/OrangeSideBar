<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import MessageItem from './MessageItem.vue'
import type { Message } from '@/types/chat'

interface Props {
  messages: Message[]
  isStreaming?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  copy: [content: string]
  regenerate: []
}>()

const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null)

// Auto scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

// Also scroll when streaming content updates
watch(
  () => props.messages[props.messages.length - 1]?.content,
  async () => {
    if (props.isStreaming) {
      await nextTick()
      scrollToBottom()
    }
  }
)

function scrollToBottom() {
  if (scrollAreaRef.value) {
    const viewport = scrollAreaRef.value.$el?.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }
}

function handleCopy(content: string) {
  emit('copy', content)
}

function handleRegenerate() {
  emit('regenerate')
}
</script>

<template>
  <ScrollArea ref="scrollAreaRef" class="flex-1">
    <div class="min-h-full">
      <!-- Empty State -->
      <div
        v-if="messages.length === 0"
        class="flex flex-col items-center justify-center h-[300px] text-center px-6"
      >
        <div class="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-4">
          <span class="text-3xl">🍊</span>
        </div>
        <h3 class="text-lg font-medium mb-2">Start a conversation</h3>
        <p class="text-sm text-muted-foreground max-w-[280px]">
          Ask me anything, or use the feature buttons above to summarize, translate, or analyze content.
        </p>
      </div>

      <!-- Messages -->
      <div v-else class="divide-y">
        <MessageItem
          v-for="(message, index) in messages"
          :key="message.id"
          :id="message.id"
          :role="message.role"
          :content="message.content"
          :thinking="message.thinking"
          :error="message.error"
          :images="message.images"
          :is-streaming="isStreaming && index === messages.length - 1 && message.role === 'assistant'"
          @copy="handleCopy"
          @regenerate="handleRegenerate"
        />
      </div>
    </div>
  </ScrollArea>
</template>

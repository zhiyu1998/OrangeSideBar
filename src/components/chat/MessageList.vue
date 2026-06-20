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
  regenerate: [messageId: string]
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

watch(
  () => props.messages[props.messages.length - 1]?.thinking,
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

function handleRegenerate(messageId: string) {
  emit('regenerate', messageId)
}
</script>

<template>
  <ScrollArea ref="scrollAreaRef" class="flex-1">
    <div class="min-h-full">
      <!-- Empty State removed -->
      <div
        v-if="messages.length === 0"
        class="flex flex-col items-center justify-center py-10"
      >
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
          :thinking-started-at="message.thinkingStartedAt"
          :thinking-finished-at="message.thinkingFinishedAt"
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

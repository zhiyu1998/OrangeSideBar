<script setup lang="ts">
import { computed } from 'vue'
import { Clock3, MessageSquarePlus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ChatSession } from '@/types/chat'

interface Props {
  sessions: ChatSession[]
  currentSessionId?: string | null
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [sessionId: string]
  create: []
  delete: [sessionId: string]
}>()

const sessions = computed(() => props.sessions)

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-background/95 backdrop-blur-md flex-shrink-0">
    <div class="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
      <div class="flex items-center gap-2">
        <Clock3 class="h-4 w-4 text-muted-foreground" />
        <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">History</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-[11px]"
        :disabled="disabled"
        @click="emit('create')"
      >
        <MessageSquarePlus class="h-3.5 w-3.5" />
        New
      </Button>
    </div>

    <ScrollArea class="h-[min(18rem,calc(100vh-8rem))]">
      <div v-if="sessions.length === 0" class="px-4 py-6 text-center text-xs text-muted-foreground">
        No conversations yet
      </div>

      <div v-else class="p-2 space-y-1.5">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="w-full flex items-center gap-1 rounded-xl border transition-colors"
          :class="session.id === currentSessionId
            ? 'bg-primary/8 border-primary/30'
            : 'bg-background/70 border-transparent hover:bg-accent/50'"
        >
          <button
            type="button"
            class="min-w-0 flex-1 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="disabled"
            @click="emit('select', session.id)"
          >
            <div class="truncate text-sm font-medium">{{ session.title }}</div>
            <div class="mt-0.5 truncate text-[10px] text-muted-foreground">
              {{ formatTime(session.updatedAt) }} - {{ session.messages.length }} msgs
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            class="mr-2 h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
            :disabled="disabled"
            @click="emit('delete', session.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

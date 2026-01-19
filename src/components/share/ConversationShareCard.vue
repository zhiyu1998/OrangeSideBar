<script setup lang="ts">
import type { Message } from '@/types/chat'
import MarkdownRenderer from '@/components/chat/MarkdownRenderer.vue'

interface Props {
  messages: Message[]
  pageTitle?: string
  pageUrl?: string
  generatedAt?: number
}

defineProps<Props>()

function formatTimestamp(ts?: number) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}
</script>

<template>
  <div
    class="rounded-2xl border shadow-sm"
    style="background-color: #FAF8F6; color: #1f2937; border-color: rgba(17, 24, 39, 0.12);"
  >
    <!-- Header -->
    <div class="px-6 pt-6 pb-4">
      <div class="flex items-start gap-3">
        <img src="/logo_48.png" class="w-8 h-8 rounded-md" alt="OrangeSideBar">
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold leading-snug break-words">
            {{ pageTitle || 'Conversation' }}
          </h1>
          <p v-if="pageUrl" class="mt-1 text-xs" style="color: rgba(31, 41, 55, 0.75);">
            {{ pageUrl }}
          </p>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div class="px-6 pb-6">
      <div class="space-y-3">
        <div
          v-for="m in messages"
          :key="m.id"
          class="flex gap-3"
        >
          <div
            class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            :style="m.role === 'user'
              ? 'background-color: #111827; color: #ffffff;'
              : 'background-color: #f97316; color: #ffffff;'"
          >
            <span class="text-[10px] font-bold leading-none">
              {{ m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'AI' : 'SYS' }}
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-medium" style="color: rgba(31, 41, 55, 0.7);">
              {{ m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Assistant' : 'System' }}
              <span v-if="m.timestamp" class="ml-2" style="color: rgba(31, 41, 55, 0.5);">
                {{ formatTimestamp(m.timestamp) }}
              </span>
            </div>

            <div
              class="mt-1 rounded-xl border px-4 py-3"
              :style="m.role === 'user'
                ? 'background-color: #ffffff; border-color: rgba(17, 24, 39, 0.10);'
                : 'background-color: rgba(255, 255, 255, 0.65); border-color: rgba(249, 115, 22, 0.22);'"
            >
              <div v-if="m.images && m.images.length > 0" class="flex flex-wrap gap-2 mb-2">
                <img
                  v-for="(img, idx) in m.images"
                  :key="idx"
                  :src="img"
                  class="max-w-[220px] max-h-[160px] rounded-md border object-cover"
                  style="border-color: rgba(17, 24, 39, 0.12);"
                  alt="Uploaded image"
                >
              </div>

              <div v-if="m.error" class="text-sm" style="color: #dc2626;">
                {{ m.error }}
              </div>

              <div v-else-if="m.role === 'user' || m.role === 'system'" class="text-sm whitespace-pre-wrap break-words">
                {{ m.content }}
              </div>
              <MarkdownRenderer v-else :content="m.content" :theme="'light'" />

              <div
                v-if="m.thinking"
                class="mt-2 rounded-lg border border-dashed px-3 py-2 text-xs whitespace-pre-wrap"
                style="background-color: rgba(31, 41, 55, 0.03); border-color: rgba(31, 41, 55, 0.18); color: rgba(31, 41, 55, 0.7);"
              >
                {{ m.thinking }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="px-6 py-4 border-t flex items-center justify-between text-xs"
      style="border-color: rgba(17, 24, 39, 0.10); color: rgba(31, 41, 55, 0.7);"
    >
      <div class="flex items-center gap-2">
        <span class="font-semibold" style="color: rgba(31, 41, 55, 0.85);">OrangeSideBar</span>
        <span style="color: rgba(31, 41, 55, 0.45);">·</span>
        <span>Share as image</span>
      </div>
      <span v-if="generatedAt">
        {{ formatTimestamp(generatedAt) }}
      </span>
    </div>
  </div>
</template>


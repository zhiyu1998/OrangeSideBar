<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import html2canvas from 'html2canvas-pro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Copy, Download, ExternalLink, RefreshCcw } from 'lucide-vue-next'
import type { Message } from '@/types/chat'
import ConversationShareCard from './ConversationShareCard.vue'

const props = defineProps<{
  open: boolean
  messages: Message[]
  pageTitle?: string
  pageUrl?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const captureRef = ref<HTMLElement | null>(null)
const isGenerating = ref(false)
const error = ref<string | null>(null)
const imageBlob = ref<Blob | null>(null)
const imageUrl = ref<string>('')
const generatedAt = ref<number>(Date.now())

const canUseClipboardImage = computed(() => {
  return typeof window !== 'undefined'
    && 'ClipboardItem' in window
    && !!navigator.clipboard
    && typeof navigator.clipboard.write === 'function'
})

function cleanup() {
  error.value = null
  imageBlob.value = null
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
  }
  imageUrl.value = ''
}

function setOpen(value: boolean) {
  emit('update:open', value)
  if (!value) cleanup()
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
  if (images.length === 0) return

  await Promise.allSettled(
    images.map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const onDone = () => {
          img.removeEventListener('load', onDone)
          img.removeEventListener('error', onDone)
          resolve()
        }
        img.addEventListener('load', onDone, { once: true })
        img.addEventListener('error', onDone, { once: true })
      })
    })
  )
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) {
        reject(new Error('Failed to encode PNG'))
        return
      }
      resolve(b)
    }, 'image/png')
  })
}

async function generateImage() {
  if (!captureRef.value) return

  isGenerating.value = true
  error.value = null
  generatedAt.value = Date.now()

  try {
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    await waitForImages(captureRef.value)

    const canvas = await html2canvas(captureRef.value, {
      backgroundColor: '#FAF8F6',
      useCORS: true,
      scale: 2,
      onclone: (doc) => {
        doc.documentElement.classList.remove('dark')
      },
    })

    const blob = await canvasToPngBlob(canvas)
    imageBlob.value = blob

    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate image'
    error.value = message
  } finally {
    isGenerating.value = false
  }
}

function downloadPng() {
  if (!imageUrl.value) return
  const filename = `orangesidebar-chat-${new Date(generatedAt.value).toISOString().slice(0, 19).replaceAll(':', '-')}.png`
  const a = document.createElement('a')
  a.href = imageUrl.value
  a.download = filename
  a.click()
}

async function copyPng() {
  if (!imageBlob.value) return
  if (!canUseClipboardImage.value) {
    error.value = 'Copy image is not supported in this environment.'
    return
  }

  try {
    const ClipboardItemCtor = (window as any).ClipboardItem
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': imageBlob.value })])
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to copy image'
    error.value = message
  }
}

function openInNewTab() {
  if (!imageUrl.value) return
  window.open(imageUrl.value, '_blank')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    cleanup()
    await nextTick()
    await generateImage()
  }
)

onBeforeUnmount(() => {
  cleanup()
})
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[520px] p-0 overflow-hidden">
      <div class="p-6 space-y-4">
        <DialogHeader>
          <DialogTitle>Share as image</DialogTitle>
          <DialogDescription>
            Generate a PNG snapshot of the current conversation.
          </DialogDescription>
        </DialogHeader>

        <div v-if="isGenerating" class="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          Generating image…
        </div>

        <div v-else-if="imageUrl" class="rounded-xl border bg-muted/10 p-2">
          <img :src="imageUrl" alt="Conversation image preview" class="w-full rounded-lg">
        </div>

        <div v-if="error" class="text-sm text-destructive">
          {{ error }}
        </div>
      </div>

      <DialogFooter class="p-4 border-t gap-2">
        <Button variant="ghost" class="gap-2" :disabled="isGenerating" @click="generateImage">
          <RefreshCcw class="h-4 w-4" />
          Regenerate
        </Button>
        <div class="flex-1" />
        <Button variant="ghost" class="gap-2" :disabled="!imageUrl || isGenerating" @click="openInNewTab">
          <ExternalLink class="h-4 w-4" />
          Open
        </Button>
        <Button variant="ghost" class="gap-2" :disabled="!imageUrl || isGenerating" @click="downloadPng">
          <Download class="h-4 w-4" />
          Download
        </Button>
        <Button class="gap-2" :disabled="!imageUrl || isGenerating || !canUseClipboardImage" @click="copyPng">
          <Copy class="h-4 w-4" />
          Copy
        </Button>
      </DialogFooter>

      <!-- Offscreen capture node -->
      <div class="fixed left-[-10000px] top-0">
        <div
          ref="captureRef"
          class="w-[720px]"
          style="
            color-scheme: light;
            --background: #FAF8F6;
            --foreground: #1f2937;
            --card: #ffffff;
            --card-foreground: #1f2937;
            --popover: #ffffff;
            --popover-foreground: #1f2937;
            --primary: #f97316;
            --primary-foreground: #ffffff;
            --secondary: rgba(31, 41, 55, 0.06);
            --secondary-foreground: #1f2937;
            --muted: rgba(31, 41, 55, 0.06);
            --muted-foreground: rgba(31, 41, 55, 0.7);
            --accent: rgba(249, 115, 22, 0.12);
            --accent-foreground: #1f2937;
            --destructive: #dc2626;
            --destructive-foreground: #ffffff;
            --border: rgba(17, 24, 39, 0.12);
            --input: rgba(17, 24, 39, 0.12);
            --ring: rgba(31, 41, 55, 0.35);
          "
        >
          <ConversationShareCard
            :messages="messages"
            :page-title="pageTitle"
            :page-url="pageUrl"
            :generated-at="generatedAt"
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square, ImagePlus, X } from 'lucide-vue-next'
import ModelSelector from './ModelSelector.vue'

interface Props {
  isStreaming?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  send: [content: string, images?: string[]]
  stop: []
}>()

const inputText = ref('')
const images = ref<string[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() => {
  return (inputText.value.trim() || images.value.length > 0) && !props.disabled
})

function handleSend() {
  if (!canSend.value) return

  emit('send', inputText.value.trim(), images.value.length > 0 ? [...images.value] : undefined)
  inputText.value = ''
  images.value = []

  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handleStop() {
  emit('stop')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (props.isStreaming) {
      handleStop()
    } else {
      handleSend()
    }
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  // Auto-resize textarea
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
}

function handleImageUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = async (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return

    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (result && images.value.length < 4) {
          images.value.push(result)
        }
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}
</script>

<template>
  <div class="border-t bg-background p-3 space-y-3">
    <!-- Model Selector -->
    <ModelSelector />

    <!-- Image Preview -->
    <div v-if="images.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="relative group"
      >
        <img
          :src="img"
          class="w-16 h-16 rounded-md border object-cover"
          alt="Upload preview"
        >
        <Button
          variant="destructive"
          size="icon"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
          @click="removeImage(idx)"
        >
          <X class="w-3 h-3" />
        </Button>
      </div>
    </div>

    <!-- Input Area -->
    <div class="flex gap-2 items-end">
      <!-- Image Upload -->
      <Button
        variant="ghost"
        size="icon"
        class="h-9 w-9 flex-shrink-0"
        :disabled="images.length >= 4 || isStreaming"
        @click="handleImageUpload"
      >
        <ImagePlus class="w-4 h-4" />
      </Button>

      <!-- Text Input -->
      <Textarea
        ref="textareaRef"
        v-model="inputText"
        placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
        class="min-h-[40px] max-h-[200px] resize-none py-2.5"
        rows="1"
        :disabled="disabled"
        @keydown="handleKeydown"
        @input="handleInput"
      />

      <!-- Send/Stop Button -->
      <Button
        v-if="isStreaming"
        variant="destructive"
        size="icon"
        class="h-9 w-9 flex-shrink-0"
        @click="handleStop"
      >
        <Square class="w-4 h-4" />
      </Button>
      <Button
        v-else
        size="icon"
        class="h-9 w-9 flex-shrink-0"
        :disabled="!canSend"
        @click="handleSend"
      >
        <Send class="w-4 h-4" />
      </Button>
    </div>
  </div>
</template>

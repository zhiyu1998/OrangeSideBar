<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square, ImagePlus, X, Globe, Layers } from 'lucide-vue-next'
import ModelSelector from './ModelSelector.vue'
import BorderBeam from '@/components/inspira/ui/BorderBeam.vue'
import TabMentionPopover from './TabMentionPopover.vue'

interface Props {
  isStreaming?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

interface SelectedTab {
  type: 'all' | 'single'
  tabId?: number
  tabTitle?: string
}

const emit = defineEmits<{
  send: [content: string, images?: string[], tabs?: SelectedTab[]]
  stop: []
}>()

const inputText = ref('')
const images = ref<string[]>([])
const selectedTabs = ref<SelectedTab[]>([])
const showTabPopover = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() => {
  return (inputText.value.trim() || images.value.length > 0 || selectedTabs.value.length > 0) && !props.disabled
})

function handleSend() {
  if (!canSend.value) return

  emit('send', 
    inputText.value.trim(), 
    images.value.length > 0 ? [...images.value] : undefined,
    selectedTabs.value.length > 0 ? [...selectedTabs.value] : undefined
  )
  inputText.value = ''
  images.value = []
  selectedTabs.value = []

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
    if (showTabPopover.value) {
      showTabPopover.value = false
      return
    }
    if (props.isStreaming) {
      handleStop()
    } else {
      handleSend()
    }
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  
  // Detect @ for tab mention
  const value = target.value
  const cursorPosition = target.selectionStart || 0
  const textBeforeCursor = value.substring(0, cursorPosition)
  
  if (textBeforeCursor.endsWith('@')) {
    showTabPopover.value = true
  } else if (showTabPopover.value && !textBeforeCursor.includes('@')) {
    showTabPopover.value = false
  }

  // Auto-resize textarea
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
}

function handleTabSelect(tab: SelectedTab) {
  if (tab.type === 'all') {
    selectedTabs.value = [tab]
  } else {
    // Check if "All Tabs" is already selected
    if (selectedTabs.value.some(t => t.type === 'all')) {
      selectedTabs.value = []
    }
    // Limit to 10 tabs
    if (selectedTabs.value.length < 10) {
      if (!selectedTabs.value.find(t => t.tabId === tab.tabId)) {
        selectedTabs.value.push(tab)
      }
    }
  }
  
  // Remove the '@' from text
  const cursorPosition = textareaRef.value?.selectionStart || 0
  const value = inputText.value
  const before = value.substring(0, cursorPosition).replace(/@$/, '')
  const after = value.substring(cursorPosition)
  inputText.value = before + after
  
  showTabPopover.value = false
  textareaRef.value?.focus()
}

function removeTab(index: number) {
  selectedTabs.value.splice(index, 1)
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
  <div class="border-t bg-background p-3 space-y-3 relative">
    <!-- Tab Mention Popover -->
    <TabMentionPopover 
      v-if="showTabPopover"
      @select="handleTabSelect"
      @close="showTabPopover = false"
    />

    <!-- Model Selector -->
    <ModelSelector />

    <!-- Selected Tabs Pills -->
    <div v-if="selectedTabs.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="(tab, idx) in selectedTabs"
        :key="idx"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary animate-in zoom-in-95 duration-200"
      >
        <Layers v-if="tab.type === 'all'" class="w-3 h-3" />
        <Globe v-else class="w-3 h-3" />
        <span class="text-[10px] font-bold max-w-[150px] truncate uppercase tracking-wider">{{ tab.tabTitle }}</span>
        <button 
          class="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
          @click="removeTab(idx)"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

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
    <div class="relative group">
      <div class="flex gap-2 items-end relative z-10">
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
          class="min-h-[40px] max-h-[200px] resize-none py-2.5 bg-transparent border-none focus-visible:ring-0 shadow-none"
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

      <!-- Border Beam Effect -->
      <div
        class="absolute inset-0 rounded-md border bg-background pointer-events-none transition-colors group-focus-within:border-primary/50"
      >
        <BorderBeam
          v-if="!disabled"
          :size="150"
          :duration="10"
          :border-width="1.5"
          color-from="var(--primary)"
          color-to="var(--accent)"
        />
      </div>
    </div>
  </div>
</template>

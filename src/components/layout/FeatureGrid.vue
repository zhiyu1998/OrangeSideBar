<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'

type FeatureKey = 'summary' | 'translate' | 'pdf' | 'subtitles'

interface Props {
  loading?: boolean
  disabled?: boolean
}

defineProps<Props>()

// Use call signature syntax for defineEmits
const emit = defineEmits<{
  (e: 'summary'): void
  (e: 'translate'): void
  (e: 'pdf'): void
  (e: 'subtitles'): void
}>()

interface Feature {
  key: FeatureKey
  icon: string
  label: string
}

const features: Feature[] = [
  { key: 'summary', icon: '/summary.webp', label: 'Summary' },
  { key: 'translate', icon: '/trans.webp', label: 'Translate' },
  { key: 'pdf', icon: '/fileAnalyze.webp', label: 'PDF' },
  { key: 'subtitles', icon: '/subtitles.webp', label: 'Subtitles' },
]

function handleFeatureClick(key: FeatureKey) {
  if (key === 'summary') emit('summary')
  else if (key === 'translate') emit('translate')
  else if (key === 'pdf') emit('pdf')
  else if (key === 'subtitles') emit('subtitles')
}
</script>

<template>
  <div class="grid grid-cols-4 gap-2 p-3 flex-shrink-0">
    <Button
      v-for="feature in features"
      :key="feature.key"
      variant="outline"
      class="h-auto py-2.5 flex-col gap-1.5 hover:bg-accent/50 transition-colors"
      :disabled="loading || disabled"
      @click="handleFeatureClick(feature.key)"
    >
      <Loader2 v-if="loading" class="h-5 w-5 animate-spin" />
      <img v-else :src="feature.icon" :alt="feature.label" class="h-5 w-5 object-contain" />
      <span class="text-xs font-medium">{{ feature.label }}</span>
    </Button>
  </div>
</template>

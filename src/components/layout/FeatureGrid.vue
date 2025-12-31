<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import GlareCard from '@/components/inspira/ui/GlareCard.vue'

type FeatureKey = 'summary' | 'translate' | 'pdf' | 'subtitles'

interface Props {
  loading?: boolean
  disabled?: boolean
}

defineProps<Props>()

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
  description: string
}

const features: Feature[] = [
  { key: 'summary', icon: '/summary.webp', label: 'Summary', description: 'Summarize the current page content' },
  { key: 'translate', icon: '/trans.webp', label: 'Translate', description: 'Translate content to Chinese' },
  { key: 'pdf', icon: '/fileAnalyze.webp', label: 'PDF', description: 'Analyze PDF documents' },
  { key: 'subtitles', icon: '/subtitles.webp', label: 'Subtitles', description: 'Extract and summarize video subtitles' },
]

function handleFeatureClick(key: FeatureKey) {
  if (key === 'summary') emit('summary')
  else if (key === 'translate') emit('translate')
  else if (key === 'pdf') emit('pdf')
  else if (key === 'subtitles') emit('subtitles')
}
</script>

<template>
  <div class="flex flex-col gap-3 p-4 flex-shrink-0 bg-muted/30">
    <GlareCard
      v-for="feature in features"
      :key="feature.key"
      class="cursor-pointer group"
    >
      <div
        class="flex items-center gap-4 p-4 w-full h-full bg-background/50 hover:bg-accent/40 transition-colors"
        @click="handleFeatureClick(feature.key)"
      >
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Loader2 v-if="loading" class="h-6 w-6 animate-spin text-primary" />
          <img v-else :src="feature.icon" :alt="feature.label" class="h-6 w-6 object-contain" />
        </div>
        <div class="flex-1 text-left">
          <h4 class="text-sm font-semibold text-foreground">{{ feature.label }}</h4>
          <p class="text-xs text-muted-foreground line-clamp-1">{{ feature.description }}</p>
        </div>
      </div>
    </GlareCard>
  </div>
</template>

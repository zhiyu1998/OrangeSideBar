<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import GlareCard from '@/components/inspira/ui/GlareCard.vue'

type FeatureKey = 'summary' | 'translate' | 'pdf' | 'subtitles' | 'markdown'

interface Props {
  loading?: boolean
  disabled?: boolean
  collapsed?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'summary'): void
  (e: 'translate'): void
  (e: 'pdf'): void
  (e: 'subtitles'): void
  (e: 'markdown'): void
}>()

interface Feature {
  key: FeatureKey
  icon: string
  label: string
  shortLabel: string
  description: string
}

const features: Feature[] = [
  { key: 'summary', icon: '/summary.webp', label: 'Summary', shortLabel: 'Summ', description: 'Summarize the current page content' },
  { key: 'translate', icon: '/trans.webp', label: 'Translate', shortLabel: 'Trans', description: 'Translate content to Chinese' },
  { key: 'pdf', icon: '/fileAnalyze.webp', label: 'PDF', shortLabel: 'PDF', description: 'Analyze PDF documents' },
  { key: 'subtitles', icon: '/subtitles.webp', label: 'Subtitles', shortLabel: 'Subs', description: 'Extract and summarize video subtitles' },
  { key: 'markdown', icon: '/markdown.webp', label: 'Markdown', shortLabel: 'MD', description: 'Convert the current page to Markdown' },
]

function handleFeatureClick(key: FeatureKey) {
  if (key === 'summary') emit('summary')
  else if (key === 'translate') emit('translate')
  else if (key === 'pdf') emit('pdf')
  else if (key === 'subtitles') emit('subtitles')
  else if (key === 'markdown') emit('markdown')
}
</script>

<template>
  <div class="relative overflow-hidden transition-all duration-500 ease-in-out" :class="collapsed ? 'h-14' : 'flex-shrink-0'">
    <transition name="layout-switch" mode="out-in">
      <!-- Collapsed State: Horizontal Compact Bar -->
      <div v-if="collapsed" key="collapsed" class="flex items-center justify-around h-full px-4 gap-2 bg-muted/20 backdrop-blur-sm border-b">
        <button
          v-for="feature in features"
          :key="feature.key"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-accent/40 active:scale-95 transition-all group"
          :disabled="disabled || loading"
          @click="handleFeatureClick(feature.key)"
        >
          <div class="relative">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin text-primary" />
            <img v-else :src="feature.icon" :alt="feature.label" class="h-5 w-5 object-contain group-hover:scale-110 transition-transform" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground">{{ feature.shortLabel }}</span>
        </button>
      </div>

      <!-- Expanded State: Full Vertical GlareCard Grid -->
      <div v-else key="expanded" class="flex flex-col gap-3 p-4 bg-muted/30">
        <GlareCard
          v-for="feature in features"
          :key="feature.key"
          class="cursor-pointer group"
        >
          <div
            class="flex items-center gap-4 p-4 w-full h-full bg-background/50 hover:bg-accent/40 transition-colors"
            @click="handleFeatureClick(feature.key)"
          >
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
              <Loader2 v-if="loading" class="h-6 w-6 animate-spin text-primary" />
              <img v-else :src="feature.icon" :alt="feature.label" class="h-6 w-6 object-contain" />
            </div>
            <div class="flex-1 text-left">
              <h4 class="text-sm font-bold text-foreground tracking-tight">{{ feature.label }}</h4>
              <p class="text-[10px] text-muted-foreground line-clamp-1 uppercase tracking-tight opacity-70">{{ feature.description }}</p>
            </div>
          </div>
        </GlareCard>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.layout-switch-enter-active,
.layout-switch-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-switch-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.layout-switch-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(1.02);
}
</style>

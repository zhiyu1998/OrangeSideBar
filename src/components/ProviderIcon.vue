<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { classifyProviderIcon } from '@/lib/providerIcon'

interface Props {
  icon?: string | null
  alt?: string
}

const props = defineProps<Props>()

const imageLoadFailed = ref(false)
const parsed = computed(() => classifyProviderIcon(props.icon))

watch(
  () => props.icon,
  () => {
    imageLoadFailed.value = false
  }
)
</script>

<template>
  <div
    v-if="parsed?.type === 'svg'"
    class="w-full h-full flex items-center justify-center provider-logo"
    v-html="parsed.content"
  />
  <img
    v-else-if="parsed?.type === 'image' && !imageLoadFailed"
    :src="parsed.src"
    :alt="alt || ''"
    class="w-full h-full object-contain rounded-sm"
    @error="imageLoadFailed = true"
  />
  <slot v-else />
</template>

<style scoped>
:deep(.provider-logo svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

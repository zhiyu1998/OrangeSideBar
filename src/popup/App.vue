<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="p-4 min-w-[200px]">
    <div class="flex items-center gap-2 mb-4">
      <img src="/logo_48.png" class="w-8 h-8" alt="OrangeSideBar">
      <h1 class="text-lg font-semibold">OrangeSideBar</h1>
    </div>
    <p class="text-sm text-muted-foreground mb-4">
      AI-powered sidebar for webpage summarization
    </p>
    <Button class="w-full" @click="openSidePanel">
      Open Side Panel
    </Button>
  </div>
</template>

<script lang="ts">
function openSidePanel() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.sidePanel.open({ tabId: tabs[0].id })
    }
  })
}
</script>

<style scoped>
</style>

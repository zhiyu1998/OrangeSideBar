<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTabs, type TabInfo } from '@/composables/useTabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Layers, Globe, Search } from 'lucide-vue-next'

const { tabs, isLoading, refreshTabs } = useTabs()
const searchQuery = ref('')

const filteredTabs = computed(() => {
  if (!searchQuery.value) return tabs.value
  const query = searchQuery.value.toLowerCase()
  return tabs.value.filter(tab => 
    tab.title.toLowerCase().includes(query) || 
    tab.url.toLowerCase().includes(query)
  )
})

interface SelectedTab {
  type: 'all' | 'single'
  tabId?: number
  tabTitle?: string
}

const emit = defineEmits<{
  select: [tab: SelectedTab]
  close: []
}>()

function selectAll() {
  emit('select', { type: 'all', tabTitle: 'All Open Tabs' })
}

function selectTab(tab: TabInfo) {
  emit('select', { type: 'single', tabId: tab.id, tabTitle: tab.title })
}
</script>

<template>
  <div class="absolute bottom-full mb-2 left-0 w-80 bg-background/95 backdrop-blur-xl border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
    <div class="p-3 border-b space-y-3">
      <div class="flex items-center justify-between px-1">
        <h4 class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Context</h4>
        <button @click="refreshTabs" class="text-[10px] text-primary hover:underline font-bold">Refresh</button>
      </div>
      
      <div class="relative group">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search tabs..." 
          class="w-full h-8 pl-8 pr-3 bg-muted/50 border-none rounded-lg text-xs focus:ring-1 focus:ring-primary/30 outline-none"
          autofocus
        />
      </div>
    </div>

    <ScrollArea class="h-64">
      <div class="p-1.5 space-y-1">
        <!-- All Tabs Option -->
        <button
          class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/10 transition-all text-left group"
          @click="selectAll"
        >
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
            <Layers class="w-4 h-4" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs font-bold">Summarize All Tabs</span>
            <span class="text-[9px] text-muted-foreground uppercase tracking-tighter">{{ tabs.length }} Tabs currently open</span>
          </div>
        </button>

        <div class="h-px bg-border/50 mx-2 my-1" />

        <!-- Single Tab List -->
        <div v-if="isLoading" class="p-8 flex flex-col items-center gap-2 opacity-50">
          <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] font-bold uppercase tracking-widest">Loading Tabs</span>
        </div>

        <template v-else>
          <button
            v-for="tab in filteredTabs"
            :key="tab.id"
            class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all text-left group overflow-hidden"
            @click="selectTab(tab)"
          >
            <div class="w-8 h-8 rounded-lg bg-background border flex items-center justify-center flex-shrink-0 group-hover:border-primary/30 group-hover:scale-105 transition-all shadow-sm overflow-hidden">
              <img v-if="tab.favIconUrl" :src="tab.favIconUrl" class="w-4.5 h-4.5 object-contain" />
              <Globe v-else class="w-4 h-4 text-muted-foreground/40" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">{{ tab.title }}</span>
              <span class="text-[9px] text-muted-foreground truncate opacity-60 font-mono">{{ tab.url }}</span>
            </div>
          </button>

          <div v-if="filteredTabs.length === 0" class="p-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest italic">
            No tabs match your search
          </div>
        </template>
      </div>
    </ScrollArea>
    
    <div class="p-2 bg-muted/20 border-t flex justify-center">
      <p class="text-[9px] text-muted-foreground font-medium italic">Tip: Use @ to reference specific tabs</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Settings, 
  Cpu, 
  MessageSquare, 
  BarChart3, 
} from 'lucide-vue-next'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import ProviderSettings from '@/components/settings/ProviderSettings.vue'
import ModelConfig from '@/components/settings/ModelConfig.vue'
import PromptEditor from '@/components/settings/PromptEditor.vue'
import InteractiveGridPattern from '@/components/inspira/ui/InteractiveGridPattern.vue'
import { getVersionInfo } from '@/lib/version'

const settingsStore = useSettingsStore()
const activeTab = ref('general')
const currentVersion = ref('...')
const latestVersion = ref<string | null>(null)
const updateAvailable = ref(false)

const menuItems = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'providers', label: 'API Providers', icon: Cpu },
  { id: 'model', label: 'Model Parameters', icon: BarChart3 },
  { id: 'prompts', label: 'System Prompts', icon: MessageSquare },
]

onMounted(async () => {
  settingsStore.applyTheme()
  const versionInfo = await getVersionInfo()
  currentVersion.value = versionInfo.current
  latestVersion.value = versionInfo.latest
  updateAvailable.value = versionInfo.updateAvailable
})
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden relative selection:bg-orange-500/20">
    <!-- Interactive Background -->
    <InteractiveGridPattern 
      className="absolute inset-0 opacity-15"
      :width="80"
      :height="80"
      :squares="[40, 40]"
    />

    <!-- Sidebar -->
    <aside class="w-72 border-r bg-muted/40 backdrop-blur-xl z-20 flex flex-col shadow-2xl">
      <div class="p-8 mb-4 flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner">
          <img src="/logo_48.png" alt="OrangeSideBar" class="h-7 w-7 drop-shadow-md" />
        </div>
        <div>
          <h1 class="text-base font-bold tracking-tight">OrangeSideBar</h1>
          <p class="text-[10px] text-primary font-mono uppercase tracking-widest">{{ currentVersion }}</p>
          <p v-if="updateAvailable && latestVersion" class="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-widest">
            Latest {{ latestVersion }}
          </p>
        </div>
      </div>

      <nav class="flex-1 px-4 space-y-2">
        <div class="px-4 mb-4">
          <p class="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Core Settings</p>
        </div>
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all group relative overflow-hidden"
          :class="activeTab === item.id 
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
            : 'text-muted-foreground/70 hover:bg-accent/80 hover:text-foreground hover:scale-[1.01]'"
          @click="activeTab = item.id"
        >
          <component :is="item.icon" class="h-4.5 w-4.5" />
          {{ item.label }}
          <div v-if="activeTab === item.id" class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
        </button>
      </nav>

      <div class="p-6 border-t bg-muted/10">
        <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-muted/50">
          <div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Engine Ready</span>
        </div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 flex flex-col min-w-0 bg-background/40 backdrop-blur-sm z-10 relative">
      <header class="h-20 border-b flex items-center px-12 bg-background/30 backdrop-blur-md">
        <h2 class="text-sm font-bold capitalize flex items-center gap-3 text-muted-foreground/60">
          Settings <span class="text-muted-foreground/20 text-lg">/</span> 
          <span class="text-foreground text-base tracking-tight font-extrabold">{{ activeTab.replace('-', ' ') }}</span>
        </h2>
      </header>

      <ScrollArea class="flex-1 h-full min-h-0">
        <div class="max-w-6xl mx-auto p-12 lg:p-20">
          <transition 
            name="fade-slide" 
            mode="out-in"
          >
            <div :key="activeTab" class="w-full">
              <GeneralSettings v-if="activeTab === 'general'" />
              <ProviderSettings v-if="activeTab === 'providers'" />
              <ModelConfig v-if="activeTab === 'model'" />
              <PromptEditor v-if="activeTab === 'prompts'" />
            </div>
          </transition>
        </div>
      </ScrollArea>
    </main>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(1.02);
}
</style>

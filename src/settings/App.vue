<script setup lang="ts">
import { ref, onMounted, computed, watchEffect } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Settings,
  Cpu,
  MessageSquare,
  BarChart3,
  Info,
} from 'lucide-vue-next'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import ProviderSettings from '@/components/settings/ProviderSettings.vue'
import ModelConfig from '@/components/settings/ModelConfig.vue'
import PromptEditor from '@/components/settings/PromptEditor.vue'
import AboutSettings from '@/components/settings/AboutSettings.vue'
import InteractiveGridPattern from '@/components/inspira/ui/InteractiveGridPattern.vue'
import { getVersionInfo } from '@/lib/version'
import { useLocaleSync } from '@/locales/sync'
import { t } from '@/locales'

const settingsStore = useSettingsStore()
const activeTab = ref('general')
const currentVersion = ref('...')
const latestVersion = ref<string | null>(null)
const updateAvailable = ref(false)

// Keep vue-i18n locale in sync with the language setting
useLocaleSync()

const menuItems = [
  { id: 'general', labelKey: 'settings.menuGeneral', icon: Settings },
  { id: 'providers', labelKey: 'settings.menuProviders', icon: Cpu },
  { id: 'model', labelKey: 'settings.menuModel', icon: BarChart3 },
  { id: 'prompts', labelKey: 'settings.menuPrompts', icon: MessageSquare },
  { id: 'about', labelKey: 'settings.menuAbout', icon: Info },
]

const activeMenuLabel = computed(() => {
  return menuItems.find((item) => item.id === activeTab.value)?.labelKey ?? activeTab.value
})

// Localize the options page tab title
watchEffect(() => {
  document.title = t('settings.pageTitle')
})

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
      className="absolute inset-0 opacity-10"
      :width="80"
      :height="80"
      :squares="[40, 40]"
    />

    <!-- Sidebar -->
    <aside class="w-56 border-r bg-muted/40 backdrop-blur-xl z-20 flex flex-col shadow-sm">
      <div class="px-4 py-4 mb-1 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner flex-shrink-0">
          <img src="/logo_48.png" alt="OrangeSideBar" class="h-5 w-5 drop-shadow-sm" />
        </div>
        <div class="min-w-0">
          <h1 class="text-sm font-bold tracking-tight truncate">OrangeSideBar</h1>
          <p class="text-[10px] text-primary font-mono uppercase tracking-wider">{{ currentVersion }}</p>
          <p v-if="updateAvailable && latestVersion" class="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider truncate">
            {{ $t('settings.latestVersion', { version: latestVersion }) }}
          </p>
        </div>
      </div>

      <nav class="flex-1 px-2.5 space-y-1">
        <div class="px-2.5 mb-1.5">
          <p class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em]">{{ $t('settings.coreSettings') }}</p>
        </div>
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
          :class="activeTab === item.id
            ? 'bg-primary/12 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'"
          @click="activeTab = item.id"
        >
          <component :is="item.icon" class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">{{ $t(item.labelKey) }}</span>
        </button>
      </nav>

      <div class="p-3 border-t bg-muted/10">
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/50 border border-muted/50">
          <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] flex-shrink-0" />
          <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{{ $t('settings.engineReady') }}</span>
        </div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 flex flex-col min-w-0 bg-background/40 backdrop-blur-sm z-10 relative">
      <header class="h-12 border-b flex items-center px-6 bg-background/30 backdrop-blur-md flex-shrink-0">
        <h2 class="text-xs font-semibold capitalize flex items-center gap-2 text-muted-foreground/70">
          {{ $t('settings.breadcrumbSettings') }} <span class="text-muted-foreground/30 text-sm">/</span>
          <span class="text-foreground text-sm tracking-tight font-bold">{{ $t(activeMenuLabel) }}</span>
        </h2>
      </header>

      <ScrollArea class="flex-1 h-full min-h-0">
        <div class="max-w-4xl mx-auto px-6 py-6 lg:px-8 lg:py-7">
          <transition 
            name="fade-slide" 
            mode="out-in"
          >
            <div :key="activeTab" class="w-full">
              <GeneralSettings v-if="activeTab === 'general'" />
              <ProviderSettings v-if="activeTab === 'providers'" />
              <ModelConfig v-if="activeTab === 'model'" />
              <PromptEditor v-if="activeTab === 'prompts'" />
              <AboutSettings v-if="activeTab === 'about'" />
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

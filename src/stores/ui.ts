import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // State
  const sidebarCollapsed = ref(false)
  const quickActionsExpanded = ref(true)
  const activeFeature = ref<string | null>(null)
  const isSettingsOpen = ref(false)

  // Actions
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed
  }

  function toggleQuickActions() {
    quickActionsExpanded.value = !quickActionsExpanded.value
  }

  function setActiveFeature(feature: string | null) {
    activeFeature.value = feature
  }

  function openSettings() {
    isSettingsOpen.value = true
  }

  function closeSettings() {
    isSettingsOpen.value = false
  }

  function toggleSettings() {
    isSettingsOpen.value = !isSettingsOpen.value
  }

  return {
    // State
    sidebarCollapsed,
    quickActionsExpanded,
    activeFeature,
    isSettingsOpen,
    // Actions
    toggleSidebar,
    setSidebarCollapsed,
    toggleQuickActions,
    setActiveFeature,
    openSettings,
    closeSettings,
    toggleSettings,
  }
})

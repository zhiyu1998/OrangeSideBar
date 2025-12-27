/**
 * useTheme Composable
 * Manages theme (light/dark/system) across the application
 */

import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type { Theme } from '@/types/settings'

export function useTheme() {
  const settingsStore = useSettingsStore()

  // Computed
  const theme = computed(() => settingsStore.theme)
  const isDark = computed(() => settingsStore.isDarkMode)

  // Media query for system preference
  let mediaQuery: MediaQueryList | null = null

  /**
   * Handle system theme change
   */
  function handleSystemThemeChange() {
    if (settingsStore.theme === 'system') {
      settingsStore.applyTheme()
    }
  }

  /**
   * Set theme
   */
  function setTheme(newTheme: Theme) {
    settingsStore.setTheme(newTheme)
  }

  /**
   * Toggle between light and dark
   */
  function toggleTheme() {
    if (isDark.value) {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  /**
   * Cycle through themes: light -> dark -> system -> light
   */
  function cycleTheme() {
    const order: Theme[] = ['light', 'dark', 'system']
    const currentIndex = order.indexOf(theme.value)
    const nextIndex = (currentIndex + 1) % order.length
    setTheme(order[nextIndex])
  }

  // Setup on mount
  onMounted(() => {
    // Listen for system theme changes
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    // Apply initial theme
    settingsStore.applyTheme()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  })

  // Watch for theme changes
  watch(theme, () => {
    settingsStore.applyTheme()
  })

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    cycleTheme,
  }
}

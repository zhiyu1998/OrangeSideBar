/**
 * Keeps the vue-i18n locale in sync with the settings store.
 * Call once from each root App component (sidepanel / settings / popup).
 */
import { watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { setAppLocale } from './index'

export function useLocaleSync() {
  const settingsStore = useSettingsStore()

  watch(
    () => settingsStore.resolvedLanguage,
    (locale) => {
      setAppLocale(locale)
    },
    { immediate: true }
  )
}

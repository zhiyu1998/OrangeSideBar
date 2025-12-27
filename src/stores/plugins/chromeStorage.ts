import type { PiniaPluginContext } from 'pinia'
import { watch } from 'vue'

const STORAGE_PREFIX = 'orangesidebar_'

/**
 * Chrome Storage sync plugin for Pinia
 * Automatically syncs store state with chrome.storage.local
 */
export function chromeStoragePlugin({ store }: PiniaPluginContext) {
  const storageKey = `${STORAGE_PREFIX}${store.$id}`

  // Load initial state from Chrome storage
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(storageKey, (result) => {
      if (result[storageKey]) {
        try {
          store.$patch(result[storageKey])
        } catch (error) {
          console.warn(`Failed to restore state for store "${store.$id}":`, error)
        }
      }
    })

    // Watch for state changes and sync to Chrome storage
    watch(
      () => store.$state,
      (state) => {
        chrome.storage.local.set({ [storageKey]: JSON.parse(JSON.stringify(state)) })
      },
      { deep: true }
    )
  }
}

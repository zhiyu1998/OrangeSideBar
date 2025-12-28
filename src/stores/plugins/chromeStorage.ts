import type { PiniaPluginContext, StateTree } from 'pinia'
import { watch } from 'vue'

const STORAGE_PREFIX = 'orangesidebar_'

/**
 * Keys that should NOT be persisted (runtime-only state)
 * These are transient states that shouldn't survive a page reload
 */
const EXCLUDED_KEYS: Record<string, string[]> = {
  chat: ['isStreaming', 'abortController'],
  settings: ['isLoadingModels'],
}

/**
 * Filter out non-serializable or transient state
 */
function filterState(storeId: string, state: StateTree): Partial<StateTree> {
  const excludedKeys = EXCLUDED_KEYS[storeId] || []
  const filtered: Partial<StateTree> = {}

  for (const key in state) {
    if (!excludedKeys.includes(key)) {
      filtered[key] = state[key]
    }
  }

  return filtered
}

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
          // Filter out excluded keys before patching
          const filteredState = filterState(store.$id, result[storageKey] as StateTree)
          store.$patch(filteredState)
        } catch (error) {
          console.warn(`Failed to restore state for store "${store.$id}":`, error)
        }
      }
    })

    // Watch for state changes and sync to Chrome storage
    watch(
      () => store.$state,
      (state) => {
        // Filter out non-serializable and transient state before saving
        const filteredState = filterState(store.$id, state)
        try {
          chrome.storage.local.set({ [storageKey]: JSON.parse(JSON.stringify(filteredState)) })
        } catch (error) {
          console.warn(`Failed to save state for store "${store.$id}":`, error)
        }
      },
      { deep: true }
    )
  }
}

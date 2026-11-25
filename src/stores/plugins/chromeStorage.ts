import type { PiniaPluginContext, StateTree } from 'pinia'
import { watch } from 'vue'

const STORAGE_PREFIX = 'orangesidebar_'

/**
 * Keys that should NOT be persisted (runtime-only state)
 * These are transient states that shouldn't survive a page reload
 */
const EXCLUDED_KEYS: Record<string, string[]> = {
  chat: ['currentSessionId', 'isStreaming', 'abortController'],
  settings: ['isLoadingModels'],
}

const hydrationPromises = new Map<string, Promise<void>>()

export function waitForStoreHydration(storeId: string): Promise<void> {
  return hydrationPromises.get(storeId) ?? Promise.resolve()
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
  let suppressSaves = 0

  function serializeFilteredState(): string | null {
    try {
      return JSON.stringify(filterState(store.$id, store.$state))
    } catch {
      return null
    }
  }

  let lastSavedSnapshot: string | null = serializeFilteredState()

  let resolveHydration!: () => void
  const hydrationPromise = new Promise<void>((resolve) => {
    resolveHydration = resolve
  })
  hydrationPromises.set(store.$id, hydrationPromise)

  function withSuppressedSave(fn: () => void) {
    suppressSaves += 1
    try {
      fn()
    } finally {
      // Ensure any reactive watchers triggered by $patch don't immediately write back to storage
      setTimeout(() => {
        suppressSaves = Math.max(0, suppressSaves - 1)
      }, 0)
    }
  }

  // Load initial state from Chrome storage
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(storageKey, (result) => {
      try {
        if (result[storageKey]) {
          withSuppressedSave(() => {
            const filteredState = filterState(store.$id, result[storageKey] as StateTree)
            store.$patch(filteredState)
            lastSavedSnapshot = serializeFilteredState()
          })
        } else {
          lastSavedSnapshot = serializeFilteredState()
        }
      } catch (error) {
        console.warn(`Failed to restore state for store "${store.$id}":`, error)
      } finally {
        resolveHydration()
      }
    })

    // Sync updates across extension contexts (e.g. settings page <-> sidepanel)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return
      const change = changes[storageKey]
      if (!change?.newValue) return

      try {
        withSuppressedSave(() => {
          const filteredState = filterState(store.$id, change.newValue as StateTree)
          store.$patch(filteredState)
          lastSavedSnapshot = serializeFilteredState()
        })
      } catch (error) {
        console.warn(`Failed to sync state for store "${store.$id}":`, error)
      }
    })

    // Watch for state changes and sync to Chrome storage
    watch(
      () => store.$state,
      (state) => {
        if (suppressSaves > 0) return
        // Filter out non-serializable and transient state before saving
        const filteredState = filterState(store.$id, state)
        try {
          const serialized = JSON.stringify(filteredState)
          if (serialized === lastSavedSnapshot) return
          lastSavedSnapshot = serialized
          chrome.storage.local.set({ [storageKey]: JSON.parse(serialized) })
        } catch (error) {
          console.warn(`Failed to save state for store "${store.$id}":`, error)
        }
      },
      { deep: true }
    )
  } else {
    resolveHydration()
  }
}

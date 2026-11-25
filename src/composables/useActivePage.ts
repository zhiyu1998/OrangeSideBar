import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface ActivePageSnapshot {
  windowId: number | null
  tabId: number | null
  pageKey: string | null
}

export interface UseActivePageOptions {
  onPageChange: (next: ActivePageSnapshot, prev: ActivePageSnapshot) => void
  onReady?: (initial: ActivePageSnapshot) => void
}

/**
 * Normalize a tab URL into a stable page key so same-page scrolling,
 * anchor jumps, or video timestamp updates do not trigger false resets.
 */
export function normalizePageKey(rawUrl?: string | null): string | null {
  if (!rawUrl) {
    return null
  }

  try {
    const parsed = new URL(rawUrl)

    // Preserve hash-based SPA routes (#/... or #!/...), clear plain anchor fragments
    if (!parsed.hash.startsWith('#/') && !parsed.hash.startsWith('#!')) {
      parsed.hash = ''
    }

    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'linux.do' || hostname.endsWith('.linux.do')) {
      // Match /t/<id>/<post> before /t/<slug>/<id>/<post> so numeric IDs are not treated as slugs
      if (/^(\/t\/\d+)(?:\/\d+)?\/?$/.test(parsed.pathname)) {
        parsed.pathname = parsed.pathname.replace(/^(\/t\/\d+)(?:\/\d+)?\/?$/, '$1')
      } else if (/^(\/t\/[^/]+\/\d+)(?:\/\d+)?\/?$/.test(parsed.pathname)) {
        parsed.pathname = parsed.pathname.replace(/^(\/t\/[^/]+\/\d+)(?:\/\d+)?\/?$/, '$1')
      } else if (/^(\/topic\/\d+)(?:\/\d+)?\/?$/.test(parsed.pathname)) {
        parsed.pathname = parsed.pathname.replace(/^(\/topic\/\d+)(?:\/\d+)?\/?$/, '$1')
      }
    } else if (
      ((hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) && parsed.pathname === '/watch') ||
      ((hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) && parsed.pathname.startsWith('/video/'))
    ) {
      parsed.searchParams.delete('t')
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

export function useActivePage(options: UseActivePageOptions) {
  let windowId: number | null = null
  const activeTabId = ref<number | null>(null)
  const activePageKey = ref<string | null>(null)
  let pageGeneration = 0
  let eventSeq = 0
  let isDisposed = false
  let isInitialized = false
  let listenersAttached = false

  function getSnapshot(): ActivePageSnapshot {
    return {
      windowId,
      tabId: activeTabId.value,
      pageKey: activePageKey.value,
    }
  }

  function getPageGeneration(): number {
    return pageGeneration
  }

  function handleTabActivated(activeInfo: chrome.tabs.OnActivatedInfo) {
    if (!isInitialized || isDisposed) return
    if (windowId !== null && activeInfo.windowId !== windowId) return

    const seq = ++eventSeq
    const prev = getSnapshot()

    if (activeInfo.tabId !== activeTabId.value) {
      activeTabId.value = activeInfo.tabId
      activePageKey.value = null
      pageGeneration += 1
      options.onPageChange(getSnapshot(), prev)
    }

    void chrome.tabs.get(activeInfo.tabId).then(
      (tab) => {
        if (isDisposed || seq !== eventSeq) return
        const nextPageKey = normalizePageKey(tab.url || tab.pendingUrl)

        if (
          prev.tabId === activeInfo.tabId &&
          nextPageKey &&
          activePageKey.value &&
          nextPageKey !== activePageKey.value
        ) {
          const beforeUrlChange = getSnapshot()
          activePageKey.value = nextPageKey
          pageGeneration += 1
          options.onPageChange(getSnapshot(), beforeUrlChange)
          return
        }

        activePageKey.value = nextPageKey
      },
      () => {
        // Tab may have been closed before details resolved
      }
    )
  }

  function handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab
  ) {
    if (!isInitialized || isDisposed) return
    if (windowId !== null && tab.windowId !== windowId) return
    if (!tab.active || !changeInfo.url) return

    const nextPageKey = normalizePageKey(changeInfo.url)
    if (!nextPageKey) return

    eventSeq += 1

    if (tabId !== activeTabId.value) {
      const prev = getSnapshot()
      activeTabId.value = tabId
      activePageKey.value = nextPageKey
      pageGeneration += 1
      options.onPageChange(getSnapshot(), prev)
      return
    }

    // First URL update right after tab activation adopts the key without firing a duplicate reset
    if (activePageKey.value === null) {
      activePageKey.value = nextPageKey
      return
    }

    if (nextPageKey !== activePageKey.value) {
      const prev = getSnapshot()
      activePageKey.value = nextPageKey
      pageGeneration += 1
      options.onPageChange(getSnapshot(), prev)
    }
  }

  function handleTabReplaced(addedTabId: number, removedTabId: number) {
    if (!isInitialized || isDisposed) return
    if (removedTabId !== activeTabId.value) return

    const seq = ++eventSeq
    const prev = getSnapshot()
    activeTabId.value = addedTabId

    void chrome.tabs.get(addedTabId).then(
      (tab) => {
        if (isDisposed || seq !== eventSeq) return
        const nextPageKey = normalizePageKey(tab.url || tab.pendingUrl)

        if (nextPageKey && nextPageKey !== activePageKey.value) {
          activePageKey.value = nextPageKey
          pageGeneration += 1
          options.onPageChange(getSnapshot(), prev)
        } else if (nextPageKey) {
          activePageKey.value = nextPageKey
        }
      },
      () => {
        // Replacement tab may have closed before details resolved
      }
    )
  }

  onMounted(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      isInitialized = true
      options.onReady?.(getSnapshot())
      return
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (isDisposed) return

      if (tab) {
        windowId = tab.windowId ?? null
        activeTabId.value = tab.id ?? null
        activePageKey.value = normalizePageKey(tab.url || tab.pendingUrl)
      } else if (chrome.windows?.getCurrent) {
        const currentWindow = await chrome.windows.getCurrent()
        if (isDisposed) return
        windowId = currentWindow.id ?? null
      }
    } catch (error) {
      console.warn('[useActivePage] Failed to resolve initial active tab:', error)
    }

    if (isDisposed) return

    isInitialized = true
    chrome.tabs.onActivated.addListener(handleTabActivated)
    chrome.tabs.onUpdated.addListener(handleTabUpdated)
    chrome.tabs.onReplaced.addListener(handleTabReplaced)
    listenersAttached = true

    options.onReady?.(getSnapshot())
  })

  onBeforeUnmount(() => {
    isDisposed = true
    if (listenersAttached && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.removeListener(handleTabActivated)
      chrome.tabs.onUpdated.removeListener(handleTabUpdated)
      chrome.tabs.onReplaced.removeListener(handleTabReplaced)
      listenersAttached = false
    }
  })

  return {
    activeTabId,
    activePageKey,
    getSnapshot,
    getPageGeneration,
  }
}

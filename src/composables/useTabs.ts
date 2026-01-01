import { ref, onMounted } from 'vue'

export interface TabInfo {
    id: number
    title: string
    url: string
    favIconUrl?: string
}

export function useTabs() {
    const tabs = ref<TabInfo[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    async function refreshTabs() {
        isLoading.value = true
        error.value = null
        try {
            const allTabs = await chrome.tabs.query({ currentWindow: true })
            tabs.value = allTabs
                .filter(tab => tab.id !== undefined && tab.title !== undefined)
                .map(tab => ({
                    id: tab.id!,
                    title: tab.title || 'Untitled',
                    url: tab.url || '',
                    favIconUrl: tab.favIconUrl
                }))
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch tabs'
            console.error('[useTabs] Error:', err)
        } finally {
            isLoading.value = false
        }
    }

    onMounted(() => {
        refreshTabs()
    })

    return {
        tabs,
        isLoading,
        error,
        refreshTabs
    }
}

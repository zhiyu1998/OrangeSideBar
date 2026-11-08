/**
 * Framework-agnostic i18n for extension contexts without a Vue app
 * (background service worker, content scripts, offscreen document).
 *
 * Shares the same message catalogs as the Vue apps and follows the
 * user's in-app language setting persisted under `orangesidebar_settings`,
 * falling back to the browser UI language.
 */
import enMessages from './en.json'
import zhCnMessages from './zh-CN.json'
import { STORAGE_SETTINGS_KEY, detectBrowserLocale } from './index'
import type { Locale } from '@/types/settings'

type MessageTree = Record<string, unknown>

const catalogs: Record<Locale, MessageTree> = {
  en: enMessages as MessageTree,
  'zh-CN': zhCnMessages as MessageTree,
}

let currentLocale: Locale | null = null
let storageListenerAttached = false

function resolveStoredLocale(value: unknown): Locale | null {
  return value === 'en' || value === 'zh-CN' ? value : null
}

async function loadLocale(): Promise<Locale> {
  let locale = detectBrowserLocale()
  try {
    const result = await chrome.storage.local.get(STORAGE_SETTINGS_KEY)
    const settings = result?.[STORAGE_SETTINGS_KEY] as { language?: unknown } | undefined
    const stored = resolveStoredLocale(settings?.language)
    if (stored) locale = stored
  } catch {
    // Storage unavailable (e.g. restricted context) — keep browser locale.
  }
  currentLocale = locale
  return locale
}

/**
 * Initialize the host locale. Await at startup when accurate titles are
 * needed immediately (e.g. context menus); otherwise fire-and-forget.
 */
export async function initHostLocale(): Promise<Locale> {
  const locale = await loadLocale()

  if (!storageListenerAttached && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    storageListenerAttached = true
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      const next = changes[STORAGE_SETTINGS_KEY]?.newValue as { language?: unknown } | undefined
      if (!next || !('language' in next)) return
      const stored = resolveStoredLocale(next.language)
      currentLocale = stored ?? detectBrowserLocale()
    })
  }

  return locale
}

export function getHostLocale(): Locale {
  return currentLocale ?? detectBrowserLocale()
}

function lookup(tree: MessageTree, path: string): string | undefined {
  let node: unknown = tree
  for (const part of path.split('.')) {
    if (node && typeof node === 'object' && part in (node as MessageTree)) {
      node = (node as MessageTree)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

/** Translate in non-Vue contexts. Falls back to English, then the raw key. */
export function hostT(key: string, params?: Record<string, string | number>): string {
  const locale = getHostLocale()
  const template = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

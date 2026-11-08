/**
 * vue-i18n singleton shared by all extension Vue surfaces (sidepanel / settings / popup).
 *
 * Message catalogs live in `src/locales/en.json` and `src/locales/zh-CN.json` and are
 * precompiled at build time via @intlify/unplugin-vue-i18n (configured in vite.config.ts).
 *
 * Non-Vue contexts (background / content / offscreen) must use `host.ts` instead.
 */
import { createI18n } from 'vue-i18n'
import en from './en.json'
import zhCN from './zh-CN.json'
import type { Language, Locale } from '@/types/settings'

export const STORAGE_SETTINGS_KEY = 'orangesidebar_settings'

/** Best-effort detection of the browser UI language. */
export function detectBrowserLocale(): Locale {
  try {
    const uiLocale = chrome?.i18n?.getUILanguage?.() || navigator.language || 'en'
    return uiLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
  } catch {
    return 'en'
  }
}

/** Resolve the settings value ('auto' | 'en' | 'zh-CN') to a concrete locale. */
export function resolveLocale(language: Language): Locale {
  return language === 'auto' ? detectBrowserLocale() : language
}

export const i18n = createI18n({
  legacy: false,
  locale: detectBrowserLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
})

/** Current locale of the vue-i18n singleton (reactive). */
export function getAppLocale(): Locale {
  return i18n.global.locale.value as Locale
}

export function setAppLocale(locale: Locale) {
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

/**
 * Translate via the vue-i18n singleton. Safe to call outside of component
 * setup contexts (stores, composables); templates should use `$t` instead.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.global.t(key, params ?? {})
}

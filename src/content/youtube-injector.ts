/**
 * YouTube Subtitle Injector
 * Runs in MAIN world context to intercept subtitle requests
 *
 * This script needs to be injected into the page context (MAIN world)
 * to intercept fetch and XHR requests for YouTube subtitle data
 */

;(function () {
  'use strict'

  // Prevent duplicate injection
  if ((window as Window & { __ytSubDownloaderInstalled?: boolean }).__ytSubDownloaderInstalled) return
  ;(window as Window & { __ytSubDownloaderInstalled?: boolean }).__ytSubDownloaderInstalled = true

  // Subtitle cache interface
  interface SubtitleCacheEntry {
    data: unknown
    url: string
    time: number
  }

  interface SubtitleCache {
    [key: string]: SubtitleCacheEntry
  }

  // Global cache
  ;(window as Window & { __ytSubtitleCache?: SubtitleCache }).__ytSubtitleCache = {}

  const getCache = (): SubtitleCache => {
    return (window as Window & { __ytSubtitleCache?: SubtitleCache }).__ytSubtitleCache || {}
  }

  // Check if URL is a subtitle request
  function isSubtitleUrl(url: string | URL | Request | undefined): boolean {
    if (!url) return false
    const urlString = typeof url === 'string' ? url : url instanceof Request ? url.url : url.toString()
    return urlString.includes('timedtext')
  }

  // Extract language key from URL
  function getLangKey(url: string): string {
    try {
      const u = new URL(url, location.origin)
      const lang = u.searchParams.get('lang') || 'unknown'
      const kind = u.searchParams.get('kind')
      return kind === 'asr' ? lang + '_auto' : lang
    } catch {
      return 'unknown'
    }
  }

  // Save subtitle to cache
  function saveSubtitle(url: string, data: unknown): void {
    const key = getLangKey(url)
    const cache = getCache()
    cache[key] = {
      data: data,
      url: url,
      time: Date.now(),
    }
  }

  // Intercept Fetch
  const originalFetch = window.fetch
  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const response = await originalFetch.apply(this, args)

    const url = args[0] instanceof Request ? args[0].url : args[0]
    if (isSubtitleUrl(url)) {
      try {
        const clone = response.clone()
        const text = await clone.text()
        if (text.length > 100) {
          const json = JSON.parse(text)
          if (json.events) {
            saveSubtitle(typeof url === 'string' ? url : url.toString(), json)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return response
  }

  // Intercept XHR
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  interface ExtendedXHR extends XMLHttpRequest {
    _url?: string
  }

  XMLHttpRequest.prototype.open = function (
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    this._url = typeof url === 'string' ? url : url.toString()
    return originalOpen.call(this, method, url, async, username, password)
  }

  XMLHttpRequest.prototype.send = function (this: ExtendedXHR): void {
    if (isSubtitleUrl(this._url)) {
      this.addEventListener('load', function (this: ExtendedXHR) {
        try {
          if (this.responseText && this.responseText.length > 100) {
            const json = JSON.parse(this.responseText)
            if (json.events) {
              saveSubtitle(this._url || '', json)
            }
          }
        } catch {
          // Ignore parse errors
        }
      })
    }
    return originalSend.apply(this, arguments as unknown as [Document | XMLHttpRequestBodyInit | null | undefined])
  }
})()

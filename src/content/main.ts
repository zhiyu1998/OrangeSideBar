/**
 * Content Script
 * Handles page content extraction and message passing
 */

import { Readability } from '@mozilla/readability'
import type { ExtractedContent, ContentResponse } from '@/lib/content/types'

console.log('[OrangeSideBar] Content script loaded')

/**
 * Extract content from current page using Readability
 */
function extractContent(): ExtractedContent | null {
  try {
    const documentClone = document.cloneNode(true) as Document

    // Pre-strip scripts before Readability to avoid parsing issues
    const docBody = documentClone.body
    if (docBody) {
      const unwantedElements = docBody.querySelectorAll('script, style, noscript')
      unwantedElements.forEach((el) => el.remove())
    }

    const reader = new Readability(documentClone, {
      charThreshold: 20,
      keepClasses: false,
    })

    const article = reader.parse()

    if (!article) {
      return null
    }

    return {
      title: article.title || document.title || 'Untitled',
      content: article.content || '',
      textContent: article.textContent || '',
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
      url: window.location.href,
      length: article.length || 0,
      type: 'web',
    }
  } catch (error) {
    console.error('[OrangeSideBar] Failed to extract content:', error)
    return null
  }
}

/**
 * Remove script, style, noscript elements from a cloned element
 */
function removeScriptElements(element: HTMLElement): void {
  const unwantedElements = element.querySelectorAll('script, style, noscript, svg, iframe')
  unwantedElements.forEach((el) => el.remove())
}

/**
 * Get clean text content from an element (with scripts removed)
 */
function getCleanTextFromElement(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement
  removeScriptElements(clone)
  return clone.textContent?.trim() || ''
}

/**
 * Get plain text content from page
 */
function getTextContent(): string {
  try {
    // Clone document and pre-strip scripts before Readability
    const documentClone = document.cloneNode(true) as Document
    const docBody = documentClone.body
    if (docBody) {
      removeScriptElements(docBody)
    }

    const reader = new Readability(documentClone)
    const article = reader.parse()

    if (article) {
      return `${article.title}\n\n${article.textContent}`
    }

    // Fallback: use cleaned body text
    return getCleanTextFromElement(document.body)
  } catch {
    // Even on error, return cleaned body text (not raw textContent)
    return getCleanTextFromElement(document.body)
  }
}

/**
 * Check if current page is YouTube
 */
function isYouTubePage(): boolean {
  return (
    window.location.hostname === 'www.youtube.com' ||
    window.location.hostname === 'youtube.com' ||
    window.location.hostname === 'youtu.be' ||
    window.location.hostname === 'm.youtube.com'
  )
}

/**
 * Check if current page is Bilibili
 */
function isBilibiliPage(): boolean {
  return window.location.hostname.includes('bilibili.com')
}

/**
 * Get YouTube subtitle cache from window
 */
function getYouTubeSubtitleCache(): { installed: boolean; cache: Record<string, unknown> } {
  const win = window as Window & {
    __ytSubDownloaderInstalled?: boolean
    __ytSubtitleCache?: Record<string, unknown>
  }

  return {
    installed: !!win.__ytSubDownloaderInstalled,
    cache: win.__ytSubtitleCache || {},
  }
}

/**
 * Inject YouTube subtitle interceptor
 */
function injectYouTubeInterceptor(): void {
  if (!isYouTubePage()) return

  // Check if already injected
  const win = window as Window & { __ytSubDownloaderInstalled?: boolean }
  if (win.__ytSubDownloaderInstalled) return

  // Create script element to inject into page context
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('src/content/youtube-injector.ts')
  script.type = 'module'
  ;(document.head || document.documentElement).appendChild(script)
  script.onload = () => script.remove()

  console.log('[OrangeSideBar] YouTube subtitle interceptor injected')
}

// Inject interceptor on YouTube pages
if (isYouTubePage()) {
  injectYouTubeInterceptor()
}

/**
 * Handle messages from background script or sidepanel
 */
chrome.runtime.onMessage.addListener(
  (
    message: { action: string; data?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ContentResponse) => void
  ) => {
    switch (message.action) {
      case 'PING': {
        // Used to check if content script is loaded
        sendResponse({ success: true, data: 'pong' })
        break
      }

      case 'FETCH_PAGE_CONTENT': {
        const content = extractContent()
        if (content) {
          sendResponse({ success: true, data: content })
        } else {
          sendResponse({ success: false, error: 'Failed to extract page content' })
        }
        break
      }

      case 'FETCH_TEXT_CONTENT': {
        const text = getTextContent()
        sendResponse({ success: true, data: text })
        break
      }

      case 'GET_PAGE_URL': {
        sendResponse({ success: true, data: window.location.href })
        break
      }

      case 'GET_VIDEO_INFO': {
        const isYouTube = isYouTubePage()
        const isBilibili = isBilibiliPage()

        if (isYouTube || isBilibili) {
          sendResponse({
            success: true,
            data: {
              url: window.location.href,
              isYouTube,
              isBilibili,
              title: document.title,
            },
          })
        } else {
          sendResponse({
            success: false,
            error: 'Not a supported video page (YouTube or Bilibili only)',
          })
        }
        break
      }

      case 'GET_YOUTUBE_SUBTITLES': {
        if (!isYouTubePage()) {
          sendResponse({ success: false, error: 'Not a YouTube page' })
          break
        }

        const subtitleInfo = getYouTubeSubtitleCache()
        sendResponse({ success: true, data: subtitleInfo })
        break
      }

      default:
        console.log('[OrangeSideBar] Unknown action:', message.action)
    }

    return true // Keep channel open for async response
  }
)

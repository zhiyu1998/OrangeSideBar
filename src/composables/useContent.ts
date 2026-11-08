/**
 * Content extraction composable
 * Provides unified interface for extracting content from various sources
 */

import { ref } from 'vue'
import type { ExtractedContent, ContentType, PDFContent } from '@/lib/content/types'
import { extractFromPDFFile, extractFromPDFUrl } from '@/lib/content/pdf'
import { t } from '@/locales'
import {
  isYouTubeUrl,
  isBilibiliUrl,
  isVideoUrl,
  extractBilibiliSubtitles,
  formatYouTubeSubtitles,
  type SubtitleFormat,
  type YouTubeSubtitleResponse,
} from '@/lib/content/youtube'

// YouTube subtitle cache interface
interface SubtitleCacheEntry {
  data: unknown
  url: string
  time: number
}

interface SubtitleCache {
  [key: string]: SubtitleCacheEntry
}

type ContentScriptResponse<T> = { success: true; data: T } | { success: false; error?: string }

export function useContent() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function isLinuxDoHost(hostname: string): boolean {
    return hostname === 'linux.do' || hostname.endsWith('.linux.do')
  }

  /**
   * Detect content type from URL
   */
  function detectContentType(url: string): ContentType {
    if (isYouTubeUrl(url) || isBilibiliUrl(url)) {
      return 'youtube'
    }
    if (isPDFUrl(url)) {
      return 'pdf'
    }
    return 'web'
  }

  /**
   * Check if URL is a PDF
   */
  function isPDFUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.endsWith('.pdf')) {
      return true
    }
    // Handle arxiv PDF URLs
    const pattern = /^https?:\/\/arxiv\.org\/pdf\/\d+\.\d+(v\d+)?$/
    return pattern.test(url)
  }

  /**
   * Extract content from current tab
   */
  async function extractCurrentTab(): Promise<ExtractedContent | null> {
    isLoading.value = true
    error.value = null

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        throw new Error(t('errors.noActiveTab'))
      }

      const contentType = detectContentType(tab.url)

      if (contentType === 'pdf') {
        const pdfContent = await extractFromPDFUrl(tab.url)
        if (!pdfContent) {
          throw new Error(t('errors.failedExtractPdf'))
        }
        return {
          title: pdfContent.title,
          content: pdfContent.content,
          textContent: pdfContent.content,
          url: tab.url,
          length: pdfContent.content.length,
          type: 'pdf',
        }
      }

      // For web pages, send message to content script (injected via manifest)
      let response: ContentScriptResponse<ExtractedContent> | undefined
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'FETCH_PAGE_CONTENT',
        })
      } catch (err) {
        // Content script not loaded - likely a restricted page or needs refresh
        throw new Error(t('errors.scriptNotAvailable'))
      }

      if (!response || !response.success) {
        throw new Error(response?.error || t('errors.failedExtractPage'))
      }

      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('errors.unknownError')
      console.error('[useContent] extractCurrentTab error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract text content from current tab
   */
  async function extractCurrentTabText(): Promise<string | null> {
    isLoading.value = true
    error.value = null

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        throw new Error(t('errors.noActiveTab'))
      }

      const contentType = detectContentType(tab.url)

      if (contentType === 'pdf') {
        const pdfContent = await extractFromPDFUrl(tab.url)
        return pdfContent?.content || null
      }

      // For web pages, send message to content script (injected via manifest)
      let response: ContentScriptResponse<string> | undefined
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'FETCH_TEXT_CONTENT',
        })
      } catch (err) {
        // Content script not loaded - likely a restricted page or needs refresh
        throw new Error(t('errors.scriptNotAvailable'))
      }

      if (!response || !response.success) {
        throw new Error(response?.error || t('errors.failedExtractText'))
      }

      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('errors.unknownError')
      console.error('[useContent] extractCurrentTabText error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract markdown content from current tab.
   */
  async function extractCurrentTabMarkdown(): Promise<string | null> {
    isLoading.value = true
    error.value = null

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        throw new Error(t('errors.noActiveTab'))
      }

      const contentType = detectContentType(tab.url)
      if (contentType !== 'web') {
        throw new Error(t('errors.markdownOnlyWeb'))
      }

      let response: ContentScriptResponse<string> | undefined
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'FETCH_MARKDOWN_CONTENT',
        })
      } catch {
        throw new Error(t('errors.scriptNotAvailable'))
      }

      if (!response || !response.success) {
        throw new Error(response?.error || t('errors.failedExtractMarkdown'))
      }

      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('errors.unknownError')
      console.error('[useContent] extractCurrentTabMarkdown error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract Linux.do thread content (topic + replies) from current tab.
   */
  async function extractLinuxDoThreadText(data?: {
    maxPosts?: number
    headPosts?: number
    maxPostChars?: number
  }): Promise<string | null> {
    isLoading.value = true
    error.value = null

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        throw new Error(t('errors.noActiveTab'))
      }

      const host = new URL(tab.url).hostname
      if (!isLinuxDoHost(host)) {
        throw new Error(t('content.notLinuxDoPage'))
      }

      let response: ContentScriptResponse<string> | undefined
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'FETCH_LINUX_DO_THREAD',
          data,
        })
      } catch (err) {
        throw new Error(t('errors.scriptNotAvailable'))
      }

      if (!response || !response.success) {
        throw new Error(response?.error || t('errors.failedExtractLinuxDoThread'))
      }

      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('errors.unknownError')
      console.error('[useContent] extractLinuxDoThreadText error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract PDF content from file
   */
  async function extractPDF(file: File): Promise<PDFContent | null> {
    isLoading.value = true
    error.value = null

    try {
      const content = await extractFromPDFFile(file)
      return content
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('errors.failedExtractPdfFile')
      console.error('[useContent] extractPDF error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract video subtitles from current tab
   */
  async function extractSubtitles(
    format: SubtitleFormat = 'text_with_timestamps'
  ): Promise<string | null> {
    isLoading.value = true
    error.value = null

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        throw new Error(t('errors.noActiveTab'))
      }

      if (isBilibiliUrl(tab.url)) {
        return await extractBilibiliSubtitles(tab.url, format)
      }

      if (isYouTubeUrl(tab.url)) {
        // Get cached subtitles from content script via background
        const response = await chrome.runtime.sendMessage({
          action: 'getYouTubeSubtitles',
        })

        if (!response?.success) {
          throw new Error(response?.error || t('errors.failedGetYoutubeSubtitles'))
        }

        const { cache, installed } = response.data as {
          cache: SubtitleCache
          installed: boolean
        }

        if (!installed) {
          throw new Error(t('errors.interceptorNotInstalled'))
        }

        const keys = Object.keys(cache)
        if (keys.length === 0) {
          throw new Error(t('errors.noCachedSubtitles'))
        }

        // Prefer non-auto-generated subtitles
        let selectedKey = keys.find((k) => !k.endsWith('_auto'))
        if (!selectedKey) {
          selectedKey = keys[0]
        }

        const subtitleData = cache[selectedKey].data as YouTubeSubtitleResponse
        return formatYouTubeSubtitles(subtitleData, format)
      }

      throw new Error(t('errors.notVideoPlatform'))
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('sidepanel.extractSubtitlesFailed', { detail: '' })
      console.error('[useContent] extractSubtitles error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get current page URL
   */
  async function getCurrentUrl(): Promise<string | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab?.url || null
    } catch {
      return null
    }
  }

  /**
   * Check if current tab is a video page
   */
  async function isCurrentTabVideo(): Promise<boolean> {
    const url = await getCurrentUrl()
    return url ? isVideoUrl(url) : false
  }

  /**
   * Check if current tab is a PDF
   */
  async function isCurrentTabPDF(): Promise<boolean> {
    const url = await getCurrentUrl()
    return url ? isPDFUrl(url) : false
  }

  return {
    isLoading,
    error,
    detectContentType,
    isPDFUrl,
    extractCurrentTab,
    extractCurrentTabText,
    extractCurrentTabMarkdown,
    extractLinuxDoThreadText,
    extractPDF,
    extractSubtitles,
    getCurrentUrl,
    isCurrentTabVideo,
    isCurrentTabPDF,
  }
}

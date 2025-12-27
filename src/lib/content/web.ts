/**
 * Web content extraction using @mozilla/readability
 */

import { Readability } from '@mozilla/readability'
import type { ExtractedContent } from './types'

/**
 * Extract content from a document using Readability
 */
export function extractFromDocument(doc: Document, url: string): ExtractedContent | null {
  try {
    // Clone the document to avoid mutating the original
    const documentClone = doc.cloneNode(true) as Document

    const reader = new Readability(documentClone, {
      charThreshold: 20,
      keepClasses: false,
    })

    const article = reader.parse()

    if (!article) {
      return null
    }

    return {
      title: article.title || doc.title || 'Untitled',
      content: article.content || '',
      textContent: article.textContent || '',
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
      url,
      length: article.length || 0,
      type: 'web',
    }
  } catch (error) {
    console.error('[WebExtractor] Failed to extract content:', error)
    return null
  }
}

/**
 * Extract content from HTML string
 */
export function extractFromHTML(html: string, url: string): ExtractedContent | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return extractFromDocument(doc, url)
  } catch (error) {
    console.error('[WebExtractor] Failed to parse HTML:', error)
    return null
  }
}

/**
 * Get plain text content from a document
 */
export function getPlainText(doc: Document): string {
  // Remove script and style elements
  const clone = doc.body.cloneNode(true) as HTMLElement
  const scripts = clone.querySelectorAll('script, style, noscript')
  scripts.forEach((el) => el.remove())

  // Get text content
  return clone.textContent?.trim() || ''
}

/**
 * Get page title
 */
export function getPageTitle(doc: Document): string {
  // Try Open Graph title first
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (ogTitle) return ogTitle

  // Try Twitter title
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
  if (twitterTitle) return twitterTitle

  // Fall back to document title
  return doc.title || 'Untitled'
}

/**
 * Get page description
 */
export function getPageDescription(doc: Document): string | undefined {
  // Try meta description
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')
  if (metaDesc) return metaDesc

  // Try Open Graph description
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
  if (ogDesc) return ogDesc

  return undefined
}

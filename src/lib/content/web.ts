/**
 * Web content extraction using defuddle.
 */

import Defuddle, { type DefuddleResponse } from 'defuddle'
import type { ExtractedContent } from './types'

function htmlToText(doc: Document, html: string): string {
  const container = doc.createElement('div')
  container.innerHTML = html
  return container.textContent?.trim() || ''
}

function normalizeExtractedContent(
  doc: Document,
  url: string,
  result: DefuddleResponse
): ExtractedContent | null {
  const content = result.content || ''
  const textContent = htmlToText(doc, content)

  if (!content && !textContent) {
    return null
  }

  return {
    title: result.title || doc.title || 'Untitled',
    content,
    textContent,
    wordCount: result.wordCount || undefined,
    excerpt: result.description || undefined,
    byline: result.author || undefined,
    siteName: result.site || undefined,
    author: result.author || undefined,
    published: result.published || undefined,
    description: result.description || undefined,
    image: result.image || undefined,
    language: result.language || undefined,
    domain: result.domain || undefined,
    favicon: result.favicon || undefined,
    url,
    length: result.wordCount || textContent.length,
    type: 'web',
  }
}

/**
 * Extract content from a document using defuddle.
 */
export function extractFromDocument(doc: Document, url: string): ExtractedContent | null {
  try {
    const documentClone = doc.cloneNode(true) as Document
    const extractor = new Defuddle(documentClone, {
      url,
      useAsync: false,
    })
    const result = extractor.parse()

    return normalizeExtractedContent(doc, url, result)
  } catch (error) {
    console.error('[WebExtractor] Failed to extract content:', error)
    return null
  }
}

/**
 * Extract content from HTML string.
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
 * Get plain text content from a document.
 */
export function getPlainText(doc: Document): string {
  const extracted = extractFromDocument(doc, doc.URL || window.location.href)
  if (extracted?.textContent) {
    return extracted.textContent
  }

  return doc.body?.textContent?.trim() || ''
}

/**
 * Get page title.
 */
export function getPageTitle(doc: Document): string {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (ogTitle) return ogTitle

  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
  if (twitterTitle) return twitterTitle

  return doc.title || 'Untitled'
}

/**
 * Get page description.
 */
export function getPageDescription(doc: Document): string | undefined {
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')
  if (metaDesc) return metaDesc

  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
  if (ogDesc) return ogDesc

  return undefined
}

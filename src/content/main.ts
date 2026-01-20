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

interface LinuxDoThreadRequest {
  maxPosts?: number
  headPosts?: number
  maxPostChars?: number
}

interface DiscourseReplyToUser {
  username: string
  name?: string
}

interface DiscoursePost {
  id: number
  post_number: number
  username: string
  name?: string
  cooked: string
  reply_to_post_number?: number
  reply_to_user?: DiscourseReplyToUser
}

function isLinuxDoHost(hostname: string): boolean {
  return hostname === 'linux.do' || hostname.endsWith('.linux.do')
}

function getLinuxDoTopicIdFromPath(pathname: string): number | null {
  const topicMatch = pathname.match(/\/topic\/(\d+)/)
  if (topicMatch?.[1]) return Number(topicMatch[1])

  const tSlugMatch = pathname.match(/\/t\/[^/]+\/(\d+)/)
  if (tSlugMatch?.[1]) return Number(tSlugMatch[1])

  const tIdMatch = pathname.match(/\/t\/(\d+)/)
  if (tIdMatch?.[1]) return Number(tIdMatch[1])

  return null
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function absoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).toString()
  } catch {
    return url
  }
}

function stripHtmlToText(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  container.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove())
  return container.innerText.trim()
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function discourseCookedToText(cooked: string): string {
  if (!cooked) return ''

  let html = cooked

  html = html.replace(
    /<div class="lightbox-wrapper">\s*<a class="lightbox" href="([^"]+)"(?:\s+data-download-href="([^"]+)")?[^>]*title="([^"]*)"[^>]*>[\s\S]*?<\/a>\s*<\/div>/gi,
    (_match, hrefUrl: string, downloadHref: string, title: string) => {
      const imgUrl = hrefUrl || downloadHref || ''
      const filename = (title || '图片').trim()
      return `\n[图片: ${filename}](${absoluteUrl(imgUrl)})\n`
    }
  )
  html = html.replace(
    /<a class="attachment" href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    (_match, url: string, name: string) => `\n[附件: ${name.trim()}](${absoluteUrl(url)})\n`
  )
  html = html.replace(/<img[^>]*class="[^"]*emoji[^"]*"[^>]*alt="([^"]*)"[^>]*>/gi, '$1 ')
  html = html.replace(/<img[^>]*alt="([^"]*)"[^>]*class="[^"]*emoji[^"]*"[^>]*>/gi, '$1 ')
  html = html.replace(
    /<aside class="quote(?:-modified)?[^>]*>[\s\S]*?<blockquote>([\s\S]*?)<\/blockquote>[\s\S]*?<\/aside>/gi,
    (_match, quoteInner: string) => {
      const cleanQuote = stripHtmlToText(quoteInner)
      return `\n[引用]\n${cleanQuote}\n[/引用]\n`
    }
  )

  return normalizeNewlines(stripHtmlToText(html))
}

function formatLinuxDoPost(post: DiscoursePost, maxPostChars?: number): string {
  const userName = post.name || post.username
  const userPart = `${userName}（${post.username}）`
  let replyPart = ''
  if (post.reply_to_post_number && post.reply_to_user?.username) {
    const replyToName = post.reply_to_user.name || post.reply_to_user.username
    replyPart = `-回复[${post.reply_to_post_number}楼] ${replyToName}（${post.reply_to_user.username}）`
  }

  let content = discourseCookedToText(post.cooked)
  if (typeof maxPostChars === 'number' && maxPostChars > 0 && content.length > maxPostChars) {
    content = `${content.slice(0, maxPostChars)}…[内容截断]`
  }

  return `[${post.post_number}楼] ${userPart}${replyPart}:\n${content}`
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const resp = await fetch(url, init)
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`.trim())
  }
  return (await resp.json()) as T
}

function getLinuxDoRequestHeaders(): HeadersInit {
  const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
  const headers: Record<string, string> = { 'x-requested-with': 'XMLHttpRequest' }
  if (csrf) headers['x-csrf-token'] = csrf
  return headers
}

async function extractLinuxDoThreadText(options: LinuxDoThreadRequest = {}): Promise<string> {
  if (!isLinuxDoHost(window.location.hostname)) {
    throw new Error('Not a Linux.do page')
  }

  const topicId = getLinuxDoTopicIdFromPath(window.location.pathname)
  if (!topicId) {
    throw new Error('未检测到帖子ID')
  }

  const headers = getLinuxDoRequestHeaders()
  const init = { headers }

  const origin = window.location.origin
  const { post_ids: postIds = [] } = await fetchJson<{ post_ids: number[] }>(
    `${origin}/t/${topicId}/post_ids.json?post_number=0&limit=99999`,
    init
  )

  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new Error('未获取到帖子内容')
  }

  const topicJson = await fetchJson<{ title?: string }>(`${origin}/t/${topicId}.json`, init)
  const title = topicJson?.title || document.title || 'Untitled'

  const totalPosts = postIds.length
  const maxPosts = clampInt(options.maxPosts ?? 40, 1, 200)
  const headLimit = clampInt(options.headPosts ?? Math.min(15, maxPosts), 1, maxPosts)
  const maxPostChars = typeof options.maxPostChars === 'number' ? clampInt(options.maxPostChars, 200, 5000) : undefined

  const headCount = Math.min(headLimit, Math.min(totalPosts, maxPosts))
  const remaining = maxPosts - headCount
  const tailCount = totalPosts > headCount ? Math.min(remaining, totalPosts - headCount) : 0

  const headIds = postIds.slice(0, headCount)
  const tailIds = tailCount > 0 ? postIds.slice(totalPosts - tailCount) : []
  const selectedIds = [...headIds, ...tailIds].filter((id, idx, arr) => arr.indexOf(id) === idx)

  const postsById = new Map<number, DiscoursePost>()
  for (let i = 0; i < selectedIds.length; i += 200) {
    const chunk = selectedIds.slice(i, i + 200)
    const q = chunk.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join('&')
    const url = `${origin}/t/${topicId}/posts.json?${q}&include_suggested=false`
    const data = await fetchJson<{ post_stream?: { posts?: DiscoursePost[] } }>(url, init)
    data.post_stream?.posts?.forEach((p) => {
      if (p?.id) postsById.set(p.id, p)
    })
  }

  const omittedCount = Math.max(0, totalPosts - headIds.length - tailIds.length)
  const tailStartFloor = tailIds.length > 0 ? totalPosts - tailIds.length + 1 : null

  const parts: string[] = []
  parts.push(`帖子标题: ${title}`)
  parts.push(`URL: ${window.location.href}`)
  parts.push(`总楼层: ${totalPosts}`)

  if (tailStartFloor) {
    parts.push(`已提取楼层: 1-${headIds.length}，${tailStartFloor}-${totalPosts}`)
  } else {
    parts.push(`已提取楼层: 1-${headIds.length}`)
  }

  if (omittedCount > 0 && tailStartFloor) {
    parts.push(`（中间已省略 ${omittedCount} 条回复：${headIds.length + 1}楼–${tailStartFloor - 1}楼）`)
  }

  parts.push('')

  const emitted = new Set<number>()

  for (const id of headIds) {
    const post = postsById.get(id)
    if (!post || emitted.has(post.id)) continue
    emitted.add(post.id)
    parts.push(formatLinuxDoPost(post, maxPostChars))
  }

  if (omittedCount > 0 && tailStartFloor) {
    parts.push(`[... 已省略中间 ${omittedCount} 条回复（${headIds.length + 1}楼–${tailStartFloor - 1}楼） ...]`)
  }

  for (const id of tailIds) {
    const post = postsById.get(id)
    if (!post || emitted.has(post.id)) continue
    emitted.add(post.id)
    parts.push(formatLinuxDoPost(post, maxPostChars))
  }

  return parts.join('\n\n').trim()
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

      case 'FETCH_LINUX_DO_THREAD': {
        void (async () => {
          try {
            const text = await extractLinuxDoThreadText((message.data || {}) as LinuxDoThreadRequest)
            sendResponse({ success: true, data: text })
          } catch (error) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to extract Linux.do thread',
            })
          }
        })()
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

      default:
        console.log('[OrangeSideBar] Unknown action:', message.action)
    }

    return true // Keep channel open for async response
  }
)

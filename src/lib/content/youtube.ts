/**
 * YouTube and Bilibili subtitle extraction
 */

import type { YouTubeSubtitle, YouTubeSubtitleTrack, VideoInfo } from './types'

// Subtitle format types
export type SubtitleFormat = 'srt' | 'text' | 'text_with_timestamps'

/**
 * Check if URL is a YouTube video
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return (
      urlObj.hostname === 'www.youtube.com' ||
      urlObj.hostname === 'youtube.com' ||
      urlObj.hostname === 'youtu.be' ||
      urlObj.hostname === 'm.youtube.com'
    )
  } catch {
    return false
  }
}

/**
 * Check if URL is a Bilibili video
 */
export function isBilibiliUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('bilibili.com')
  } catch {
    return false
  }
}

/**
 * Check if URL is a supported video platform
 */
export function isVideoUrl(url: string): boolean {
  return isYouTubeUrl(url) || isBilibiliUrl(url)
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Handle youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1)
    }

    // Handle youtube.com URLs
    const videoId = urlObj.searchParams.get('v')
    if (videoId) return videoId

    // Handle embed URLs
    const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]

    return null
  } catch {
    return null
  }
}

/**
 * YouTube subtitle event interface
 */
export interface YouTubeSubtitleEvent {
  tStartMs: number
  dDurationMs: number
  segs?: Array<{ utf8: string }>
}

/**
 * YouTube subtitle response interface
 */
export interface YouTubeSubtitleResponse {
  events?: YouTubeSubtitleEvent[]
}

/**
 * Format YouTube subtitles to specified format
 */
export function formatYouTubeSubtitles(
  subtitles: YouTubeSubtitleResponse,
  format: SubtitleFormat = 'text'
): string {
  const events = subtitles.events || []
  if (!Array.isArray(events)) {
    throw new Error('Invalid subtitle data format')
  }

  const result: string[] = []
  let index = 1

  for (const event of events) {
    if (!event.segs || event.segs.length === 0) continue

    const text = event.segs
      .map((s) => s.utf8 || '')
      .join('')
      .trim()
    if (!text) continue

    if (format === 'srt') {
      const startMs = event.tStartMs || 0
      const endMs = startMs + (event.dDurationMs || 2000)
      const startTime = msToSrtTime(startMs)
      const endTime = msToSrtTime(endMs)
      result.push(`${index}\n${startTime} --> ${endTime}\n${text}\n`)
      index++
    } else if (format === 'text_with_timestamps') {
      const startMs = event.tStartMs || 0
      const endMs = startMs + (event.dDurationMs || 2000)
      const startTime = msToSrtTime(startMs)
      const endTime = msToSrtTime(endMs)
      result.push(`[${startTime}-${endTime}] ${text}`)
    } else {
      result.push(text)
    }
  }

  if (result.length === 0) {
    throw new Error('No valid subtitle content found')
  }

  return result.join('\n')
}

/**
 * Bilibili subtitle entry interface
 */
interface BilibiliSubtitleEntry {
  from: number
  to: number
  content: string
}

/**
 * Bilibili subtitle response interface
 */
interface BilibiliSubtitleResponse {
  body: BilibiliSubtitleEntry[]
}

/**
 * Format Bilibili subtitles to specified format
 */
export function formatBilibiliSubtitles(
  subtitles: BilibiliSubtitleResponse,
  format: SubtitleFormat = 'text'
): string {
  const body = subtitles.body || []

  return body
    .map((sub, index) => {
      if (format === 'srt') {
        const startTime = secondsToSrtTime(sub.from)
        const endTime = secondsToSrtTime(sub.to)
        return `${index + 1}\n${startTime} --> ${endTime}\n${sub.content}\n`
      } else if (format === 'text_with_timestamps') {
        const startTime = secondsToSrtTime(sub.from)
        const endTime = secondsToSrtTime(sub.to)
        return `[${startTime}-${endTime}] ${sub.content}`
      } else {
        return sub.content
      }
    })
    .join('\n')
}

/**
 * Convert milliseconds to SRT time format (HH:MM:SS,mmm)
 */
function msToSrtTime(ms: number): string {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const ms2 = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${s},${ms2}`
}

/**
 * Convert seconds to SRT time format (HH:MM:SS,mmm)
 */
function secondsToSrtTime(seconds: number): string {
  const date = new Date(seconds * 1000)
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss},${ms}`
}

/**
 * Parse subtitle data from YouTube's timedtext format
 */
export function parseSubtitles(data: string): YouTubeSubtitle[] {
  try {
    // Try parsing as JSON first (newer format)
    const jsonData = JSON.parse(data)
    if (jsonData.events) {
      return jsonData.events
        .filter((event: YouTubeSubtitleEvent) => event.segs)
        .map((event: YouTubeSubtitleEvent) => ({
          text: event.segs!.map((seg) => seg.utf8).join(''),
          start: event.tStartMs / 1000,
          duration: event.dDurationMs / 1000,
        }))
    }
  } catch {
    // Not JSON, try XML
  }

  // Parse XML format
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(data, 'text/xml')
    const textNodes = doc.querySelectorAll('text')

    return Array.from(textNodes).map((node) => ({
      text: node.textContent || '',
      start: parseFloat(node.getAttribute('start') || '0'),
      duration: parseFloat(node.getAttribute('dur') || '0'),
    }))
  } catch (error) {
    console.error('[YouTubeExtractor] Failed to parse subtitles:', error)
    return []
  }
}

/**
 * Format subtitles as plain text
 */
export function formatSubtitlesAsText(subtitles: YouTubeSubtitle[]): string {
  return subtitles.map((sub) => sub.text.trim()).join(' ')
}

/**
 * Format subtitles with timestamps
 */
export function formatSubtitlesWithTimestamps(subtitles: YouTubeSubtitle[]): string {
  return subtitles
    .map((sub) => {
      const time = formatTime(sub.start)
      return `[${time}] ${sub.text.trim()}`
    })
    .join('\n')
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get cached subtitles from content script
 * This function sends a message to the content script to retrieve cached subtitles
 */
export async function getCachedSubtitles(tabId: number): Promise<YouTubeSubtitleTrack[] | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'GET_YOUTUBE_SUBTITLES',
    })

    if (response?.success && response.data) {
      return response.data
    }
    return null
  } catch (error) {
    console.error('[YouTubeExtractor] Failed to get cached subtitles:', error)
    return null
  }
}

/**
 * Get video info from tab
 */
export async function getVideoInfo(tabId: number): Promise<VideoInfo | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'GET_VIDEO_INFO',
    })

    if (response?.success && response.data) {
      return response.data
    }
    return null
  } catch (error) {
    console.error('[YouTubeExtractor] Failed to get video info:', error)
    return null
  }
}

/**
 * Extract Bilibili video subtitles
 */
export async function extractBilibiliSubtitles(
  url: string,
  format: SubtitleFormat = 'text'
): Promise<string> {
  const urlObj = new URL(url)
  const searchParams = new URLSearchParams(urlObj.search)

  // Get bvid or aid
  let aidOrBvid = searchParams.get('bvid')
  if (!aidOrBvid) {
    let path = urlObj.pathname
    if (path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    const paths = path.split('/')
    aidOrBvid = paths[paths.length - 1]
  }

  if (!aidOrBvid) {
    throw new Error('Cannot extract BVID or AID from URL')
  }

  // Get page number
  const pageNumber = parseInt(searchParams.get('p') || '1')

  let aid: string | number
  let cid: string | number

  if (aidOrBvid.toLowerCase().startsWith('bv')) {
    // Get aid and cid from view API
    const bvidResponse = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${aidOrBvid}`,
      { credentials: 'include' }
    )
    const bvidData = await bvidResponse.json()

    if (bvidData.code !== 0 || !bvidData.data) {
      throw new Error(`Failed to get video info: ${bvidData.message || 'Unknown error'}`)
    }

    aid = bvidData.data.aid

    if (!bvidData.data.pages || bvidData.data.pages.length === 0) {
      throw new Error('Cannot get video page info')
    }

    if (pageNumber > bvidData.data.pages.length) {
      throw new Error(
        `Page ${pageNumber} exceeds total pages ${bvidData.data.pages.length}`
      )
    }

    cid = bvidData.data.pages[pageNumber - 1].cid
  } else if (aidOrBvid.toLowerCase().startsWith('av')) {
    aid = aidOrBvid.slice(2)

    const pageListResponse = await fetch(
      `https://api.bilibili.com/x/player/pagelist?aid=${aid}`,
      { credentials: 'include' }
    )
    const pageListData = await pageListResponse.json()

    if (pageListData.code !== 0 || !pageListData.data || pageListData.data.length === 0) {
      throw new Error(`Failed to get page list: ${pageListData.message || 'Unknown error'}`)
    }

    if (pageNumber > pageListData.data.length) {
      throw new Error(
        `Page ${pageNumber} exceeds total pages ${pageListData.data.length}`
      )
    }

    cid = pageListData.data[pageNumber - 1].cid
  } else {
    throw new Error('Unrecognized video ID format (not BV or AV)')
  }

  // Fetch subtitle information
  const subtitleResponse = await fetch(
    `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`,
    { credentials: 'include' }
  )
  const subtitleData = await subtitleResponse.json()

  if (subtitleData.code !== 0) {
    throw new Error(`Failed to get subtitles: ${subtitleData.message || 'API error'}`)
  }

  if (!subtitleData.data || !subtitleData.data.subtitle) {
    throw new Error('No subtitle data returned')
  }

  if (
    subtitleData.data.need_login_subtitle &&
    (!subtitleData.data.subtitle.subtitles || subtitleData.data.subtitle.subtitles.length === 0)
  ) {
    throw new Error('Login required to access subtitles')
  }

  let subtitleList = subtitleData.data.subtitle.subtitles || []
  subtitleList = subtitleList.filter(
    (sub: { subtitle_url: string }) => sub.subtitle_url && sub.subtitle_url.trim() !== ''
  )

  if (subtitleList.length === 0) {
    throw new Error('No valid subtitles available for this video')
  }

  let subtitleUrl = subtitleList[0].subtitle_url
  if (subtitleUrl.startsWith('//')) {
    subtitleUrl = 'https:' + subtitleUrl
  } else if (subtitleUrl.startsWith('http://')) {
    subtitleUrl = subtitleUrl.replace('http://', 'https://')
  }

  const subtitleJSONResponse = await fetch(subtitleUrl)
  const subtitleJSONData = await subtitleJSONResponse.json()

  if (!subtitleJSONData || !subtitleJSONData.body) {
    throw new Error('Invalid subtitle content format')
  }

  return formatBilibiliSubtitles(subtitleJSONData, format)
}

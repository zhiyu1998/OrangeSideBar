import DOMPurify from 'dompurify'
import { PROVIDER_ICONS } from '@/assets/icons/providerIcons'

export type ProviderIconRender =
  | { type: 'svg'; content: string }
  | { type: 'image'; src: string }
  | null

export interface BuiltInIconPreset {
  id: string
  label: string
  icon: string
}

export const BUILTIN_PROVIDER_ICON_PRESETS: BuiltInIconPreset[] = [
  { id: 'openai', label: 'OpenAI', icon: PROVIDER_ICONS.openai },
  { id: 'anthropic', label: 'Claude', icon: PROVIDER_ICONS.anthropic },
  { id: 'deepseek', label: 'DeepSeek', icon: PROVIDER_ICONS.deepseek },
  { id: 'zhipu', label: 'GLM', icon: PROVIDER_ICONS.zhipu },
  { id: 'siliconflow', label: 'SiliconFlow', icon: PROVIDER_ICONS.siliconflow },
  { id: 'openrouter', label: 'OpenRouter', icon: PROVIDER_ICONS.openrouter },
  { id: 'groq', label: 'Groq', icon: PROVIDER_ICONS.groq },
  { id: 'ollama', label: 'Ollama', icon: PROVIDER_ICONS.ollama },
  { id: 'mistral', label: 'Mistral', icon: '/mistral.png' },
  { id: 'poe', label: 'Poe', icon: '/poe-color.svg' },
]

const MAX_ICON_BYTES = 2 * 1024 * 1024
const MAX_STORED_ICON_CHARS = 64 * 1024
const DIRECT_FETCH_TIMEOUT_MS = 4500
const FALLBACK_FETCH_TIMEOUT_MS = 3500
const MAX_RASTER_ICON_SIZE = 64

const TWO_PART_PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'edu.cn',
  'com.hk',
  'com.tw',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.au',
  'com.sg',
  'co.kr',
])

interface DecodedIconResult {
  value: string
  width?: number
  height?: number
}

/**
 * Sanitize inline SVG markup and ensure a valid viewBox so icons scale cleanly.
 */
export function sanitizeProviderSvg(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || !/<svg\b/i.test(trimmed)) {
    return null
  }

  let sanitized = trimmed
  if (typeof DOMPurify !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
    sanitized = DOMPurify.sanitize(trimmed, {
      USE_PROFILES: { svg: true, svgFilters: true },
    })
  }

  if (!sanitized || !/<svg\b/i.test(sanitized)) {
    return null
  }

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(sanitized, 'image/svg+xml')
    let svgEl: Element | null = null

    if (!xmlDoc.querySelector('parsererror')) {
      svgEl = xmlDoc.documentElement?.tagName.toLowerCase() === 'svg'
        ? xmlDoc.documentElement
        : xmlDoc.querySelector('svg')
    }

    if (!svgEl) {
      const htmlDoc = parser.parseFromString(sanitized, 'text/html')
      svgEl = htmlDoc.querySelector('svg')
    }

    if (!svgEl) {
      return null
    }

    if (!svgEl.getAttribute('viewBox')) {
      const rawWidth = (svgEl.getAttribute('width') || '').trim()
      const rawHeight = (svgEl.getAttribute('height') || '').trim()
      if (/^\d+(?:\.\d+)?(?:px)?$/i.test(rawWidth) && /^\d+(?:\.\d+)?(?:px)?$/i.test(rawHeight)) {
        const w = parseFloat(rawWidth)
        const h = parseFloat(rawHeight)
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`)
        }
      }
    }

    if (svgEl.outerHTML) {
      return svgEl.outerHTML
    }
    if (typeof XMLSerializer !== 'undefined') {
      return new XMLSerializer().serializeToString(svgEl)
    }
  }

  return sanitized
}

/**
 * Classify a stored provider icon string into SVG markup, image src, or null.
 */
export function classifyProviderIcon(raw?: string | null): ProviderIconRender {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return null
  }

  if (/^(?:data:image\/|https?:\/\/)/i.test(trimmed)) {
    return { type: 'image', src: trimmed }
  }

  if (
    !trimmed.startsWith('//') &&
    !trimmed.includes('..') &&
    /^\/[a-zA-Z0-9._/-]+\.(?:png|svg|webp|jpg|jpeg|ico|gif)$/i.test(trimmed)
  ) {
    return { type: 'image', src: trimmed }
  }

  if (/<svg\b/i.test(trimmed)) {
    const content = sanitizeProviderSvg(trimmed)
    return content ? { type: 'svg', content } : null
  }

  return null
}

/**
 * Return true for localhost, .local, IPv6, and private/loopback IPv4 hosts.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }
  if (host.includes(':')) {
    return true
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!ipv4Match) {
    return false
  }

  const a = Number(ipv4Match[1])
  const b = Number(ipv4Match[2])
  if (a === 127 || a === 10 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

/**
 * Extract the parent root domain for API subdomains (e.g. api.deepseek.com -> deepseek.com).
 */
export function getRootHostname(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) {
    return null
  }

  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) {
    return null
  }

  const lastTwo = parts.slice(-2).join('.')
  if (TWO_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
    if (parts.length <= 3) {
      return null
    }
    return parts.slice(-3).join('.')
  }

  return lastTwo
}

/**
 * Build ordered candidate website origins from a provider Base Endpoint URL.
 */
export function buildCandidateOrigins(rawUrl: string): {
  origins: string[]
  hostname: string
  rootHostname: string | null
} {
  let candidate = rawUrl.trim()
  if (!candidate) {
    throw new Error('INVALID_URL')
  }

  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('INVALID_URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_URL')
  }

  const hostname = parsed.hostname.toLowerCase()
  const rootHostname = getRootHostname(hostname)
  const originSet = new Set<string>([parsed.origin])

  if (rootHostname) {
    originSet.add(`${parsed.protocol}//${rootHostname}`)
    if (!rootHostname.startsWith('www.')) {
      originSet.add(`${parsed.protocol}//www.${rootHostname}`)
    }
  }

  return {
    origins: Array.from(originSet),
    hostname,
    rootHostname,
  }
}

function parseMaxIconSize(sizesAttr: string): number {
  let maxSize = 0
  const regex = /(\d+)\s*x\s*(\d+)/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(sizesAttr)) !== null) {
    const w = Number(match[1])
    const h = Number(match[2])
    if (Number.isFinite(w) && Number.isFinite(h)) {
      maxSize = Math.max(maxSize, w, h)
    }
  }
  return maxSize
}

function scoreIconLink(rel: string, href: string, type: string, sizes: string): number {
  const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean)
  const hasAppleTouch =
    relTokens.includes('apple-touch-icon') || relTokens.includes('apple-touch-icon-precomposed')
  const hasMaskIcon = relTokens.includes('mask-icon')
  const hasIcon = relTokens.includes('icon') || relTokens.includes('fluid-icon')

  if (!hasAppleTouch && !hasMaskIcon && !hasIcon) {
    return -1
  }

  const maxSize = parseMaxIconSize(sizes)
  const lowerType = type.toLowerCase()
  const lowerHref = href.toLowerCase()

  const isSvg =
    lowerType.includes('svg') ||
    /\.svg(?:[?#]|$)/i.test(lowerHref) ||
    lowerHref.startsWith('data:image/svg+xml')
  const isPngOrWebp =
    lowerType.includes('png') ||
    lowerType.includes('webp') ||
    /\.(?:png|webp)(?:[?#]|$)/i.test(lowerHref) ||
    lowerHref.startsWith('data:image/png') ||
    lowerHref.startsWith('data:image/webp')
  const isIco = lowerType.includes('icon') || /\.ico(?:[?#]|$)/i.test(lowerHref)

  if (hasMaskIcon && !hasIcon && !hasAppleTouch) {
    return 20
  }
  if (isSvg && hasIcon) {
    return 100
  }
  if (hasAppleTouch) {
    return 90 + Math.min(maxSize, 256) / 1000
  }
  if (isPngOrWebp && maxSize >= 48) {
    return 90 + Math.min(maxSize, 256) / 1000
  }
  if (isPngOrWebp) {
    return 75 + Math.min(maxSize, 256) / 1000
  }
  if (relTokens.includes('shortcut') || isIco || hasIcon) {
    return 60 + Math.min(maxSize, 256) / 1000
  }

  return 50
}

function extractAttr(tag: string, name: string): string {
  const regex = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = regex.exec(tag)
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

/**
 * Extract, score, resolve, and deduplicate icon link URLs from an HTML document.
 */
export function extractIconLinksFromHtml(html: string, baseDocUrl: string): string[] {
  const candidates: Array<{ url: string; score: number }> = []
  let resolvedBaseUrl = baseDocUrl

  const addCandidate = (rel: string, href: string, type: string, sizes: string) => {
    const trimmedHref = href.trim()
    if (!trimmedHref) return

    const score = scoreIconLink(rel, trimmedHref, type, sizes)
    if (score < 0) return

    let resolvedUrl: string
    if (/^data:image\//i.test(trimmedHref)) {
      resolvedUrl = trimmedHref
    } else {
      try {
        const parsed = new URL(trimmedHref, resolvedBaseUrl)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return
        }
        resolvedUrl = parsed.toString()
      } catch {
        return
      }
    }

    candidates.push({ url: resolvedUrl, score })
  }

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const baseHref = doc.querySelector('base[href]')?.getAttribute('href')?.trim()
    if (baseHref) {
      try {
        resolvedBaseUrl = new URL(baseHref, baseDocUrl).toString()
      } catch {
        resolvedBaseUrl = baseDocUrl
      }
    }

    const links = Array.from(doc.querySelectorAll('link[rel][href]'))
    for (const link of links) {
      addCandidate(
        link.getAttribute('rel') || '',
        link.getAttribute('href') || '',
        link.getAttribute('type') || '',
        link.getAttribute('sizes') || ''
      )
    }
  } else {
    const baseMatch = /<base\b[^>]*>/i.exec(html)
    if (baseMatch) {
      const baseHref = extractAttr(baseMatch[0], 'href')
      if (baseHref) {
        try {
          resolvedBaseUrl = new URL(baseHref, baseDocUrl).toString()
        } catch {
          resolvedBaseUrl = baseDocUrl
        }
      }
    }

    const linkRegex = /<link\b[^>]*>/gi
    let match: RegExpExecArray | null
    while ((match = linkRegex.exec(html)) !== null) {
      const tag = match[0]
      addCandidate(
        extractAttr(tag, 'rel'),
        extractAttr(tag, 'href'),
        extractAttr(tag, 'type'),
        extractAttr(tag, 'sizes')
      )
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const result: string[] = []
  for (const item of candidates) {
    if (!seen.has(item.url)) {
      seen.add(item.url)
      result.push(item.url)
    }
  }
  return result
}

async function fetchWithTimeout(url: string, timeoutMs: number, accept: string): Promise<Response> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: accept },
      signal: controller.signal,
    })
  } finally {
    globalThis.clearTimeout(timer)
  }
}

async function blobToRawDataUrl(blob: Blob): Promise<string | null> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  }

  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const mime = blob.type || 'image/png'
  if (typeof btoa === 'function') {
    return `data:${mime};base64,${btoa(binary)}`
  }
  return null
}

async function rasterBlobToIconResult(blob: Blob): Promise<DecodedIconResult | null> {
  if (
    typeof Image !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const objectUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
        el.src = objectUrl
      })

      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        return null
      }

      const scale = Math.min(1, MAX_RASTER_ICON_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
      const width = Math.max(1, Math.round(img.naturalWidth * scale))
      const height = Math.max(1, Math.round(img.naturalHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        if (dataUrl.length <= MAX_STORED_ICON_CHARS) {
          return {
            value: dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
          }
        }
      }
    } catch {
      return null
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const fallbackDataUrl = await blobToRawDataUrl(blob)
  if (!fallbackDataUrl || fallbackDataUrl.length > MAX_STORED_ICON_CHARS) {
    return null
  }
  return { value: fallbackDataUrl }
}

async function responseToIconResult(res: Response, url: string): Promise<DecodedIconResult | null> {
  if (!res.ok) {
    return null
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (
    contentType.includes('text/html') ||
    contentType.includes('application/json') ||
    contentType.includes('javascript') ||
    contentType.includes('text/css')
  ) {
    return null
  }

  const contentLength = Number(res.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_ICON_BYTES) {
    return null
  }

  const isSvg =
    contentType.includes('image/svg+xml') ||
    (/\.svg(?:[?#]|$)/i.test(url) && !contentType.startsWith('image/'))

  if (isSvg) {
    const text = await res.text()
    if (!text || text.length > MAX_ICON_BYTES) {
      return null
    }
    if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) {
      return null
    }
    const sanitized = sanitizeProviderSvg(text)
    if (!sanitized) {
      return null
    }
    if (sanitized.length <= MAX_STORED_ICON_CHARS) {
      return { value: sanitized }
    }
    const svgBlob = new Blob([sanitized], { type: 'image/svg+xml' })
    return await rasterBlobToIconResult(svgBlob)
  }

  if (contentType.startsWith('text/')) {
    return null
  }

  const blob = await res.blob()
  if (!blob || blob.size === 0 || blob.size > MAX_ICON_BYTES) {
    return null
  }
  if (blob.type && (blob.type.includes('text/html') || blob.type.startsWith('text/'))) {
    return null
  }

  return await rasterBlobToIconResult(blob)
}

async function fetchIconCandidate(url: string, timeoutMs = DIRECT_FETCH_TIMEOUT_MS): Promise<DecodedIconResult | null> {
  if (/^data:image\//i.test(url)) {
    return url.length <= MAX_STORED_ICON_CHARS ? { value: url } : null
  }

  try {
    const res = await fetchWithTimeout(
      url,
      timeoutMs,
      'image/svg+xml,image/png,image/webp,image/x-icon,image/*;q=0.8,*/*;q=0.5'
    )
    return await responseToIconResult(res, res.url || url)
  } catch {
    return null
  }
}

/**
 * Fetch a website's favicon/logo from its Base Endpoint URL.
 * Returns sanitized SVG markup or a compact PNG data URL.
 */
export async function fetchWebsiteIcon(rawUrl: string): Promise<string> {
  const { origins, hostname, rootHostname } = buildCandidateOrigins(rawUrl)

  for (const origin of origins) {
    // 1. Discover icon links from the origin's HTML <head>
    try {
      const pageRes = await fetchWithTimeout(
        `${origin}/`,
        DIRECT_FETCH_TIMEOUT_MS,
        'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
      )
      const contentType = (pageRes.headers.get('content-type') || '').toLowerCase()
      if (pageRes.ok && contentType.includes('text/html')) {
        const html = await pageRes.text()
        const iconLinks = extractIconLinksFromHtml(html, pageRes.url || `${origin}/`).slice(0, 4)
        for (const link of iconLinks) {
          const decoded = await fetchIconCandidate(link)
          if (decoded) {
            return decoded.value
          }
        }
      }
    } catch {
      // Continue to well-known favicon path probes
    }

    // 2. Probe common favicon paths concurrently in priority order
    const probeUrls = [
      `${origin}/favicon.svg`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/favicon.png`,
      `${origin}/favicon.ico`,
    ]
    const probeResults = await Promise.allSettled(
      probeUrls.map((url) => fetchIconCandidate(url))
    )
    for (const outcome of probeResults) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        return outcome.value.value
      }
    }
  }

  // 3. Fallback to public favicon services for non-private hosts
  if (!isPrivateHost(hostname)) {
    const fallbackHost = rootHostname || hostname
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(fallbackHost)}.ico`
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackHost)}&sz=128`

    const [googleOutcome, ddgOutcome] = await Promise.allSettled([
      fetchIconCandidate(googleUrl, FALLBACK_FETCH_TIMEOUT_MS),
      fetchIconCandidate(ddgUrl, FALLBACK_FETCH_TIMEOUT_MS),
    ])

    const googleIcon = googleOutcome.status === 'fulfilled' ? googleOutcome.value : null
    const ddgIcon = ddgOutcome.status === 'fulfilled' ? ddgOutcome.value : null

    // Google returns a 16x16 generic globe when a domain lacks a favicon; prefer DuckDuckGo in that case
    if (googleIcon && ((googleIcon.width ?? 0) > 16 || (googleIcon.height ?? 0) > 16 || !ddgIcon)) {
      return googleIcon.value
    }
    if (ddgIcon) {
      return ddgIcon.value
    }
    if (googleIcon) {
      return googleIcon.value
    }
  }

  throw new Error('ICON_NOT_FOUND')
}

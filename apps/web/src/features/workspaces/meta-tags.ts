import { escapeHtml, hexToRgb, rgbToHex } from './workspace-utils'

export type RobotsIndex = 'index' | 'noindex'
export type RobotsFollow = 'follow' | 'nofollow'

export interface MetaTagInput {
  title: string
  description: string
  canonicalUrl: string
  robotsIndex: RobotsIndex
  robotsFollow: RobotsFollow
  author: string
  themeColor: string
}

export interface MetaTagResult {
  html: string
  canonicalError: boolean
  themeColorError: boolean
}

export const TITLE_RECOMMENDED = { min: 50, max: 60 } as const
export const DESCRIPTION_RECOMMENDED = { min: 140, max: 160 } as const

export function codePointLength(value: string): number {
  return [...value].length
}

function attr(value: string): string {
  return escapeHtml(value.replace(/[\r\n]+/g, ' '))
}

export function parseCanonicalUrl(value: string): { ok: true; href: string } | { ok: false; reason: 'empty' | 'invalid' } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'invalid' }
    if (url.username || url.password) return { ok: false, reason: 'invalid' }
    if (!url.hostname) return { ok: false, reason: 'invalid' }
    return { ok: true, href: url.href }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function parseThemeColor(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return rgbToHex(hexToRgb(trimmed))
  } catch {
    return null
  }
}

export function generateMetaTags(input: MetaTagInput): MetaTagResult {
  const lines: string[] = []

  const title = input.title.replace(/[\r\n]+/g, ' ').trim()
  if (title) lines.push(`<title>${escapeHtml(title)}</title>`)

  const description = input.description.replace(/[\r\n]+/g, ' ').trim()
  if (description) lines.push(`<meta name="description" content="${attr(description)}">`)

  const canonical = parseCanonicalUrl(input.canonicalUrl)
  const canonicalError = !canonical.ok && canonical.reason === 'invalid'
  if (canonical.ok) lines.push(`<link rel="canonical" href="${attr(canonical.href)}">`)

  lines.push(`<meta name="robots" content="${input.robotsIndex}, ${input.robotsFollow}">`)

  const author = input.author.replace(/[\r\n]+/g, ' ').trim()
  if (author) lines.push(`<meta name="author" content="${attr(author)}">`)

  const themeRaw = input.themeColor.trim()
  const theme = parseThemeColor(themeRaw)
  const themeColorError = Boolean(themeRaw) && theme === null
  if (theme) lines.push(`<meta name="theme-color" content="${attr(theme)}">`)

  return { html: lines.join('\n'), canonicalError, themeColorError }
}

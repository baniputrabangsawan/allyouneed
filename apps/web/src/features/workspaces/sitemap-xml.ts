import { parseCanonicalUrl } from './meta-tags'

export const CHANGE_FREQS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const
export type ChangeFreq = (typeof CHANGE_FREQS)[number]

export interface SitemapRowInput {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

export interface SitemapRowResult {
  loc: string
  href?: string
  empty: boolean
  valid: boolean
  duplicate: boolean
  locError: boolean
  lastmodError: boolean
  changefreqError: boolean
  priorityError: boolean
}

export interface SitemapResult {
  xml: string
  total: number
  valid: number
  invalid: number
  rows: SitemapRowResult[]
}

type ParseResult = { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' }

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function parseLastmod(value: string): ParseResult {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/)
  if (!match) return { ok: false, reason: 'invalid' }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, reason: 'invalid' }
  }
  if (match[4] !== undefined) {
    const hours = Number(match[4])
    const minutes = Number(match[5])
    const seconds = match[6] === undefined ? 0 : Number(match[6])
    if (hours > 23 || minutes > 59 || seconds > 59) return { ok: false, reason: 'invalid' }
  }
  return { ok: true, value: trimmed }
}

export function parseChangefreq(value: string): ParseResult {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  if ((CHANGE_FREQS as readonly string[]).includes(trimmed)) return { ok: true, value: trimmed }
  return { ok: false, reason: 'invalid' }
}

export function parsePriority(value: string): ParseResult {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(trimmed)) return { ok: false, reason: 'invalid' }
  return { ok: true, value: trimmed }
}

export function generateSitemap(rows: readonly SitemapRowInput[]): SitemapResult {
  const seenLoc = new Set<string>()
  const seenHref = new Set<string>()
  const urlBlocks: string[] = []
  const results: SitemapRowResult[] = []
  let total = 0
  let valid = 0
  let invalid = 0

  for (const row of rows) {
    const loc = row.loc.trim()
    if (!loc) {
      results.push({ loc: '', empty: true, valid: false, duplicate: false, locError: false, lastmodError: false, changefreqError: false, priorityError: false })
      continue
    }

    total += 1
    const parsed = parseCanonicalUrl(loc)
    const lastmod = parseLastmod(row.lastmod ?? '')
    const changefreq = parseChangefreq(row.changefreq ?? '')
    const priority = parsePriority(row.priority ?? '')
    const locError = !parsed.ok
    const duplicate = seenLoc.has(loc) || (parsed.ok && seenHref.has(parsed.href))
    seenLoc.add(loc)
    if (parsed.ok) seenHref.add(parsed.href)
    if (locError) invalid += 1
    const include = parsed.ok && !duplicate
    if (include) {
      valid += 1
      const lines = [`    <loc>${escapeXml(parsed.href)}</loc>`]
      if (lastmod.ok) lines.push(`    <lastmod>${escapeXml(lastmod.value)}</lastmod>`)
      if (changefreq.ok) lines.push(`    <changefreq>${changefreq.value}</changefreq>`)
      if (priority.ok) lines.push(`    <priority>${escapeXml(priority.value)}</priority>`)
      urlBlocks.push(`  <url>\n${lines.join('\n')}\n  </url>`)
    }

    results.push({
      loc,
      ...(parsed.ok ? { href: parsed.href } : {}),
      empty: false,
      valid: include,
      duplicate,
      locError,
      lastmodError: !lastmod.ok && lastmod.reason === 'invalid',
      changefreqError: !changefreq.ok && changefreq.reason === 'invalid',
      priorityError: !priority.ok && priority.reason === 'invalid',
    })
  }

  const inner = urlBlocks.length ? `\n${urlBlocks.join('\n')}\n` : '\n'
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${inner}</urlset>\n`,
    total,
    valid,
    invalid,
    rows: results,
  }
}

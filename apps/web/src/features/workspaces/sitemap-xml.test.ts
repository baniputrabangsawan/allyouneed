import { describe, expect, it } from 'vitest'
import { generateSitemap, parseLastmod, parsePriority } from './sitemap-xml'

describe('generateSitemap', () => {
  it('builds a valid urlset from http(s) URLs', () => {
    const { xml, total, valid, invalid } = generateSitemap([
      { loc: 'https://example.com/' },
      { loc: '  HTTP://Example.COM/about  ' },
    ])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<loc>http://example.com/about</loc>')
    expect(xml.endsWith('</urlset>\n')).toBe(true)
    expect(total).toBe(2)
    expect(valid).toBe(2)
    expect(invalid).toBe(0)
  })

  it('includes optional lastmod, changefreq, and priority when valid', () => {
    const { xml } = generateSitemap([{
      loc: 'https://example.com/',
      lastmod: '2026-09-15',
      changefreq: 'weekly',
      priority: '0.8',
    }])
    expect(xml).toContain('<lastmod>2026-09-15</lastmod>')
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>0.8</priority>')
  })

  it('XML-escapes loc values', () => {
    const { xml } = generateSitemap([{ loc: 'https://example.com/?a=1&b=2' }])
    expect(xml).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>')
    expect(xml).not.toContain('<loc>https://example.com/?a=1&b=2</loc>')
  })

  it('omits invalid URLs instead of writing broken XML', () => {
    const result = generateSitemap([
      { loc: 'javascript:alert(1)' },
      { loc: '/relative' },
      { loc: 'https://user:pass@example.com/' },
      { loc: 'https://example.com/ok' },
    ])
    expect(result.xml).toContain('<loc>https://example.com/ok</loc>')
    expect(result.xml).not.toContain('javascript:')
    expect(result.xml).not.toContain('/relative')
    expect(result.xml).not.toContain('user:pass')
    expect(result.total).toBe(4)
    expect(result.valid).toBe(1)
    expect(result.invalid).toBe(3)
    expect(result.rows[0]?.locError).toBe(true)
  })

  it('drops exact duplicates and normalized href duplicates from XML', () => {
    const result = generateSitemap([
      { loc: 'https://example.com/' },
      { loc: 'https://example.com/' },
      { loc: 'https://example.com' },
    ])
    expect(result.xml.match(/<loc>/g)).toHaveLength(1)
    expect(result.total).toBe(3)
    expect(result.valid).toBe(1)
    expect(result.invalid).toBe(0)
    expect(result.rows[1]?.duplicate).toBe(true)
    expect(result.rows[2]?.duplicate).toBe(true)
  })

  it('omits invalid optional fields without dropping a valid loc', () => {
    const result = generateSitemap([{
      loc: 'https://example.com/',
      lastmod: '2026-13-40',
      changefreq: 'sometimes',
      priority: '1.5',
    }])
    expect(result.xml).toContain('<loc>https://example.com/</loc>')
    expect(result.xml).not.toContain('<lastmod>')
    expect(result.xml).not.toContain('<changefreq>')
    expect(result.xml).not.toContain('<priority>')
    expect(result.rows[0]).toMatchObject({ lastmodError: true, changefreqError: true, priorityError: true, valid: true })
  })

  it('emits an empty urlset when every row is blank', () => {
    const { xml, total, valid, invalid } = generateSitemap([{ loc: '  ' }, { loc: '' }])
    expect(xml).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n')
    expect(total).toBe(0)
    expect(valid).toBe(0)
    expect(invalid).toBe(0)
  })
})

describe('parseLastmod', () => {
  it('accepts YYYY-MM-DD and rejects overflow dates', () => {
    expect(parseLastmod('2026-09-15')).toEqual({ ok: true, value: '2026-09-15' })
    expect(parseLastmod('2026-02-31')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseLastmod('')).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('parsePriority', () => {
  it('accepts 0.0 through 1.0', () => {
    expect(parsePriority('0')).toEqual({ ok: true, value: '0' })
    expect(parsePriority('0.5')).toEqual({ ok: true, value: '0.5' })
    expect(parsePriority('1.0')).toEqual({ ok: true, value: '1.0' })
    expect(parsePriority('1.1')).toEqual({ ok: false, reason: 'invalid' })
  })
})

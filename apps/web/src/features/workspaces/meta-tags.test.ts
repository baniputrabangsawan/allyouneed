import { describe, expect, it } from 'vitest'
import { codePointLength, generateMetaTags, parseCanonicalUrl, parseThemeColor } from './meta-tags'

const base = {
  title: 'Kits — file tools in the browser',
  description: 'Compress, convert, and generate files locally without creating an account.',
  canonicalUrl: 'https://usekits.online/tools/meta-tag-generator',
  robotsIndex: 'index' as const,
  robotsFollow: 'follow' as const,
  author: '',
  themeColor: '',
}

describe('parseCanonicalUrl', () => {
  it('accepts http and https URLs and normalizes them', () => {
    expect(parseCanonicalUrl('https://example.com/path')).toEqual({ ok: true, href: 'https://example.com/path' })
    expect(parseCanonicalUrl('  HTTP://Example.COM  ')).toEqual({ ok: true, href: 'http://example.com/' })
  })

  it('rejects empty, relative, credentialed, and non-http schemes', () => {
    expect(parseCanonicalUrl('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseCanonicalUrl('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseCanonicalUrl('/about')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCanonicalUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCanonicalUrl('data:text/html,<h1>x</h1>')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCanonicalUrl('https://user:pass@example.com/')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCanonicalUrl('http://')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('parseThemeColor', () => {
  it('normalizes 3 and 6 digit hex colors', () => {
    expect(parseThemeColor('#0f172a')).toBe('#0F172A')
    expect(parseThemeColor('#abc')).toBe('#AABBCC')
    expect(parseThemeColor('')).toBeNull()
    expect(parseThemeColor('blue')).toBeNull()
    expect(parseThemeColor('#gg0000')).toBeNull()
  })
})

describe('generateMetaTags', () => {
  it('builds escaped HTML and omits empty optional tags', () => {
    const { html, canonicalError, themeColorError } = generateMetaTags({
      ...base,
      title: 'Shop <script>alert(1)</script>',
      description: 'Say "hello" & goodbye',
      author: '',
      themeColor: '',
    })
    expect(html).toContain('<title>Shop &lt;script&gt;alert(1)&lt;/script&gt;</title>')
    expect(html).toContain('<meta name="description" content="Say &quot;hello&quot; &amp; goodbye">')
    expect(html).toContain('<link rel="canonical" href="https://usekits.online/tools/meta-tag-generator">')
    expect(html).toContain('<meta name="robots" content="index, follow">')
    expect(html).not.toContain('author')
    expect(html).not.toContain('theme-color')
    expect(html).not.toContain('<script>')
    expect(canonicalError).toBe(false)
    expect(themeColorError).toBe(false)
  })

  it('includes optional author and theme-color when valid', () => {
    const { html } = generateMetaTags({
      ...base,
      author: 'Ada <Lovelace>',
      themeColor: '#0f1',
      robotsIndex: 'noindex',
      robotsFollow: 'nofollow',
    })
    expect(html).toContain('<meta name="author" content="Ada &lt;Lovelace&gt;">')
    expect(html).toContain('<meta name="theme-color" content="#00FF11">')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
  })

  it('omits invalid canonical and theme-color without blocking other tags', () => {
    const { html, canonicalError, themeColorError } = generateMetaTags({
      ...base,
      canonicalUrl: 'javascript:alert(1)',
      themeColor: 'not-a-color',
    })
    expect(html).toContain('<title>')
    expect(html).toContain('<meta name="description"')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('theme-color')
    expect(canonicalError).toBe(true)
    expect(themeColorError).toBe(true)
  })

  it('still generates tags longer than SERP recommendations', () => {
    const title = 'T'.repeat(80)
    const description = 'D'.repeat(200)
    const { html } = generateMetaTags({ ...base, title, description })
    expect(codePointLength(title)).toBe(80)
    expect(html).toContain(`<title>${title}</title>`)
    expect(html).toContain(`content="${description}"`)
  })

  it('keeps robots when every other field is empty', () => {
    const { html, canonicalError, themeColorError } = generateMetaTags({
      title: '',
      description: '',
      canonicalUrl: '',
      robotsIndex: 'index',
      robotsFollow: 'follow',
      author: '  ',
      themeColor: '  ',
    })
    expect(html).toBe('<meta name="robots" content="index, follow">')
    expect(canonicalError).toBe(false)
    expect(themeColorError).toBe(false)
  })
})

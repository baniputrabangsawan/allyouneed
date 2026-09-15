import { describe, expect, it } from 'vitest'
import { blocksEntireSite, generateRobotsTxt } from './robots-txt'

describe('robots.txt generator', () => {
  it('generates groups, rules, crawl delay, and sitemap', () => {
    expect(generateRobotsTxt({ groups: [{ userAgent: '*', rules: [{ type: 'Allow', path: '/' }, { type: 'Disallow', path: '/admin/' }], crawlDelay: '10' }], sitemapUrl: 'https://example.com/sitemap.xml' })).toBe('User-agent: *\nAllow: /\nDisallow: /admin/\nCrawl-delay: 10\n\nSitemap: https://example.com/sitemap.xml')
  })

  it('detects a whole-site block without preventing generation', () => {
    const groups = [{ userAgent: '*', rules: [{ type: 'Disallow' as const, path: '/' }] }]
    expect(blocksEntireSite(groups)).toBe(true)
    expect(generateRobotsTxt({ groups })).toBe('User-agent: *\nDisallow: /')
  })
})

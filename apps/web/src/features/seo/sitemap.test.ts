import { describe, expect, it } from 'vitest'
import { validCategories } from '@/features/catalog/categories'
import { getAllTools } from '@/features/tools/tool-registry'
import { generateRobotsTxt, generateSitemapXml, publicSitemapPaths } from './sitemap'

const origin = 'https://usekits.online'

describe('production sitemap', () => {
  it('lists canonical public pages once and only on the production origin', () => {
    const paths = publicSitemapPaths()

    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toContain('/')
    expect(paths).toContain('/about')
    expect(paths).toContain('/guides')
    expect(paths).toContain('/support')
    expect(paths).toContain('/id/about')
    expect(paths).toContain('/id/guides')
    expect(paths).toContain('/id/support')
    expect(paths).toContain('/docs/getting-started')
    expect(paths).not.toContain('/admin')
    expect(paths).not.toContain('/api')
    expect(paths.every((path) => path.startsWith('/') && !path.includes('?'))).toBe(true)

    for (const category of validCategories) {
      expect(paths).toContain(`/tools/${category}`)
      expect(paths).toContain(`/id/tools/${category}`)
    }

    for (const tool of getAllTools()) {
      const canonicalPath = `/tools/${tool.slug}`
      const docsPath = `/docs/tools/${tool.slug}`
      if (tool.available) {
        expect(paths).toContain(canonicalPath)
        expect(paths).toContain(docsPath)
      } else {
        expect(paths).not.toContain(canonicalPath)
        expect(paths).not.toContain(docsPath)
      }
    }

    const xml = generateSitemapXml()
    const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1] ?? '')
    expect(locations).toHaveLength(paths.length)
    expect(locations.every((location) => location.startsWith(`${origin}/`) || location === origin)).toBe(true)
    expect(xml).not.toContain('localhost')
    expect(xml).not.toContain('127.0.0.1')
    expect(xml).not.toContain('workers.dev')
  })

  it('returns a valid sitemap document without fabricated modification dates', () => {
    const xml = generateSitemapXml()

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain(`<loc>${origin}/</loc>`)
    expect(xml.endsWith('</urlset>\n')).toBe(true)
    expect(xml).not.toContain('<lastmod>')
  })
})

describe('production robots.txt', () => {
  it('allows crawling and advertises the production sitemap', () => {
    const robots = generateRobotsTxt()

    expect(robots).toContain('User-agent: *\nAllow: /')
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`)
    expect(robots).toContain(`Agentmap: ${origin}/.well-known/ai-catalog.json`)
    expect(robots).not.toContain('Disallow: /tools')
  })
})

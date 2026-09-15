import { describe, expect, it } from 'vitest'
import { copyLooksGeneric, getToolPageCopy, toolPageContent } from './tool-content'
import { LEGACY_TOOL_REDIRECTS } from './tool-legacy'
import { getAllTools, getToolBySlug, tools } from './tool-registry'

const FORBIDDEN = [
  'Open the tool page.',
  'Add your file or text.',
  'Choose the available options.',
  'Process the tool.',
  'Works in a focused web interface.',
  'Uses clear processing labels.',
  'Formats depend on the input used with this tool.',
]

describe('tool page copy', () => {
  it('covers every available tool in en and id', () => {
    const available = tools.filter((tool) => tool.available)
    expect(available.length).toBeGreaterThan(100)
    for (const tool of available) {
      const en = getToolPageCopy(tool.slug, 'en')
      const id = getToolPageCopy(tool.slug, 'id')
      expect(en, tool.slug).toBeDefined()
      expect(id, tool.slug).toBeDefined()
      expect(en!.howTo.length, tool.slug).toBeGreaterThanOrEqual(2)
      expect(en!.benefits.length, tool.slug).toBeGreaterThanOrEqual(2)
      expect(en!.inputFormats.length, tool.slug).toBeGreaterThan(0)
      expect(en!.outputFormats.length, tool.slug).toBeGreaterThan(0)
      expect(copyLooksGeneric(en!), tool.slug).toBeUndefined()
      expect(copyLooksGeneric(id!), tool.slug).toBeUndefined()
      for (const phrase of FORBIDDEN) {
        expect(en!.howTo.join(' '), tool.slug).not.toContain(phrase)
        expect(en!.benefits.join(' '), tool.slug).not.toContain(phrase)
      }
    }
  })

  it('keeps descriptions unique among available tools', () => {
    const descriptions = tools.filter((tool) => tool.available).map((tool) => getToolPageCopy(tool.slug, 'en')!.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('does not keep copy for removed duplicate slugs', () => {
    for (const slug of Object.keys(LEGACY_TOOL_REDIRECTS)) {
      expect(toolPageContent[slug], slug).toBeUndefined()
      expect(getToolBySlug(slug), slug).toBeUndefined()
    }
  })
})

describe('legacy tool redirects', () => {
  it('points every legacy slug at an available canonical tool', () => {
    for (const [from, to] of Object.entries(LEGACY_TOOL_REDIRECTS)) {
      expect(from).not.toBe(to)
      expect(getToolBySlug(from)).toBeUndefined()
      expect(getToolBySlug(to)?.available).toBe(true)
    }
  })

  it('preserves old names as aliases on the canonical tool', () => {
    expect(getToolBySlug('word-counter')?.aliases.join(' ')).toMatch(/character/)
    expect(getToolBySlug('qr-code-generator')?.aliases.join(' ')).toMatch(/qr generator/)
    expect(getToolBySlug('audio-cutter')?.aliases.join(' ')).toMatch(/trimmer/)
    expect(getToolBySlug('video-cutter')?.aliases.join(' ')).toMatch(/trimmer/)
    expect(getToolBySlug('extract-audio-from-video')?.aliases.join(' ')).toMatch(/extract audio/)
    expect(getToolBySlug('markdown-to-html')?.aliases.join(' ')).toMatch(/preview/)
    expect(getToolBySlug('color-picker')?.aliases.join(' ')).toMatch(/hex/)
    expect(getToolBySlug('color-palette-generator')?.aliases.join(' ')).toMatch(/palette generator/)
    expect(getToolBySlug('meta-tag-generator')?.aliases.join(' ')).toMatch(/seo meta generator/)
    expect(getToolBySlug('json-ld-generator')?.aliases.join(' ')).toMatch(/structured data/)
    expect(getToolBySlug('open-graph-generator')?.aliases.join(' ')).toMatch(/twitter card/)
    expect(getToolBySlug('sitemap-generator')?.aliases.join(' ')).toMatch(/sitemap.xml/)
    expect(getToolBySlug('css-clamp-calculator')?.aliases.join(' ')).toMatch(/clamp\(\)/)
  })
})

describe('registry uniqueness', () => {
  it('has unique slugs, names, and aliases across tools', () => {
    const slugs = tools.map((tool) => tool.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    const names = tools.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    const aliasHits = new Map<string, string>()
    for (const tool of tools) {
      for (const alias of tool.aliases) {
        const key = alias.toLowerCase()
        const owner = aliasHits.get(key)
        expect(owner, `${alias} on ${tool.slug}`).toBeUndefined()
        aliasHits.set(key, tool.slug)
        expect(key).not.toBe(tool.slug)
      }
    }
  })

  it('does not return removed tools from getAllTools', () => {
    const ids = new Set(getAllTools().map((tool) => tool.id))
    expect(ids.has('character-counter')).toBe(false)
    expect(ids.has('qr-generator')).toBe(false)
  })
})

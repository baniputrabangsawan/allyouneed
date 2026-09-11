import { describe, expect, it } from 'vitest'
import { tools } from '@/features/tools/tool-registry'
import { toolGuides } from './tool-guides'
import { resolveToolGuide, searchDocs } from './catalog'

describe('docs catalog', () => {
  it('does not invent custom options for Coming Soon tools', () => {
    for (const tool of tools) {
      if (tool.available) continue
      expect(resolveToolGuide(tool)).toBeNull()
    }
  })

  it('custom guides only cover registry slugs', () => {
    for (const slug of Object.keys(toolGuides)) {
      expect(tools.some((tool) => tool.slug === slug)).toBe(true)
    }
  })

  it('available tools get a guide with real steps', () => {
    const compress = tools.find((tool) => tool.slug === 'compress-image')
    expect(compress?.available).toBe(true)
    const guide = resolveToolGuide(compress!)
    expect(guide?.steps.length).toBeGreaterThan(2)
    expect(guide?.overview).toMatch(/quality/i)
  })

  it('search finds tools and articles', () => {
    const json = searchDocs('json formatter')
    expect(json.some((hit) => hit.slug === 'json-formatter')).toBe(true)
    const privacy = searchDocs('privacy')
    expect(privacy.some((hit) => hit.kind === 'article' && hit.slug === 'privacy-and-processing')).toBe(true)
  })

  it('serves Indonesian custom guides', () => {
    const compress = tools.find((tool) => tool.slug === 'compress-image')
    const guide = resolveToolGuide(compress!, 'id')
    expect(guide?.steps[0]).toMatch(/Kompres Gambar/)
    expect(guide?.overview).toMatch(/slider/)
  })

  it('finds tools from Indonesian docs search', () => {
    expect(searchDocs('kompres gambar').some((hit) => hit.slug === 'compress-image')).toBe(true)
  })
})

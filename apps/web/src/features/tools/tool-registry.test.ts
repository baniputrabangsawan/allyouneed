import { describe, expect, it } from 'vitest'
import {
  getAllTools,
  getPopularTools,
  getRelatedTools,
  getToolBySlug,
  getToolsByCategory,
  getToolsByGroup,
  searchTools,
  tools,
  type ToolDefinition,
} from './tool-registry'

describe('tool registry', () => {
  it('has unique slugs and ids', () => {
    expect(new Set(tools.map((tool) => tool.slug)).size).toBe(tools.length)
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length)
  })

  it('provides the full tool schema', () => {
    for (const tool of tools) {
      expect(tool).toMatchObject({
        id: expect.any(String),
        slug: expect.any(String),
        name: expect.any(String),
        shortDescription: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        groups: expect.any(Array),
        tags: expect.any(Array),
        aliases: expect.any(Array),
        icon: expect.any(String),
        processingMode: expect.stringMatching(/^(client|remote|hybrid)$/),
        seo: { title: expect.any(String), description: expect.any(String) },
        available: expect.any(Boolean),
        implementation: expect.any(String),
      })
    }
  })

  it('includes every documented section and conversion grouping', () => {
    expect(tools.length).toBe(159)
    expect(getToolBySlug('social-media-image-resizer')).toBeDefined()
    expect(getToolBySlug('certificate-generator')).toBeDefined()
    expect(getToolsByGroup('convert').length).toBeGreaterThan(0)
  })

  it('filters by category and group', () => {
    expect(getToolsByCategory('pdf').every((tool) => tool.category === 'pdf')).toBe(true)
    expect(getToolsByGroup('security').every((tool) => tool.groups.includes('security'))).toBe(true)
    expect(getToolsByCategory('converter')).toEqual(getToolsByGroup('convert'))
  })

  it('returns copies, resolves slugs, and only promotes available tools', () => {
    expect(getAllTools()).toEqual(tools)
    expect(getAllTools()).not.toBe(tools)
    expect(getToolBySlug('json-formatter')?.available).toBe(true)
    expect(getPopularTools().every((tool) => tool.available && tool.popular)).toBe(true)
  })

  it('searches names, descriptions, and aliases', () => {
    expect(searchTools('kompres gambar')[0]?.slug).toBe('compress-image')
    expect(searchTools('timestamp').some((tool) => tool.slug === 'unix-timestamp-converter')).toBe(true)
    expect(searchTools('')).toEqual(tools)
  })

  it('returns up to four available related tools', () => {
    const current = getToolBySlug('case-converter') as ToolDefinition
    const related = getRelatedTools(current)
    expect(related.length).toBeLessThanOrEqual(4)
    expect(related.every((tool) => tool.available && tool.id !== current.id)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { isToolAvailable, partitionByAvailability, sortAvailableFirst } from './tool-availability'
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
    expect(tools.length).toBe(160)
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
    expect(getToolBySlug('xml-formatter')?.available).toBe(true)
    expect(getToolBySlug('xml-formatter')?.implementation).toBe('xml')
    expect(getToolBySlug('javascript-formatter')?.available).toBe(true)
    expect(getToolBySlug('html-formatter')?.available).toBe(true)
    expect(getToolBySlug('basic-background-removal')?.available).toBe(true)
    expect(getToolBySlug('basic-background-removal')?.implementation).toBe('remote-api')
    expect(getToolBySlug('remove-background')?.available).toBe(false)
    expect(getToolBySlug('remove-background')?.ai).toBe(true)
    expect(getToolBySlug('noise-reduction')?.available).toBe(true)
    expect(getToolBySlug('noise-reduction')?.ai).toBeUndefined()
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

describe('available-first ordering', () => {
  it('places available tools before Coming Soon tools', () => {
    const sorted = sortAvailableFirst(tools)
    const firstComingSoon = sorted.findIndex((tool) => !isToolAvailable(tool))
    expect(sorted.some((tool) => !isToolAvailable(tool))).toBe(true)
    expect(sorted.slice(0, firstComingSoon).every(isToolAvailable)).toBe(true)
    expect(sorted.slice(firstComingSoon).every((tool) => !isToolAvailable(tool))).toBe(true)
  })

  it('keeps Coming Soon tools visible', () => {
    const { available, comingSoon } = partitionByAvailability(tools)
    expect(comingSoon.length).toBeGreaterThan(0)
    expect(available.length + comingSoon.length).toBe(tools.length)
  })

  it('preserves available-first order under category filters', () => {
    const image = getToolsByCategory('image')
    const sorted = sortAvailableFirst(image)
    const firstComingSoon = sorted.findIndex((tool) => !isToolAvailable(tool))
    expect(sorted.slice(0, firstComingSoon).every(isToolAvailable)).toBe(true)
    expect(sorted.slice(firstComingSoon).every((tool) => !isToolAvailable(tool))).toBe(true)
  })

  it('preserves available-first order under search', () => {
    const sorted = sortAvailableFirst(searchTools('image'))
    const firstComingSoon = sorted.findIndex((tool) => !isToolAvailable(tool))
    if (firstComingSoon === -1) {
      expect(sorted.every(isToolAvailable)).toBe(true)
      return
    }
    expect(sorted.slice(0, firstComingSoon).every(isToolAvailable)).toBe(true)
    expect(sorted.slice(firstComingSoon).every((tool) => !isToolAvailable(tool))).toBe(true)
  })

  it('moves a tool up when it becomes available', () => {
    const sample = [
      { id: 'compress-image', available: true },
      { id: 'avif-converter', available: false },
      { id: 'resize-image', available: true },
    ]
    expect(sortAvailableFirst(sample).map((tool) => tool.id)).toEqual(['compress-image', 'resize-image', 'avif-converter'])
    sample[1]!.available = true
    expect(sortAvailableFirst(sample).map((tool) => tool.id)).toEqual(['compress-image', 'avif-converter', 'resize-image'])
  })

  it('does not mutate the original Tool Registry', () => {
    const original = tools
    const before = tools.map((tool) => tool.id)
    const sorted = sortAvailableFirst(tools)
    expect(tools).toBe(original)
    expect(tools.map((tool) => tool.id)).toEqual(before)
    expect(sorted).not.toBe(tools)
  })
})

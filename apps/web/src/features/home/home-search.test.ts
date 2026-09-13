import { describe, expect, it } from 'vitest'
import { getToolBySlug, tools } from '@/features/tools/tool-registry'
import { filterTools, searchIndex } from './home-search'

describe('filterTools', () => {
  it('reuses one precomputed index', () => {
    expect(searchIndex.length).toBeGreaterThan(100)
    expect(filterTools('', 'all', 'all')).toEqual(searchIndex.map((entry) => entry.tool))
    expect(filterTools('', 'all', 'all')).toEqual(tools)
  })

  it('applies category and group together with search', () => {
    const hits = filterTools('pdf', 'pdf', 'convert')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((tool) => tool.category === 'pdf' && tool.groups.includes('convert'))).toBe(true)
  })

  it('matches tokens against the precomputed haystack including aliases', () => {
    expect(filterTools('kompres gambar', 'all', 'all').some((tool) => tool.slug === 'compress-image')).toBe(true)
    expect(filterTools('png to jpg', 'all', 'all').some((tool) => tool.slug === 'png-to-jpg')).toBe(true)
    expect(filterTools('speech to text', 'all', 'all').some((tool) => tool.slug === 'speech-to-text')).toBe(true)
  })

  it('keeps converter category on convert-group tools', () => {
    const converter = getToolBySlug('jpg-to-png')
    expect(converter).toBeTruthy()
    expect(filterTools('', 'converter', 'all').some((tool) => tool.slug === 'jpg-to-png')).toBe(true)
  })

  it('filters the registry in well under 100ms even when repeated', () => {
    const started = performance.now()
    for (let i = 0; i < 200; i += 1) {
      filterTools('compress image', 'all', 'all')
      filterTools('png', 'image', 'convert')
      filterTools('remove background', 'all', 'all')
    }
    expect(performance.now() - started).toBeLessThan(100)
  })
})

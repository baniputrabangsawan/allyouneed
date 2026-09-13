import { describe, expect, it } from 'vitest'
import { getToolBySlug, tools } from '@/features/tools/tool-registry'
import { filterTools } from './home-search'

describe('filterTools', () => {
  it('returns the full registry when query and filters are empty', () => {
    expect(filterTools('', 'all', 'all')).toEqual(tools)
  })

  it('applies category and group together with search', () => {
    const hits = filterTools('pdf', 'pdf', 'convert')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((tool) => tool.category === 'pdf' && tool.groups.includes('convert'))).toBe(true)
  })

  it('finds tools from aliases without requiring the English name', () => {
    expect(filterTools('kompres gambar', 'all', 'all').some((tool) => tool.slug === 'compress-image')).toBe(true)
  })

  it('keeps converter category on convert-group tools', () => {
    const converter = getToolBySlug('jpg-to-png')
    expect(converter).toBeTruthy()
    expect(filterTools('', 'converter', 'all').some((tool) => tool.slug === 'jpg-to-png')).toBe(true)
  })
})

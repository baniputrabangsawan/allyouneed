import { describe, expect, it } from 'vitest'
import { filterTools, searchIndex } from './home-search'

describe('home tool search', () => {
  it('reuses one precomputed index', () => {
    expect(searchIndex.length).toBeGreaterThan(100)
    expect(filterTools('', 'all', 'all')).toEqual(searchIndex.map((entry) => entry.tool))
  })

  it('matches tokens against the precomputed haystack including aliases', () => {
    const png = filterTools('png to jpg', 'all', 'all')
    expect(png.some((tool) => tool.slug === 'png-to-jpg')).toBe(true)
    const compress = filterTools('kompres gambar', 'all', 'all')
    expect(compress.some((tool) => tool.slug === 'compress-image')).toBe(true)
    const speech = filterTools('speech to text', 'all', 'all')
    expect(speech.some((tool) => tool.slug === 'speech-to-text')).toBe(true)
  })

  it('applies category and group without rescanning unrelated pipelines', () => {
    const image = filterTools('', 'image', 'all')
    expect(image.every((tool) => tool.category === 'image')).toBe(true)
    const convert = filterTools('', 'converter', 'all')
    expect(convert.every((tool) => tool.groups.includes('convert'))).toBe(true)
    const security = filterTools('', 'all', 'security')
    expect(security.every((tool) => tool.groups.includes('security'))).toBe(true)
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

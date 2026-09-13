import { describe, expect, it } from 'vitest'
import { tools } from '@/features/tools/tool-registry'
import { en } from './en'
import { id } from './id'
import { localeFromPathname, localizedPath, stripLocalePrefix, switchLocaleLocation } from './path'
import { toolsId } from './tools-id'
import { searchToolsLocalized } from './tools'

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [prefix]
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
}

describe('i18n catalogs', () => {
  it('keeps English and Indonesian keys in sync', () => {
    expect(keysOf(id).sort()).toEqual(keysOf(en).sort())
  })

  it('localizes every registry tool in Indonesian', () => {
    for (const tool of tools) {
      expect(toolsId[tool.slug], tool.slug).toMatchObject({
        name: expect.any(String),
        shortDescription: expect.any(String),
      })
    }
  })

  it('finds tools from Indonesian queries', () => {
    const hits = searchToolsLocalized('kompres gambar')
    expect(hits.some((tool) => tool.slug === 'compress-image')).toBe(true)
  })

  it('matches precomputed search text before falling back to fuzzy search', () => {
    const hits = searchToolsLocalized('unix timestamp')
    expect(hits[0]?.slug).toBe('unix-timestamp-converter')
  })
})

describe('locale paths', () => {
  it('reads locale from the URL only', () => {
    expect(localeFromPathname('/')).toBe('en')
    expect(localeFromPathname('/docs/tools/compress-image')).toBe('en')
    expect(localeFromPathname('/id')).toBe('id')
    expect(localeFromPathname('/id/')).toBe('id')
    expect(localeFromPathname('/id/docs/tools/compress-image')).toBe('id')
  })

  it('prefixes Indonesian paths and strips them back', () => {
    expect(localizedPath('id', '/docs/tools/compress-image')).toBe('/id/docs/tools/compress-image')
    expect(localizedPath('en', '/id/docs')).toBe('/docs')
    expect(stripLocalePrefix('/id/pricing')).toBe('/pricing')
    expect(stripLocalePrefix('/id/docs')).toBe('/docs')
    expect(localizedPath('id', '/')).toBe('/id')
  })

  it('preserves search and hash when switching locale', () => {
    expect(switchLocaleLocation('id', {
      pathname: '/',
      searchStr: '?q=image&category=image&group=convert',
      hash: '#all-tools',
    })).toBe('/id?q=image&category=image&group=convert#all-tools')
    expect(switchLocaleLocation('en', {
      pathname: '/id/docs/tools/compress-image',
      searchStr: '',
      hash: '#how-to',
    })).toBe('/docs/tools/compress-image#how-to')
  })
})

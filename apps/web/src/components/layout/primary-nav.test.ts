import { describe, expect, it } from 'vitest'
import { isPrimaryNavActive, isToolsPath, navItemActive, primaryNavigation } from './primary-nav'

describe('primary navigation', () => {
  it('exposes one shared Home/Tools/Guides/About/Pricing/Support config', () => {
    expect(primaryNavigation.map((item) => item.key)).toEqual([
      'home',
      'tools',
      'guides',
      'about',
      'pricing',
      'support',
    ])
    expect(primaryNavigation.map((item) => item.to)).toEqual([
      '/',
      '/tools',
      '/guides',
      '/about',
      '/pricing',
      '/support',
    ])
  })

  it('treats catalog and working tool URLs as Tools', () => {
    expect(isToolsPath('/tools')).toBe(true)
    expect(isToolsPath('/tools/image')).toBe(true)
    expect(isToolsPath('/compress-image')).toBe(true)
    expect(isPrimaryNavActive('/tools', '/tools')).toBe(true)
    expect(isPrimaryNavActive('/tools', '/tools/pdf')).toBe(true)
    expect(isPrimaryNavActive('/tools', '/compress-image')).toBe(true)
    expect(navItemActive('/tools/image', 'home')).toBe(false)
    expect(isPrimaryNavActive('/', '/tools')).toBe(false)
  })

  it('highlights Guides for both /guides and existing /docs URLs', () => {
    expect(navItemActive('/guides', 'guides')).toBe(true)
    expect(navItemActive('/guides/how-to-compress-images-online', 'guides')).toBe(true)
    expect(isPrimaryNavActive('/guides', '/docs')).toBe(true)
    expect(isPrimaryNavActive('/guides', '/docs/getting-started')).toBe(true)
    expect(isPrimaryNavActive('/guides', '/docs/tools/compress-image')).toBe(true)
    expect(isPrimaryNavActive('/guides', '/about')).toBe(false)
  })

  it('matches remaining items on exact or nested paths only', () => {
    expect(navItemActive('/', 'home')).toBe(true)
    expect(navItemActive('/about', 'home')).toBe(false)
    expect(navItemActive('/about', 'about')).toBe(true)
    expect(navItemActive('/pricing', 'pricing')).toBe(true)
    expect(navItemActive('/support', 'support')).toBe(true)
    expect(isPrimaryNavActive('/about', '/about/team')).toBe(true)
    expect(isPrimaryNavActive('/support', '/docs')).toBe(false)
  })
})

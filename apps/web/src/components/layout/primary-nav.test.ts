import { describe, expect, it } from 'vitest'
import { isToolsPath, navItemActive } from './primary-nav'

describe('primary navigation active states', () => {
  it('treats catalog and working tool URLs as Tools', () => {
    expect(isToolsPath('/tools')).toBe(true)
    expect(isToolsPath('/tools/image')).toBe(true)
    expect(isToolsPath('/compress-image')).toBe(true)
    expect(navItemActive('/guides/how-to-compress-images-online', 'guides')).toBe(true)
    expect(navItemActive('/about', 'about')).toBe(true)
    expect(navItemActive('/tools/image', 'home')).toBe(false)
  })
})

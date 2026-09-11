import { describe, expect, it } from 'vitest'
import { readHomeScroll, restoreHomeScroll, viewportTopDelta, writeHomeScroll } from './scroll'

describe('home scroll persistence', () => {
  it('stores and restores a finite scroll offset', () => {
    const store = new Map<string, string>()
    const session = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    }
    const previous = globalThis.sessionStorage
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session })
    writeHomeScroll(842.6)
    expect(readHomeScroll()).toBe(843)
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: previous })
  })

  it('ignores missing or invalid stored offsets', () => {
    expect(restoreHomeScroll()).toBe(false)
  })

  it('scrolls opposite the catalog heading drift so the grid stays put', () => {
    expect(viewportTopDelta(200, -400)).toBe(-600)
    expect(viewportTopDelta(200, 200)).toBe(0)
  })
})

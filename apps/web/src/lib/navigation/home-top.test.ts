import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeGoHomeTop, markGoHomeTop, peekGoHomeTop, scrollWindowTop } from './home-top'

function stubSessionStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('home top navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks and consumes a one-shot home-top flag', () => {
    stubSessionStorage()
    expect(peekGoHomeTop()).toBe(false)
    markGoHomeTop()
    expect(peekGoHomeTop()).toBe(true)
    expect(consumeGoHomeTop()).toBe(true)
    expect(peekGoHomeTop()).toBe(false)
    expect(consumeGoHomeTop()).toBe(false)
  })

  it('scrolls the window to 0,0', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('window', { scrollTo })
    vi.stubGlobal('document', {
      documentElement: { style: { scrollBehavior: '' } },
      scrollingElement: { scrollTo },
    })
    scrollWindowTop()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})

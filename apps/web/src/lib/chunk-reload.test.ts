import { afterEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, recoverFromChunkLoadError } from './chunk-reload'

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

describe('chunk load recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recognizes a missing Vite workspace chunk', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://usekits.online/assets/ColorWorkspace-jKjh30-L.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"'))).toBe(true)
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
  })

  it('reloads once, then ignores the same stale chunk during the cooldown', () => {
    stubSessionStorage()
    const reload = vi.fn()
    const error = new TypeError('Failed to fetch dynamically imported module: https://usekits.online/assets/ColorWorkspace-jKjh30-L.js')
    expect(recoverFromChunkLoadError(error, { reload, now: 1_000 })).toBe(true)
    expect(recoverFromChunkLoadError(error, { reload, now: 10_000 })).toBe(false)
    expect(recoverFromChunkLoadError(error, { reload, now: 20_000 })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoDownloadOnce, forgetAutoDownloads } from './auto-download'

describe('autoDownloadOnce', () => {
  afterEach(() => {
    forgetAutoDownloads()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('downloads a blob once per id and ignores rerenders or restored ids', async () => {
    const clicks: string[] = []
    const store = new Map<string, string>()
    stubDownload(clicks, store)

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    expect(autoDownloadOnce('job-1', blob, 'photo-compressed.png')).toBe(true)
    expect(autoDownloadOnce('job-1', blob, 'photo-compressed.png')).toBe(false)
    expect(autoDownloadOnce('job-1', 'https://cdn.example/result.png', 'photo-compressed.png')).toBe(false)
    expect(clicks).toEqual(['blob:3:photo-compressed.png'])

    // Reset module state to simulate refresh / restored completed jobs.
    vi.resetModules()
    const { autoDownloadOnce: restored } = await import('./auto-download')
    expect(restored('job-1', 'https://cdn.example/result.png', 'again.png')).toBe(false)
    expect(restored('job-2', 'https://cdn.example/fresh.png', 'fresh.png')).toBe(true)
    expect(clicks).toEqual(['blob:3:photo-compressed.png', 'https://cdn.example/fresh.png:fresh.png'])
  })
})

function stubDownload(clicks: string[], store: Map<string, string>): void {
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  })
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => `blob:${blob.size}`,
    revokeObjectURL: () => undefined,
  })
  vi.stubGlobal('document', {
    createElement: () => {
      const anchor = { href: '', download: '', click() { clicks.push(`${anchor.href}:${anchor.download}`) } }
      return anchor
    },
  })
}

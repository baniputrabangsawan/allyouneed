import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadFile } from './files'

afterEach(() => vi.unstubAllGlobals())

describe('uploadFile', () => {
  it('reports upload progress through XMLHttpRequest', async () => {
    const percents: number[] = []
    vi.stubGlobal('XMLHttpRequest', class {
      status = 200
      upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
      onload: (() => void) | null = null
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 80 })
        this.onload?.()
      }
    })

    await uploadFile(
      { uploadUrl: 'https://upload.example.test/file', fileKey: 'file-key', expiresIn: 60 },
      new Blob(['abcd']),
      { onProgress: (percent) => percents.push(percent) },
    )

    expect(percents).toEqual([50])
  })

  it('prefixes relative upload URLs with the API origin', async () => {
    let opened = ''
    vi.stubGlobal('XMLHttpRequest', class {
      status = 204
      upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
      onload: (() => void) | null = null
      open(_method: string, url: string) { opened = url }
      setRequestHeader() {}
      send() { this.onload?.() }
    })

    await uploadFile(
      { uploadUrl: '/api/v1/uploads/local/file-key', fileKey: 'file-key', expiresIn: 60 },
      new Blob(['abcd']),
      { onProgress: () => undefined },
    )

    expect(opened).toMatch(/\/api\/v1\/uploads\/local\/file-key$/)
    expect(opened.startsWith('http')).toBe(true)
  })
})

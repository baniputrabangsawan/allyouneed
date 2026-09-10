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
})

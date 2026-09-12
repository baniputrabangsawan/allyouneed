import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultMergeOptions, MERGE_ERROR } from '@/features/image/merge-png-utils'
import { mergePngImages } from './merge-png'

function pngHeader(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes.buffer
}

function pngFile(name: string, width: number, height: number) {
  return {
    file: new File([pngHeader(width, height)], name, { type: 'image/png' }),
    width,
    height,
  }
}

describe('merge png canvas export', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws sources onto one PNG canvas at the computed size and closes bitmaps', async () => {
    const draws: Array<{ x: number; y: number; width: number; height: number }> = []
    const closed: string[] = []
    const liveUrls = new Set<string>()
    let nextUrl = 0

    vi.stubGlobal('URL', {
      createObjectURL() {
        const url = `blob:merge-${nextUrl += 1}`
        liveUrls.add(url)
        return url
      },
      revokeObjectURL(url: string) {
        liveUrls.delete(url)
      },
    })
    vi.stubGlobal('createImageBitmap', async (source: { name?: string; width?: number; height?: number }) => {
      const width = source.width ?? 100
      const height = source.height ?? 50
      return {
        width,
        height,
        close() { closed.push(source.name ?? `${width}x${height}`) },
      }
    })
    vi.stubGlobal('document', {
      createElement(tag: string) {
        if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`)
        const canvas = {
          width: 0,
          height: 0,
          getContext() {
            return {
              fillStyle: '',
              fillRect() {},
              clearRect() {},
              drawImage(_bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
                draws.push({ x, y, width, height })
              },
            }
          },
          toBlob(callback: BlobCallback) {
            callback(new Blob([pngHeader(canvas.width, canvas.height)], { type: 'image/png' }))
          },
        }
        return canvas
      },
    })

    const result = await mergePngImages(
      [pngFile('a.png', 100, 50), pngFile('b.png', 200, 70)],
      { ...defaultMergeOptions(), layout: 'vertical', gap: 10 },
      null,
    )
    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    expect(result.blob.type).toBe('image/png')
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(result.width).toBe(200)
    expect(result.height).toBe(130)
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.blob.size).toBe(result.optimizedSize)
    expect(draws).toEqual([
      { x: 50, y: 0, width: 100, height: 50 },
      { x: 0, y: 60, width: 200, height: 70 },
    ])
    expect(closed).toHaveLength(2)
    expect(liveUrls.size).toBe(0)
  })

  it('maps canvas export failure to MERGE_EXPORT', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4, height: 4, close() {} }))
    vi.stubGlobal('document', {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext() { return { fillStyle: '', fillRect() {}, clearRect() {}, drawImage() {} } },
          toBlob(callback: BlobCallback) { callback(null) },
        }
      },
    })
    await expect(mergePngImages(
      [pngFile('a.png', 4, 4), pngFile('b.png', 4, 4)],
      defaultMergeOptions(),
      null,
    )).rejects.toThrow(MERGE_ERROR.export)
  })
})

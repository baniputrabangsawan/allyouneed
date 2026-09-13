import { describe, expect, it, vi } from 'vitest'
import { encodePngRgba } from './png-codec'
import { optimizeImageOutput, rasterEncodeQuality } from './image-optimize'

function screenshotPng(width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const chrome = y < 8 || x < 10
      rgba[index] = chrome ? 245 : 255
      rgba[index + 1] = chrome ? 245 : 255
      rgba[index + 2] = chrome ? 248 : 255
      rgba[index + 3] = 255
    }
  }
  return encodePngRgba({ width, height, rgba, hasAlpha: false })
}

function rgbaGraphic(width: number, height: number, alpha = 255) {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      rgba[index] = x < width / 2 ? 220 : 40
      rgba[index + 1] = y < height / 2 ? 40 : 160
      rgba[index + 2] = 80
      rgba[index + 3] = (x + y) % 5 === 0 ? alpha : 255
    }
  }
  return encodePngRgba({ width, height, rgba, hasAlpha: alpha < 255 || rgba[3] !== 255 })
}

describe('optimizeImageOutput', () => {
  it('keeps JPEG and WebP bytes and MIME unchanged', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    const webp = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'image/webp' })
    const jpegOut = await optimizeImageOutput(jpeg, { mime: 'image/jpeg' })
    const webpOut = await optimizeImageOutput(webp, { mime: 'image/webp' })
    expect(jpegOut.blob).toBe(jpeg)
    expect(jpegOut.mime).toBe('image/jpeg')
    expect(jpegOut.optimizedSize).toBe(jpeg.size)
    expect(webpOut.blob).toBe(webp)
    expect(webpOut.mime).toBe('image/webp')
    expect(rasterEncodeQuality('image/jpeg', 'auto')).toBeGreaterThan(0.8)
    expect(rasterEncodeQuality('image/webp', 'auto')).toBeGreaterThan(0.75)
  })

  it('never returns a larger PNG and preserves dimensions', async () => {
    const bytes = rgbaGraphic(48, 32)
    const source = new Blob([Uint8Array.from(bytes)], { type: 'image/png' })
    const result = await optimizeImageOutput(source, { mime: 'image/png', mode: 'auto', enabled: true })
    expect(result.mime).toBe('image/png')
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.blob.size).toBe(result.optimizedSize)
    expect(result.blob.type).toBe('image/png')
    expect(result.width).toBe(48)
    expect(result.height).toBe(32)
    expect(result.savedBytes).toBe(result.originalSize - result.optimizedSize)
  })

  it('skips PNG work unless enabled is true', async () => {
    const source = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    const omitted = await optimizeImageOutput(source, { mime: 'image/png' })
    expect(omitted.blob).toBe(source)
    const skipped = await optimizeImageOutput(source, { mime: 'image/png', enabled: false })
    expect(skipped.blob).toBe(source)
    const fallback = await optimizeImageOutput(source, { mime: 'image/png', enabled: true })
    expect(fallback.blob).toBe(source)
    expect(fallback.optimizedSize).toBe(source.size)
  })

  it('keeps screenshot-like PNG dimensions and MIME and never grows the file', async () => {
    const bytes = screenshotPng(64, 40)
    const source = new Blob([Uint8Array.from(bytes)], { type: 'image/png' })
    const result = await optimizeImageOutput(source, { mime: 'image/png', mode: 'auto', enabled: true })
    expect(result.mime).toBe('image/png')
    expect(result.blob.type).toBe('image/png')
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.width).toBe(64)
    expect(result.height).toBe(40)
  })
})

describe('exportCanvasImage', () => {
  it('encodes once then keeps the smaller PNG', async () => {
    const { exportCanvasImage } = await import('./image-optimize')
    const draws: string[] = []
    vi.stubGlobal('document', {
      createElement() {
        throw new Error('should not create extra canvases')
      },
    })
    const canvas = {
      width: 16,
      height: 12,
      toBlob(callback: BlobCallback, mime?: string) {
        draws.push(mime ?? '')
        callback(new Blob([Uint8Array.from(rgbaGraphic(16, 12))], { type: 'image/png' }))
      },
    } as unknown as HTMLCanvasElement
    const result = await exportCanvasImage(canvas, 'image/png', { enabled: true })
    expect(draws).toEqual(['image/png'])
    expect(result.mime).toBe('image/png')
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    const passthrough = await exportCanvasImage(canvas, 'image/png')
    expect(passthrough.savedBytes).toBe(0)
    expect(result.width).toBe(16)
    expect(result.height).toBe(12)
    vi.unstubAllGlobals()
  })
})

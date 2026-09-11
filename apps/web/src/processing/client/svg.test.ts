import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isPngSignature, parseSvgMarkup, readDimensions, readPngSize, resolveOutputSize, svgToPng,
} from './svg'

const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16" viewBox="0 0 32 16"><rect width="32" height="16" fill="#00ff00"/></svg>'

describe('svg dimension parsing', () => {
  it('prefers width and height, then viewBox, then the SVG fallback', () => {
    expect(readDimensions('32px', '16px', '0 0 100 50')).toEqual({ width: 32, height: 16, source: 'width-height' })
    expect(readDimensions(undefined, undefined, '0 0 80 40')).toEqual({ width: 80, height: 40, source: 'viewBox' })
    expect(readDimensions('100%', '100%', '0 0 64 32')).toEqual({ width: 64, height: 32, source: 'width-height' })
    expect(readDimensions()).toEqual({ width: 300, height: 150, source: 'fallback' })
  })

  it('scales output and preserves aspect ratio unless unlocked', () => {
    expect(resolveOutputSize({ width: 32, height: 16 }, { scale: 2 })).toEqual({ width: 64, height: 32 })
    expect(resolveOutputSize({ width: 32, height: 16 }, { width: 80, preserveAspectRatio: true })).toEqual({ width: 80, height: 40 })
    expect(resolveOutputSize({ width: 32, height: 16 }, { width: 80, height: 10, preserveAspectRatio: false })).toEqual({ width: 80, height: 10 })
  })
})

describe('svg validation and isolation', () => {
  it('rejects non-svg markup', () => {
    expect(() => parseSvgMarkup('')).toThrow('empty')
    expect(() => parseSvgMarkup('<div>not svg</div>')).toThrow('not valid SVG')
  })

  it('strips scripts and reports unsupported external resources', () => {
    const parsed = parseSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <script>alert(1)</script>
      <image href="https://example.com/pixel.png"/>
      <rect width="10" height="10" onclick="alert(1)" fill="red"/>
      <style>@font-face { src: url(https://fonts.example.com/x.woff2) } .ok { fill: url(#paint) }</style>
      <image href="data:image/png;base64,AAAA"/>
    </svg>`)
    expect(parsed.markup.toLowerCase()).not.toContain('<script')
    expect(parsed.markup.toLowerCase()).not.toContain('onclick')
    expect(parsed.markup).not.toContain('https://example.com/pixel.png')
    expect(parsed.warnings.some((warning) => warning.includes('https://example.com/pixel.png'))).toBe(true)
    expect(parsed.warnings.some((warning) => warning.includes('https://fonts.example.com/x.woff2'))).toBe(true)
    expect(parsed.markup).toContain('data:image/png;base64,AAAA')
  })
})

describe('svg to png rasterization', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports a real PNG blob with the requested dimensions and revokes object URLs', async () => {
    const liveUrls = new Set<string>()
    let nextUrl = 0
    vi.stubGlobal('URL', {
      createObjectURL() {
        const url = `blob:svg-test-${nextUrl += 1}`
        liveUrls.add(url)
        return url
      },
      revokeObjectURL(url: string) {
        liveUrls.delete(url)
      },
    })
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 0
      height = 0
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    })
    vi.stubGlobal('createImageBitmap', async (image: { width: number; height: number }) => ({
      width: image.width,
      height: image.height,
      close() {},
    }))
    vi.stubGlobal('document', {
      createElement(tag: string) {
        if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`)
        const canvas = {
          width: 0,
          height: 0,
          getContext() {
            return { fillStyle: '', fillRect() {}, clearRect() {}, drawImage() {} }
          },
          toBlob(callback: BlobCallback) {
            callback(new Blob([pngHeader(canvas.width, canvas.height)], { type: 'image/png' }))
          },
        }
        return canvas
      },
    })

    const result = await svgToPng(TINY_SVG, { width: 32, height: 16, scale: 1, background: 'transparent' })
    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    expect(result.blob.type).toBe('image/png')
    expect(isPngSignature(bytes)).toBe(true)
    expect(readPngSize(bytes)).toEqual({ width: 32, height: 16 })
    expect(result.width).toBe(32)
    expect(result.height).toBe(16)
    expect(liveUrls.size).toBe(0)
  })
})

function pngHeader(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes.buffer
}

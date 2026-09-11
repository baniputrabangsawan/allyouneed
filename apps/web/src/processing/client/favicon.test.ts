import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FAVICON_ICO_FILENAME,
  FAVICON_ICO_MIME,
  FAVICON_PNG_ASSETS,
  FAVICON_PNG_MIME,
  FAVICON_ZIP_MIME,
  type FaviconFile,
} from '@/features/image/favicon-utils'
import { assembleFaviconPack, generateFaviconPack } from './favicon'
import { isPngSignature, readPngSize } from './svg'

function pngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('favicon pack assembly', () => {
  it('adds ICO and ZIP with the correct MIME types and HTML snippet', async () => {
    const pngFiles: FaviconFile[] = FAVICON_PNG_ASSETS.map((asset) => ({
      filename: asset.filename,
      blob: new Blob([pngHeader(asset.width, asset.height)], { type: FAVICON_PNG_MIME }),
      mime: FAVICON_PNG_MIME,
      width: asset.width,
      height: asset.height,
    }))
    const pack = await assembleFaviconPack(pngFiles)
    expect(pack.files).toHaveLength(FAVICON_PNG_ASSETS.length + 1)
    for (const asset of FAVICON_PNG_ASSETS) {
      const file = pack.files.find((entry) => entry.filename === asset.filename)
      expect(file?.mime).toBe(FAVICON_PNG_MIME)
      expect(file?.blob.type).toBe(FAVICON_PNG_MIME)
      expect(file?.width).toBe(asset.width)
      expect(file?.height).toBe(asset.height)
      const size = readPngSize(new Uint8Array(await file!.blob.arrayBuffer()))
      expect(size).toEqual({ width: asset.width, height: asset.height })
    }
    const ico = pack.files.find((entry) => entry.filename === FAVICON_ICO_FILENAME)
    expect(ico?.mime).toBe(FAVICON_ICO_MIME)
    expect(ico?.blob.type).toBe(FAVICON_ICO_MIME)
    const icoBytes = new Uint8Array(await ico!.blob.arrayBuffer())
    expect(new DataView(icoBytes.buffer).getUint16(2, true)).toBe(1)
    expect(pack.zip.type).toBe(FAVICON_ZIP_MIME)
    expect(new DataView(await pack.zip.arrayBuffer()).getUint32(0, true)).toBe(0x04034b50)
    expect(pack.html).toContain(`href="/${FAVICON_ICO_FILENAME}"`)
    expect(pack.html).toContain('rel="apple-touch-icon"')
    expect(pack.html).toContain('sizes="512x512"')
  })
})

describe('favicon generation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders every PNG size with the requested MIME type', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 64,
      height: 32,
      close() {},
    }))
    vi.stubGlobal('document', {
      createElement(tag: string) {
        if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`)
        const canvas = {
          width: 0,
          height: 0,
          getContext() {
            return {
              clearRect() {},
              drawImage() {},
              imageSmoothingEnabled: true,
              imageSmoothingQuality: 'high',
            }
          },
          toBlob(callback: BlobCallback) {
            callback(new Blob([pngHeader(canvas.width, canvas.height)], { type: FAVICON_PNG_MIME }))
          },
        }
        return canvas
      },
    })

    const pack = await generateFaviconPack(new File(['source'], 'logo.png', { type: 'image/png' }), { fit: 'contain' })
    expect(pack.files.filter((file) => file.mime === FAVICON_PNG_MIME)).toHaveLength(FAVICON_PNG_ASSETS.length)
    for (const asset of FAVICON_PNG_ASSETS) {
      const file = pack.files.find((entry) => entry.filename === asset.filename)
      const bytes = new Uint8Array(await file!.blob.arrayBuffer())
      expect(file?.mime).toBe(FAVICON_PNG_MIME)
      expect(isPngSignature(bytes)).toBe(true)
      expect(readPngSize(bytes)).toEqual({ width: asset.width, height: asset.height })
    }
    expect(pack.files.some((file) => file.filename === FAVICON_ICO_FILENAME && file.mime === FAVICON_ICO_MIME)).toBe(true)
    expect(pack.zip.type).toBe(FAVICON_ZIP_MIME)
  })
})

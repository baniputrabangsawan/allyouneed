import { describe, expect, it } from 'vitest'
import {
  buildFaviconHtml,
  encodeIco,
  encodeZip,
  ensureSvgSize,
  FAVICON_ACCEPT,
  FAVICON_ICO_FILENAME,
  FAVICON_ICO_MIME,
  FAVICON_PNG_ASSETS,
  FAVICON_PNG_MIME,
  FAVICON_ZIP_MIME,
  isSvgFile,
  objectFitRect,
} from './favicon-utils'
import { fileMatchesAccept } from './image-utils'

describe('favicon crop behavior', () => {
  it('covers the square by overflowing the shorter side', () => {
    expect(objectFitRect({ width: 200, height: 100 }, { width: 32, height: 32 }, 'cover'))
      .toEqual({ x: -16, y: 0, width: 64, height: 32 })
  })

  it('contains the whole image and leaves transparent letterbox space', () => {
    expect(objectFitRect({ width: 200, height: 100 }, { width: 32, height: 32 }, 'contain'))
      .toEqual({ x: 0, y: 8, width: 32, height: 16 })
  })
})

describe('favicon encodings', () => {
  it('builds an ICO with PNG payloads and the requested sizes', () => {
    const first = new Uint8Array([1, 2, 3, 4])
    const second = new Uint8Array([9, 8, 7])
    const bytes = encodeIco([
      { width: 16, height: 16, data: first },
      { width: 32, height: 32, data: second },
    ])
    const view = new DataView(bytes.buffer)
    expect(view.getUint16(0, true)).toBe(0)
    expect(view.getUint16(2, true)).toBe(1)
    expect(view.getUint16(4, true)).toBe(2)
    expect(bytes[6]).toBe(16)
    expect(bytes[7]).toBe(16)
    expect(view.getUint16(6 + 6, true)).toBe(32)
    expect(bytes.subarray(6 + 16 * 2, 6 + 16 * 2 + 4)).toEqual(first)
  })

  it('builds a store-only ZIP with local and central headers', () => {
    const payload = new TextEncoder().encode('hello')
    const bytes = encodeZip([{ name: 'readme.txt', data: payload }])
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(bytes.subarray(30, 40)).toEqual(new TextEncoder().encode('readme.txt'))
    expect(bytes.subarray(40, 45)).toEqual(payload)
    expect(view.getUint32(45, true)).toBe(0x02014b50)
    expect(view.getUint32(45 + 46 + 10, true)).toBe(0x06054b50)
  })

  it('emits HTML for ICO, PNG icons, and the Apple touch icon', () => {
    const html = buildFaviconHtml([
      { filename: 'favicon-16x16.png' },
      { filename: 'apple-touch-icon.png' },
      { filename: FAVICON_ICO_FILENAME },
    ])
    expect(html).toContain(`<link rel="icon" type="${FAVICON_ICO_MIME}" href="/${FAVICON_ICO_FILENAME}">`)
    expect(html).toContain('<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">')
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">')
  })

  it('accepts PNG, JPEG, WebP, and SVG uploads', () => {
    expect(fileMatchesAccept({ name: 'mark.svg', size: 10, type: 'image/svg+xml' }, FAVICON_ACCEPT)).toBe(true)
    expect(fileMatchesAccept({ name: 'mark.PNG', size: 10, type: 'image/png' }, FAVICON_ACCEPT)).toBe(true)
    expect(fileMatchesAccept({ name: 'mark.webp', size: 10, type: '' }, FAVICON_ACCEPT)).toBe(true)
    expect(fileMatchesAccept({ name: 'mark.gif', size: 10, type: 'image/gif' }, FAVICON_ACCEPT)).toBe(false)
    expect(isSvgFile({ name: 'mark.SVG', type: '' })).toBe(true)
  })

  it('adds SVG width and height when only a viewBox is present', () => {
    expect(ensureSvgSize('<svg viewBox="0 0 64 32"></svg>')).toContain('width="64"')
    expect(ensureSvgSize('<svg viewBox="0 0 64 32"></svg>')).toContain('height="32"')
  })

  it('lists the required PNG sizes', () => {
    expect(FAVICON_PNG_ASSETS.map((asset) => `${asset.width}x${asset.height}`)).toEqual([
      '16x16', '32x32', '48x48', '180x180', '192x192', '512x512',
    ])
    expect(FAVICON_PNG_MIME).toBe('image/png')
    expect(FAVICON_ZIP_MIME).toBe('application/zip')
  })
})

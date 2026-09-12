import { deflate } from 'pako'
import { describe, expect, it } from 'vitest'
import { decodePngRgba, isPngSignature, readPngSize } from './png-codec'
import { compressPng } from './png-compress'

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

describe('png compression pipeline', () => {
  it('shrinks an uncompressed few-color PNG without changing pixels in lossless mode', () => {
    const source = graphicPng(96, 64)
    const result = compressPng(source, { mode: 'lossless' })
    expect(isPngSignature(result.bytes)).toBe(true)
    expect(result.compressedSize).toBeLessThan(result.originalSize * 0.35)
    expect(result.savedBytes).toBe(result.originalSize - result.compressedSize)
    expect(result.savedRatio).toBeCloseTo(result.savedBytes / result.originalSize)
    expect(result.quantized).toBe(false)
    expect(result.width).toBe(96)
    expect(result.height).toBe(64)
    expect(decodePngRgba(result.bytes).rgba).toEqual(decodePngRgba(source).rgba)
  })

  it('quantizes a photographic PNG in balanced mode and recommends WebP', () => {
    const source = photoPng(80, 60)
    const result = compressPng(source, { mode: 'balanced' })
    expect(result.compressedSize).toBeLessThan(result.originalSize * 0.5)
    expect(result.compressedSize).toBeLessThanOrEqual(result.originalSize)
    expect(readPngSize(result.bytes)).toEqual({ width: 80, height: 60 })
    expect(result.recommendWebp).toBe(true)
    expect(result.quantized).toBe(true)
    const decoded = decodePngRgba(result.bytes)
    expect(decoded.hasAlpha).toBe(false)
    expect(decoded.rgba.length).toBe(80 * 60 * 4)
  })

  it('preserves transparency and never returns a larger file', () => {
    const source = transparentPng(48, 48)
    const original = decodePngRgba(source)
    const result = compressPng(source, { mode: 'balanced' })
    expect(result.compressedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.hasAlpha).toBe(true)
    const decoded = decodePngRgba(result.bytes)
    expect(decoded.width).toBe(48)
    expect(decoded.height).toBe(48)
    for (let index = 3; index < original.rgba.length; index += 4) {
      const sourceAlpha = original.rgba[index] ?? 0
      const nextAlpha = decoded.rgba[index] ?? 0
      if (sourceAlpha === 0) expect(nextAlpha).toBe(0)
      if (sourceAlpha === 255) expect(nextAlpha).toBe(255)
    }
    const again = compressPng(result.bytes, { mode: 'lossless' })
    expect(again.compressedSize).toBeLessThanOrEqual(again.originalSize)
  })

  it('strips metadata and skips quantization on animated PNG', () => {
    const source = animatedPng(16, 16)
    const result = compressPng(source, { mode: 'strong' })
    expect(result.width).toBe(16)
    expect(result.height).toBe(16)
    expect(result.quantized).toBe(false)
    expect(result.compressedSize).toBeLessThan(result.originalSize)
    expect(chunkNames(result.bytes)).not.toContain('tEXt')
    expect(chunkNames(result.bytes)).toContain('acTL')
  })
})

function graphicPng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  const colors = [
    [220, 40, 40, 255],
    [40, 160, 70, 255],
    [40, 80, 210, 255],
    [240, 200, 40, 255],
    [20, 20, 20, 255],
    [250, 250, 250, 255],
    [130, 70, 180, 255],
    [30, 180, 180, 255],
  ] as const
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[((x < width / 2 ? 0 : 1) + (y < height / 2 ? 0 : 2) + (x + y) % 4) % colors.length] ?? colors[0]
      const index = (y * width + x) * 4
      rgba[index] = color[0]
      rgba[index + 1] = color[1]
      rgba[index + 2] = color[2]
      rgba[index + 3] = color[3]
    }
  }
  return storeRgbaPng(width, height, rgba, 'Comment')
}

function photoPng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const noise = ((x * 73 + y * 149) % 47) - 23
      const index = (y * width + x) * 4
      rgba[index] = clamp(x * 255 / width + noise)
      rgba[index + 1] = clamp(y * 255 / height + noise * 0.6)
      rgba[index + 2] = clamp(((x + y) * 255) / (width + height) + ((x * y) % 53) - 20)
      rgba[index + 3] = 255
    }
  }
  return storeRgbaPng(width, height, rgba)
}

function transparentPng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const transparent = (x + y) % 2 === 0
      rgba[index] = 200
      rgba[index + 1] = 30
      rgba[index + 2] = 60
      rgba[index + 3] = transparent ? 0 : 255
    }
  }
  return storeRgbaPng(width, height, rgba)
}

function animatedPng(width: number, height: number): Uint8Array {
  const base = storeRgbaPng(width, height, new Uint8Array(width * height * 4).fill(255), 'Software')
  const chunks = readChunks(base)
  const actl = new Uint8Array(8)
  const view = new DataView(actl.buffer)
  view.setUint32(0, 1)
  view.setUint32(4, 0)
  const iend = chunks.findIndex((chunk) => chunk.name === 'IEND')
  chunks.splice(iend < 0 ? chunks.length : iend, 0, { name: 'acTL', data: actl })
  return writeChunks(chunks)
}

function storeRgbaPng(width: number, height: number, rgba: Uint8Array, text?: string): Uint8Array {
  const rowBytes = width * 4
  const raw = new Uint8Array(height * (rowBytes + 1))
  for (let y = 0; y < height; y += 1) {
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1)
  }
  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = new Uint8Array(deflate(raw, { level: 0 }))
  const chunks: { name: string; data: Uint8Array<ArrayBufferLike> }[] = [
    { name: 'IHDR', data: ihdr },
    { name: 'IDAT', data: idat },
  ]
  if (text) chunks.push({ name: 'tEXt', data: textBytes('Comment', text) })
  chunks.push({ name: 'IEND', data: new Uint8Array(0) })
  return writeChunks(chunks)
}

function textBytes(keyword: string, text: string): Uint8Array {
  const bytes = new Uint8Array(keyword.length + 1 + text.length)
  for (let index = 0; index < keyword.length; index += 1) bytes[index] = keyword.charCodeAt(index)
  for (let index = 0; index < text.length; index += 1) bytes[keyword.length + 1 + index] = text.charCodeAt(index)
  return bytes
}

function readChunks(bytes: Uint8Array): { name: string; data: Uint8Array }[] {
  const chunks: { name: string; data: Uint8Array }[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const name = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0)
    chunks.push({ name, data: bytes.slice(offset + 8, offset + 8 + length) })
    offset += 12 + length
    if (name === 'IEND') break
  }
  return chunks
}

function chunkNames(bytes: Uint8Array): string[] {
  return readChunks(bytes).map((chunk) => chunk.name)
}

function writeChunks(chunks: readonly { name: string; data: Uint8Array<ArrayBufferLike> }[]): Uint8Array {
  let length = 8
  for (const chunk of chunks) length += 12 + chunk.data.length
  const bytes = new Uint8Array(length)
  bytes.set(PNG_SIG)
  let offset = 8
  const view = new DataView(bytes.buffer)
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.length)
    bytes[offset + 4] = chunk.name.charCodeAt(0)
    bytes[offset + 5] = chunk.name.charCodeAt(1)
    bytes[offset + 6] = chunk.name.charCodeAt(2)
    bytes[offset + 7] = chunk.name.charCodeAt(3)
    bytes.set(chunk.data, offset + 8)
    const crcEnd = offset + 8 + chunk.data.length
    view.setUint32(crcEnd, crc32(bytes.subarray(offset + 4, crcEnd)))
    offset = crcEnd + 4
  }
  return bytes
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 255] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  CRC_TABLE[index] = crc
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

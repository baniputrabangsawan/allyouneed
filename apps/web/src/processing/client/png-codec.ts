import { convertIndexedToRgb, decode, hasPngSignature } from 'fast-png'
import { deflate } from 'pako'
import { isPngSignature, readPngSize } from './svg'

export { isPngSignature, readPngSize }

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRITICAL_CHUNKS: Record<string, true> = {
  IHDR: true, PLTE: true, tRNS: true, IDAT: true, IEND: true, acTL: true, fcTL: true, fdAT: true,
}
const CRC_TABLE = new Uint32Array(256)

for (let index = 0; index < 256; index += 1) {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  CRC_TABLE[index] = crc
}

export interface PngRgbaImage {
  width: number
  height: number
  rgba: Uint8Array
  hasAlpha: boolean
}

export interface PngPaletteColor {
  r: number
  g: number
  b: number
  a: number
}

export interface PngChunk {
  name: string
  data: Uint8Array
}

export function pngHasAnimation(bytes: Uint8Array): boolean {
  return readPngChunks(bytes).some((chunk) => chunk.name === 'acTL')
}

export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const chunks = readPngChunks(bytes).filter((chunk) => CRITICAL_CHUNKS[chunk.name])
  if (!chunks.some((chunk) => chunk.name === 'IHDR') || !chunks.some((chunk) => chunk.name === 'IEND')) {
    throw new Error('Not a PNG.')
  }
  return serializePng(chunks)
}

export function decodePngRgba(bytes: Uint8Array): PngRgbaImage {
  if (!hasPngSignature(bytes) && !isPngSignature(bytes)) throw new Error('Not a PNG.')
  const decoded = decode(bytes)
  const width = decoded.width
  const height = decoded.height
  const pixels = width * height
  const rgba = new Uint8Array(pixels * 4)
  if (decoded.palette) {
    const converted = convertIndexedToRgb(decoded)
    const channels = converted.length / pixels
    if (channels === 4) rgba.set(converted)
    else copyChannels(converted, rgba, pixels, 3, 255)
    return { width, height, rgba, hasAlpha: hasUsefulAlpha(rgba) }
  }
  const source = toUint8(decoded.data, decoded.depth)
  if (decoded.channels === 4) rgba.set(source)
  else if (decoded.channels === 3) copyChannels(source, rgba, pixels, 3, 255)
  else if (decoded.channels === 2) {
    for (let index = 0; index < pixels; index += 1) {
      const gray = source[index * 2] ?? 0
      rgba[index * 4] = gray
      rgba[index * 4 + 1] = gray
      rgba[index * 4 + 2] = gray
      rgba[index * 4 + 3] = source[index * 2 + 1] ?? 255
    }
  } else {
    for (let index = 0; index < pixels; index += 1) {
      const gray = source[index] ?? 0
      rgba[index * 4] = gray
      rgba[index * 4 + 1] = gray
      rgba[index * 4 + 2] = gray
      rgba[index * 4 + 3] = 255
    }
  }
  applyColorKey(rgba, decoded.channels, decoded.transparency)
  return { width, height, rgba, hasAlpha: hasUsefulAlpha(rgba) }
}

export function encodePngRgba(image: PngRgbaImage): Uint8Array {
  if (image.hasAlpha) return encodeRaw(image.width, image.height, image.rgba, 4)
  const rgb = new Uint8Array(image.width * image.height * 3)
  for (let index = 0, rgbIndex = 0; index < image.rgba.length; index += 4, rgbIndex += 3) {
    rgb[rgbIndex] = image.rgba[index] ?? 0
    rgb[rgbIndex + 1] = image.rgba[index + 1] ?? 0
    rgb[rgbIndex + 2] = image.rgba[index + 2] ?? 0
  }
  if (isGrayscale(image.rgba)) {
    const gray = new Uint8Array(image.width * image.height)
    for (let index = 0, pixel = 0; index < image.rgba.length; index += 4, pixel += 1) gray[pixel] = image.rgba[index] ?? 0
    return encodeRaw(image.width, image.height, gray, 1)
  }
  return encodeRaw(image.width, image.height, rgb, 3)
}

export function encodePngIndexed(width: number, height: number, indices: Uint8Array, palette: readonly PngPaletteColor[]): Uint8Array {
  if (indices.length !== width * height) throw new Error('Indexed PNG data does not match dimensions.')
  if (palette.length === 0 || palette.length > 256) throw new Error('PNG palette must have 1 to 256 colors.')
  const plte = new Uint8Array(palette.length * 3)
  const alpha = new Uint8Array(palette.length)
  let hasAlpha = false
  for (let index = 0; index < palette.length; index += 1) {
    const color = palette[index]
    if (!color) continue
    plte[index * 3] = color.r
    plte[index * 3 + 1] = color.g
    plte[index * 3 + 2] = color.b
    alpha[index] = color.a
    if (color.a !== 255) hasAlpha = true
  }
  const chunks: PngChunk[] = [
    { name: 'IHDR', data: ihdr(width, height, 3) },
    { name: 'PLTE', data: plte },
  ]
  if (hasAlpha) {
    let last = alpha.length
    while (last > 0 && alpha[last - 1] === 255) last -= 1
    chunks.push({ name: 'tRNS', data: alpha.subarray(0, Math.max(1, last)) })
  }
  chunks.push({ name: 'IDAT', data: deflate(filterRows(indices, width, height, 1), { level: 9 }) })
  chunks.push({ name: 'IEND', data: new Uint8Array(0) })
  return serializePng(chunks)
}

export function hasUsefulAlpha(rgba: Uint8Array): boolean {
  for (let index = 3; index < rgba.length; index += 4) if (rgba[index] !== 255) return true
  return false
}

export function countUniqueColors(rgba: Uint8Array, limit = 4096): number {
  const seen = new Set<number>()
  for (let index = 0; index < rgba.length; index += 4) {
    seen.add((rgba[index] ?? 0) << 24 | (rgba[index + 1] ?? 0) << 16 | (rgba[index + 2] ?? 0) << 8 | (rgba[index + 3] ?? 255))
    if (seen.size > limit) return limit + 1
  }
  return seen.size
}

export function collectUniquePalette(rgba: Uint8Array): PngPaletteColor[] | null {
  const map = new Map<number, PngPaletteColor>()
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index] ?? 0
    const g = rgba[index + 1] ?? 0
    const b = rgba[index + 2] ?? 0
    const a = rgba[index + 3] ?? 255
    const key = r << 24 | g << 16 | b << 8 | a
    if (!map.has(key)) {
      if (map.size === 256) return null
      map.set(key, { r, g, b, a })
    }
  }
  return [...map.values()]
}

export function mapRgbaToIndices(rgba: Uint8Array, palette: readonly PngPaletteColor[]): Uint8Array {
  const lookup = new Map<number, number>()
  palette.forEach((color, index) => {
    lookup.set(color.r << 24 | color.g << 16 | color.b << 8 | color.a, index)
  })
  const indices = new Uint8Array(rgba.length / 4)
  for (let pixel = 0, index = 0; index < rgba.length; pixel += 1, index += 4) {
    const key = (rgba[index] ?? 0) << 24 | (rgba[index + 1] ?? 0) << 16 | (rgba[index + 2] ?? 0) << 8 | (rgba[index + 3] ?? 255)
    indices[pixel] = lookup.get(key) ?? nearestPaletteIndex(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0, rgba[index + 3] ?? 255, palette)
  }
  return indices
}

export function nearestPaletteIndex(r: number, g: number, b: number, a: number, palette: readonly PngPaletteColor[]): number {
  let best = 0
  let bestDistance = Infinity
  for (let index = 0; index < palette.length; index += 1) {
    const color = palette[index]
    if (!color) continue
    const distance = (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2 + (a - color.a) ** 2
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
      if (distance === 0) return index
    }
  }
  return best
}

function readPngChunks(bytes: Uint8Array): PngChunk[] {
  if (bytes.length < 33 || !isPngSignature(bytes)) throw new Error('Not a PNG.')
  const chunks: PngChunk[] = []
  let offset = 8
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const name = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) throw new Error('Not a PNG.')
    chunks.push({ name, data: bytes.subarray(dataStart, dataEnd) })
    offset = dataEnd + 4
    if (name === 'IEND') break
  }
  return chunks
}

function serializePng(chunks: readonly PngChunk[]): Uint8Array {
  let length = 8
  for (const chunk of chunks) length += 12 + chunk.data.length
  const bytes = new Uint8Array(length)
  bytes.set(PNG_SIGNATURE, 0)
  let offset = 8
  for (const chunk of chunks) {
    const view = new DataView(bytes.buffer)
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

function encodeRaw(width: number, height: number, data: Uint8Array, channels: number): Uint8Array {
  const colorType = channels === 4 ? 6 : channels === 3 ? 2 : channels === 2 ? 4 : 0
  return serializePng([
    { name: 'IHDR', data: ihdr(width, height, colorType) },
    { name: 'IDAT', data: deflate(filterRows(data, width, height, channels), { level: 9 }) },
    { name: 'IEND', data: new Uint8Array(0) },
  ])
}

function ihdr(width: number, height: number, colorType: number): Uint8Array {
  const data = new Uint8Array(13)
  const view = new DataView(data.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  data[8] = 8
  data[9] = colorType
  return data
}

function filterRows(data: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const rowBytes = width * bpp
  const output = new Uint8Array(height * (rowBytes + 1))
  const trial = new Uint8Array(rowBytes)
  const best = new Uint8Array(rowBytes)
  for (let row = 0; row < height; row += 1) {
    const current = data.subarray(row * rowBytes, (row + 1) * rowBytes)
    const prev = row === 0 ? null : data.subarray((row - 1) * rowBytes, row * rowBytes)
    let bestType = 0
    let bestScore = Infinity
    for (let type = 0; type < 5; type += 1) {
      const score = applyFilter(type, current, prev, bpp, trial)
      if (score < bestScore) {
        bestScore = score
        bestType = type
        best.set(trial)
      }
    }
    const offset = row * (rowBytes + 1)
    output[offset] = bestType
    output.set(best, offset + 1)
  }
  return output
}

function applyFilter(type: number, row: Uint8Array, prev: Uint8Array | null, bpp: number, out: Uint8Array): number {
  let score = 0
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bpp ? row[index - bpp] ?? 0 : 0
    const up = prev?.[index] ?? 0
    const upLeft = prev && index >= bpp ? prev[index - bpp] ?? 0 : 0
    const raw = row[index] ?? 0
    const filtered = type === 1 ? raw - left
      : type === 2 ? raw - up
        : type === 3 ? raw - ((left + up) >> 1)
          : type === 4 ? raw - paeth(left, up, upLeft)
            : raw
    const value = filtered & 255
    out[index] = value
    score += value < 128 ? value : 256 - value
  }
  return score
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const pa = Math.abs(estimate - left)
  const pb = Math.abs(estimate - up)
  const pc = Math.abs(estimate - upLeft)
  if (pa <= pb && pa <= pc) return left
  if (pb <= pc) return up
  return upLeft
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 255] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toUint8(data: Uint8Array | Uint8ClampedArray | Uint16Array, depth: number): Uint8Array {
  if (depth === 8 && data instanceof Uint8Array) return data
  if (depth === 8 && data instanceof Uint8ClampedArray) return new Uint8Array(data)
  const bytes = new Uint8Array(data.length)
  const max = depth === 16 ? 65535 : (1 << depth) - 1
  for (let index = 0; index < data.length; index += 1) bytes[index] = Math.round(((data[index] ?? 0) * 255) / max)
  return bytes
}

function copyChannels(source: Uint8Array, rgba: Uint8Array, pixels: number, channels: number, alpha: number): void {
  for (let index = 0; index < pixels; index += 1) {
    rgba[index * 4] = source[index * channels] ?? 0
    rgba[index * 4 + 1] = source[index * channels + 1] ?? 0
    rgba[index * 4 + 2] = source[index * channels + 2] ?? 0
    rgba[index * 4 + 3] = alpha
  }
}

function applyColorKey(rgba: Uint8Array, channels: number, transparency?: Uint16Array): void {
  if (!transparency || (channels !== 1 && channels !== 3)) return
  const keyR = Math.round(((transparency[0] ?? 0) * 255) / 65535)
  const keyG = channels === 1 ? keyR : Math.round(((transparency[1] ?? 0) * 255) / 65535)
  const keyB = channels === 1 ? keyR : Math.round(((transparency[2] ?? 0) * 255) / 65535)
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index] === keyR && rgba[index + 1] === keyG && rgba[index + 2] === keyB) rgba[index + 3] = 0
  }
}

function isGrayscale(rgba: Uint8Array): boolean {
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index] !== rgba[index + 1] || rgba[index] !== rgba[index + 2]) return false
  }
  return true
}

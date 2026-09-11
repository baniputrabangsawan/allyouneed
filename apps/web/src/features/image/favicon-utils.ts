export type FaviconFit = 'contain' | 'cover'

export interface DrawRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FaviconPngAsset {
  filename: string
  width: number
  height: number
  rel: 'icon' | 'apple-touch-icon'
  type: 'image/png'
}

export interface FaviconFile {
  filename: string
  blob: Blob
  mime: string
  width?: number
  height?: number
}

export const FAVICON_PNG_ASSETS: readonly FaviconPngAsset[] = [
  { filename: 'favicon-16x16.png', width: 16, height: 16, rel: 'icon', type: 'image/png' },
  { filename: 'favicon-32x32.png', width: 32, height: 32, rel: 'icon', type: 'image/png' },
  { filename: 'favicon-48x48.png', width: 48, height: 48, rel: 'icon', type: 'image/png' },
  { filename: 'apple-touch-icon.png', width: 180, height: 180, rel: 'apple-touch-icon', type: 'image/png' },
  { filename: 'android-chrome-192x192.png', width: 192, height: 192, rel: 'icon', type: 'image/png' },
  { filename: 'android-chrome-512x512.png', width: 512, height: 512, rel: 'icon', type: 'image/png' },
]

export const FAVICON_ICO_SIZES = [16, 32, 48] as const
export const FAVICON_ICO_FILENAME = 'favicon.ico'
export const FAVICON_ICO_MIME = 'image/x-icon'
export const FAVICON_ZIP_MIME = 'application/zip'
export const FAVICON_PNG_MIME = 'image/png'

export const FAVICON_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
] as const

export function objectFitRect(
  source: { width: number; height: number },
  destination: { width: number; height: number },
  fit: FaviconFit,
): DrawRect {
  if (source.width < 1 || source.height < 1 || destination.width < 1 || destination.height < 1) {
    throw new Error('Favicon sizes must be positive.')
  }
  const scale = fit === 'cover'
    ? Math.max(destination.width / source.width, destination.height / source.height)
    : Math.min(destination.width / source.width, destination.height / source.height)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  return {
    x: Math.round((destination.width - width) / 2),
    y: Math.round((destination.height - height) / 2),
    width,
    height,
  }
}

export function isSvgFile(file: { name: string; type: string }): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

export function ensureSvgSize(svg: string): string {
  const match = svg.match(/<svg\b[^>]*>/i)
  if (!match) throw new Error('This SVG could not be read.')
  const tag = match[0]
  if (/\bwidth\s*=/i.test(tag) && /\bheight\s*=/i.test(tag)) return svg
  const viewBox = tag.match(/viewBox\s*=\s*["']?\s*([0-9.+\-eE]+)[\s,]+([0-9.+\-eE]+)[\s,]+([0-9.+\-eE]+)[\s,]+([0-9.+\-eE]+)/i)
  const width = viewBox ? Math.max(1, Math.round(Number(viewBox[3]))) : 512
  const height = viewBox ? Math.max(1, Math.round(Number(viewBox[4]))) : 512
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('This SVG could not be read.')
  return svg.replace(tag, tag.replace(/<svg/i, `<svg width="${width}" height="${height}"`))
}

export function buildFaviconHtml(files: readonly { filename: string }[]): string {
  const names = new Set(files.map((file) => file.filename))
  const lines: string[] = []
  if (names.has(FAVICON_ICO_FILENAME)) {
    lines.push(`<link rel="icon" type="${FAVICON_ICO_MIME}" href="/${FAVICON_ICO_FILENAME}">`)
  }
  for (const asset of FAVICON_PNG_ASSETS) {
    if (!names.has(asset.filename)) continue
    if (asset.rel === 'apple-touch-icon') {
      lines.push(`<link rel="apple-touch-icon" sizes="${asset.width}x${asset.height}" href="/${asset.filename}">`)
      continue
    }
    lines.push(`<link rel="icon" type="${asset.type}" sizes="${asset.width}x${asset.height}" href="/${asset.filename}">`)
  }
  return lines.join('\n')
}

export function encodeIco(images: readonly { width: number; height: number; data: Uint8Array }[]): Uint8Array {
  if (images.length === 0 || images.length > 255) throw new Error('ICO files need between 1 and 255 images.')
  const headerSize = 6 + 16 * images.length
  let offset = headerSize
  const payload = images.map((image) => {
    if (image.width < 1 || image.height < 1 || image.width > 256 || image.height > 256) {
      throw new Error('ICO image sizes must be between 1 and 256 pixels.')
    }
    const entry = { ...image, offset }
    offset += image.data.byteLength
    return entry
  })
  const bytes = new Uint8Array(offset)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, payload.length, true)
  payload.forEach((image, index) => {
    const entry = 6 + index * 16
    bytes[entry] = image.width === 256 ? 0 : image.width
    bytes[entry + 1] = image.height === 256 ? 0 : image.height
    bytes[entry + 2] = 0
    bytes[entry + 3] = 0
    view.setUint16(entry + 4, 1, true)
    view.setUint16(entry + 6, 32, true)
    view.setUint32(entry + 8, image.data.byteLength, true)
    view.setUint32(entry + 12, image.offset, true)
    bytes.set(image.data, image.offset)
  })
  return bytes
}

export function encodeZip(files: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  if (files.length === 0) throw new Error('ZIP archives need at least one file.')
  const encoder = new TextEncoder()
  const records = files.map((file) => {
    if (!file.name || file.name.includes('\\') || file.name.includes('..')) {
      throw new Error('ZIP file names must be simple relative paths.')
    }
    const name = encoder.encode(file.name)
    return { name, data: file.data, crc: crc32(file.data) }
  })
  const localSize = records.reduce((total, file) => total + 30 + file.name.byteLength + file.data.byteLength, 0)
  const centralSize = records.reduce((total, file) => total + 46 + file.name.byteLength, 0)
  const bytes = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(bytes.buffer)
  let localOffset = 0
  const localOffsets: number[] = []
  for (const file of records) {
    localOffsets.push(localOffset)
    view.setUint32(localOffset, 0x04034b50, true)
    view.setUint16(localOffset + 4, 20, true)
    view.setUint16(localOffset + 8, 0, true)
    view.setUint32(localOffset + 14, file.crc, true)
    view.setUint32(localOffset + 18, file.data.byteLength, true)
    view.setUint32(localOffset + 22, file.data.byteLength, true)
    view.setUint16(localOffset + 26, file.name.byteLength, true)
    bytes.set(file.name, localOffset + 30)
    bytes.set(file.data, localOffset + 30 + file.name.byteLength)
    localOffset += 30 + file.name.byteLength + file.data.byteLength
  }
  let centralOffset = localOffset
  records.forEach((file, index) => {
    const start = centralOffset
    view.setUint32(start, 0x02014b50, true)
    view.setUint16(start + 4, 20, true)
    view.setUint16(start + 6, 20, true)
    view.setUint32(start + 16, file.crc, true)
    view.setUint32(start + 20, file.data.byteLength, true)
    view.setUint32(start + 24, file.data.byteLength, true)
    view.setUint16(start + 28, file.name.byteLength, true)
    view.setUint32(start + 42, localOffsets[index]!, true)
    bytes.set(file.name, start + 46)
    centralOffset += 46 + file.name.byteLength
  })
  view.setUint32(centralOffset, 0x06054b50, true)
  view.setUint16(centralOffset + 8, records.length, true)
  view.setUint16(centralOffset + 10, records.length, true)
  view.setUint32(centralOffset + 12, centralOffset - localOffset, true)
  view.setUint32(centralOffset + 16, localOffset, true)
  return bytes
}

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  CRC_TABLE[index] = value >>> 0
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

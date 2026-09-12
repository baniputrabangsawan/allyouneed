import { assertValidImageSize } from '@/features/image/image-utils'
import { createWorkReporter, type WorkReporter } from './process-stage'
import type { ProcessingProgress } from '@/processing/types/processing'
import {
  decodePngRgba,
  encodePngIndexedProgress,
  encodePngRgbaProgress,
  nearestPaletteIndex,
  pngHasAnimation,
  readPngSize,
  stripPngMetadata,
  type PngPaletteColor,
  type PngRgbaImage,
} from './png-codec'

export type PngCompressMode = 'lossless' | 'balanced' | 'strong'

export interface PngCompressResult {
  bytes: Uint8Array
  width: number
  height: number
  originalSize: number
  compressedSize: number
  savedBytes: number
  savedRatio: number
  quantized: boolean
  recommendWebp: boolean
  hasAlpha: boolean
}

interface Candidate {
  bytes: Uint8Array
  quantized: boolean
}

interface HistColor {
  r: number
  g: number
  b: number
  a: number
  count: number
}

const PHOTO_UNIQUE_LIMIT = 4096

export async function compressPng(bytes: Uint8Array, options: { mode?: PngCompressMode; onProgress?: (progress: ProcessingProgress) => void } = {}): Promise<PngCompressResult> {
  const mode = options.mode ?? 'balanced'
  const originalSize = bytes.byteLength
  const reporter = createWorkReporter(options.onProgress)
  reporter.setPlan(1)
  await reporter.setPhase('preparing', 'Preparing image...')
  const stripped = stripPngMetadata(bytes)
  if (pngHasAnimation(bytes)) {
    const size = readPngSize(bytes)
    await reporter.complete()
    return summarize(bytes, pickSmaller(bytes, stripped), originalSize, size.width, size.height, false, false, false)
  }
  const image = decodePngRgba(bytes)
  assertValidImageSize(image.width, image.height)
  const height = image.height
  const quantizeCounts = mode === 'strong' ? [256, 128, 64] : mode === 'lossless' ? [] : [256]
  const quantizePasses = quantizeCounts.length
  reporter.setPlan(4 + 4 * height + quantizePasses * (5 * height + 2))
  await reporter.add(1)
  const exactPalette = await analyzeColors(image, reporter)
  const candidates: Candidate[] = [
    { bytes, quantized: false },
    { bytes: stripped, quantized: false },
    { bytes: await encodeRgbaCandidate(image, reporter), quantized: false },
  ]
  if (exactPalette) {
    const indices = await mapPixels(image, exactPalette, reporter)
    candidates.push({ bytes: await encodeIndexedCandidate(image, indices, exactPalette, reporter), quantized: false })
  } else {
    for (const colors of quantizeCounts) {
      const palette = await medianCutPalette(image, colors, reporter)
      if (palette.length < 2) {
        await reporter.add(height + height + height + height + 1)
        continue
      }
      const unditheredError = await measurePaletteError(image, palette, reporter)
      const skipLowColorStrong = mode === 'strong' && colors < 256 && unditheredError > 40
      if (skipLowColorStrong) {
        await reporter.add(height + height + height + 1)
        continue
      }
      const indices = await mapPixels(image, palette, reporter)
      candidates.push({ bytes: await encodeIndexedCandidate(image, indices, palette, reporter), quantized: true })
      if (unditheredError > 6) {
        const dithered = await ditherToPalette(image, palette, reporter)
        candidates.push({ bytes: await encodeIndexedCandidate(image, dithered, palette, reporter), quantized: true })
      } else {
        await reporter.add(height + height + 1)
      }
    }
  }
  await reporter.setPhase('finalizing', 'Optimizing result...')
  const best = pickBest(candidates, originalSize)
  const unique = await countUniqueLive(image, reporter)
  await reporter.complete()
  return summarize(
    bytes,
    best.bytes,
    originalSize,
    image.width,
    image.height,
    best.quantized,
    unique > PHOTO_UNIQUE_LIMIT,
    image.hasAlpha,
  )
}

async function analyzeColors(image: PngRgbaImage, reporter: WorkReporter): Promise<PngPaletteColor[] | null> {
  await reporter.setPhase('compressing', 'Analyzing colors...')
  const { width, height, rgba } = image
  const map = new Map<number, PngPaletteColor>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const r = rgba[index] ?? 0
      const g = rgba[index + 1] ?? 0
      const b = rgba[index + 2] ?? 0
      const a = rgba[index + 3] ?? 255
      const key = r << 24 | g << 16 | b << 8 | a
      if (!map.has(key)) {
        if (map.size === 256) {
          await reporter.tickRows(y, height)
          await reporter.add(height - 1 - y)
          return null
        }
        map.set(key, { r, g, b, a })
      }
    }
    await reporter.tickRows(y, height)
  }
  return [...map.values()]
}

async function encodeRgbaCandidate(image: PngRgbaImage, reporter: WorkReporter): Promise<Uint8Array> {
  await reporter.setPhase('compressing', 'Encoding PNG...')
  const bytes = await encodePngRgbaProgress(image, {
    onFilterRow: (row, rows) => reporter.tickRows(row, rows),
    onBeforeDeflate: () => reporter.setPhase('compressing', 'Encoding PNG...'),
  })
  await reporter.add(1)
  return bytes
}

async function encodeIndexedCandidate(
  image: PngRgbaImage,
  indices: Uint8Array,
  palette: readonly PngPaletteColor[],
  reporter: WorkReporter,
): Promise<Uint8Array> {
  await reporter.setPhase('optimizing', 'Encoding PNG...')
  const bytes = await encodePngIndexedProgress(image.width, image.height, indices, palette, {
    onFilterRow: (row, rows) => reporter.tickRows(row, rows),
    onBeforeDeflate: () => reporter.setPhase('optimizing', 'Encoding PNG...'),
  })
  await reporter.add(1)
  return bytes
}

async function mapPixels(image: PngRgbaImage, palette: readonly PngPaletteColor[], reporter: WorkReporter): Promise<Uint8Array> {
  await reporter.setPhase('optimizing', 'Mapping pixels...')
  const { width, height, rgba } = image
  const lookup = new Map<number, number>()
  palette.forEach((color, index) => {
    lookup.set(color.r << 24 | color.g << 16 | color.b << 8 | color.a, index)
  })
  const indices = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const key = (rgba[index] ?? 0) << 24 | (rgba[index + 1] ?? 0) << 16 | (rgba[index + 2] ?? 0) << 8 | (rgba[index + 3] ?? 255)
      indices[y * width + x] = lookup.get(key) ?? nearestPaletteIndex(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0, rgba[index + 3] ?? 255, palette)
    }
    await reporter.tickRows(y, height)
  }
  return indices
}

async function countUniqueLive(image: PngRgbaImage, reporter: WorkReporter): Promise<number> {
  const { width, height, rgba } = image
  const seen = new Set<number>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      seen.add((rgba[index] ?? 0) << 24 | (rgba[index + 1] ?? 0) << 16 | (rgba[index + 2] ?? 0) << 8 | (rgba[index + 3] ?? 255))
      if (seen.size > PHOTO_UNIQUE_LIMIT) {
        await reporter.tickRows(y, height)
        await reporter.add(height - 1 - y)
        return PHOTO_UNIQUE_LIMIT + 1
      }
    }
    await reporter.tickRows(y, height)
  }
  return seen.size
}


function summarize(
  original: Uint8Array,
  compressed: Uint8Array,
  originalSize: number,
  width: number,
  height: number,
  quantized: boolean,
  recommendWebp: boolean,
  hasAlpha: boolean,
): PngCompressResult {
  const bytes = compressed.byteLength <= originalSize ? compressed : original
  const compressedSize = bytes.byteLength
  const savedBytes = Math.max(0, originalSize - compressedSize)
  return {
    bytes: bytes === original || bytes === compressed ? Uint8Array.from(bytes) : bytes,
    width,
    height,
    originalSize,
    compressedSize,
    savedBytes,
    savedRatio: originalSize > 0 ? savedBytes / originalSize : 0,
    quantized: bytes.byteLength === originalSize ? false : quantized,
    recommendWebp,
    hasAlpha,
  }
}

function pickBest(candidates: readonly Candidate[], originalSize: number): Candidate {
  let best = candidates[0] ?? { bytes: new Uint8Array(), quantized: false }
  for (const candidate of candidates) {
    if (candidate.bytes.byteLength === 0 || candidate.bytes.byteLength > originalSize) continue
    if (candidate.bytes.byteLength < best.bytes.byteLength || best.bytes.byteLength === 0) best = candidate
  }
  return best
}

function pickSmaller(first: Uint8Array, second: Uint8Array): Uint8Array {
  return second.byteLength < first.byteLength ? second : first
}

async function medianCutPalette(image: PngRgbaImage, maxColors: number, reporter: WorkReporter): Promise<PngPaletteColor[]> {
  await reporter.setPhase('optimizing', 'Quantizing colors...')
  const { width, height, rgba } = image
  const histogram = new Map<number, HistColor>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const r = rgba[index] ?? 0
      const g = rgba[index + 1] ?? 0
      const b = rgba[index + 2] ?? 0
      const a = rgba[index + 3] ?? 255
      const key = r << 24 | g << 16 | b << 8 | a
      const existing = histogram.get(key)
      if (existing) existing.count += 1
      else histogram.set(key, { r, g, b, a, count: 1 })
    }
    await reporter.tickRows(y, height)
  }
  let colors = [...histogram.values()]
  if (colors.length > 32_768) {
    const reduced = new Map<number, HistColor>()
    for (const color of colors) {
      const r = color.r & 0xf8
      const g = color.g & 0xf8
      const b = color.b & 0xf8
      const a = color.a < 16 ? 0 : color.a > 240 ? 255 : color.a & 0xf8
      const key = r << 24 | g << 16 | b << 8 | a
      const existing = reduced.get(key)
      if (existing) existing.count += color.count
      else reduced.set(key, { r, g, b, a, count: color.count })
    }
    colors = [...reduced.values()]
  }
  await reporter.add(1)
  if (colors.length <= maxColors) return colors.map(({ r, g, b, a }) => ({ r, g, b, a }))
  const boxes: HistColor[][] = [colors]
  while (boxes.length < maxColors) {
    let splitAt = -1
    let bestRange = 0
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index]
      if (!box || box.length < 2) continue
      const range = channelRange(box)
      if (range > bestRange) {
        bestRange = range
        splitAt = index
      }
    }
    if (splitAt < 0) break
    const box = boxes[splitAt] ?? []
    const channel = longestChannel(box)
    box.sort((left, right) => left[channel] - right[channel])
    const total = box.reduce((sum, color) => sum + color.count, 0)
    let running = 0
    let mid = Math.max(1, box.length >> 1)
    for (let index = 0; index < box.length - 1; index += 1) {
      running += box[index]?.count ?? 0
      if (running >= total / 2) {
        mid = index + 1
        break
      }
    }
    boxes[splitAt] = box.slice(0, mid)
    boxes.push(box.slice(mid))
  }
  return boxes.map((box) => averageBox(box))
}

function channelRange(box: readonly HistColor[]): number {
  let minR = 255, minG = 255, minB = 255, minA = 255
  let maxR = 0, maxG = 0, maxB = 0, maxA = 0
  for (const color of box) {
    if (color.r < minR) minR = color.r
    if (color.g < minG) minG = color.g
    if (color.b < minB) minB = color.b
    if (color.a < minA) minA = color.a
    if (color.r > maxR) maxR = color.r
    if (color.g > maxG) maxG = color.g
    if (color.b > maxB) maxB = color.b
    if (color.a > maxA) maxA = color.a
  }
  return Math.max(maxR - minR, maxG - minG, maxB - minB, maxA - minA)
}

function longestChannel(box: readonly HistColor[]): 'r' | 'g' | 'b' | 'a' {
  let minR = 255, minG = 255, minB = 255, minA = 255
  let maxR = 0, maxG = 0, maxB = 0, maxA = 0
  for (const color of box) {
    if (color.r < minR) minR = color.r
    if (color.g < minG) minG = color.g
    if (color.b < minB) minB = color.b
    if (color.a < minA) minA = color.a
    if (color.r > maxR) maxR = color.r
    if (color.g > maxG) maxG = color.g
    if (color.b > maxB) maxB = color.b
    if (color.a > maxA) maxA = color.a
  }
  const ranges = { r: maxR - minR, g: maxG - minG, b: maxB - minB, a: maxA - minA }
  let channel: 'r' | 'g' | 'b' | 'a' = 'r'
  let best = ranges.r
  if (ranges.g > best) { channel = 'g'; best = ranges.g }
  if (ranges.b > best) { channel = 'b'; best = ranges.b }
  if (ranges.a > best) channel = 'a'
  return channel
}

function averageBox(box: readonly HistColor[]): PngPaletteColor {
  let r = 0, g = 0, b = 0, a = 0, count = 0
  for (const color of box) {
    r += color.r * color.count
    g += color.g * color.count
    b += color.b * color.count
    a += color.a * color.count
    count += color.count
  }
  if (count === 0) return { r: 0, g: 0, b: 0, a: 255 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: Math.round(a / count),
  }
}

async function measurePaletteError(image: PngRgbaImage, palette: readonly PngPaletteColor[], reporter: WorkReporter): Promise<number> {
  const { width, height, rgba } = image
  if (rgba.length === 0) {
    await reporter.add(height || 1)
    return 0
  }
  let total = 0
  const pixels = width * height
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const nearest = palette[nearestPaletteIndex(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0, rgba[index + 3] ?? 255, palette)]
      if (!nearest) continue
      total += Math.abs((rgba[index] ?? 0) - nearest.r)
        + Math.abs((rgba[index + 1] ?? 0) - nearest.g)
        + Math.abs((rgba[index + 2] ?? 0) - nearest.b)
        + Math.abs((rgba[index + 3] ?? 255) - nearest.a)
    }
    await reporter.tickRows(y, height)
  }
  return total / pixels / 4
}

async function ditherToPalette(image: PngRgbaImage, palette: readonly PngPaletteColor[], reporter: WorkReporter): Promise<Uint8Array> {
  await reporter.setPhase('optimizing', 'Mapping pixels...')
  const { width, height, rgba } = image
  const indices = new Uint8Array(width * height)
  const current = new Int16Array(width * 4)
  const next = new Int16Array(width * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4
      const r = clampByte((rgba[pixel] ?? 0) + (current[x * 4] ?? 0) / 16)
      const g = clampByte((rgba[pixel + 1] ?? 0) + (current[x * 4 + 1] ?? 0) / 16)
      const b = clampByte((rgba[pixel + 2] ?? 0) + (current[x * 4 + 2] ?? 0) / 16)
      const a = clampByte((rgba[pixel + 3] ?? 255) + (current[x * 4 + 3] ?? 0) / 16)
      const index = nearestPaletteIndex(r, g, b, a, palette)
      indices[y * width + x] = index
      const color = palette[index]
      if (!color) continue
      const errR = r - color.r
      const errG = g - color.g
      const errB = b - color.b
      const errA = a - color.a
      if (x + 1 < width) addError(current, x + 1, errR, errG, errB, errA, 7)
      if (y + 1 < height) {
        if (x > 0) addError(next, x - 1, errR, errG, errB, errA, 3)
        addError(next, x, errR, errG, errB, errA, 5)
        if (x + 1 < width) addError(next, x + 1, errR, errG, errB, errA, 1)
      }
    }
    current.set(next)
    next.fill(0)
    await reporter.tickRows(y, height)
  }
  return indices
}

function addError(row: Int16Array, x: number, errR: number, errG: number, errB: number, errA: number, weight: number): void {
  row[x * 4] = (row[x * 4] ?? 0) + errR * weight
  row[x * 4 + 1] = (row[x * 4 + 1] ?? 0) + errG * weight
  row[x * 4 + 2] = (row[x * 4 + 2] ?? 0) + errB * weight
  row[x * 4 + 3] = (row[x * 4 + 3] ?? 0) + errA * weight
}

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return Math.round(value)
}

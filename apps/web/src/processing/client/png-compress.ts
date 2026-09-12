import { assertValidImageSize } from '@/features/image/image-utils'
import { reportProcessStage, reportProcessTask } from './process-stage'
import type { ProcessingProgress } from '@/processing/types/processing'
import {
  collectUniquePalette,
  countUniqueColors,
  decodePngRgba,
  encodePngIndexed,
  encodePngRgba,
  mapRgbaToIndices,
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
  const report = options.onProgress
  await reportProcessStage(report, 'preparing', 0)
  const stripped = stripPngMetadata(bytes)
  if (pngHasAnimation(bytes)) {
    const size = readPngSize(bytes)
    await reportProcessStage(report, 'preparing', 1)
    await reportProcessStage(report, 'finalizing', 1)
    return summarize(bytes, pickSmaller(bytes, stripped), originalSize, size.width, size.height, false, false, false)
  }
  const image = decodePngRgba(bytes)
  assertValidImageSize(image.width, image.height)
  await reportProcessStage(report, 'preparing', 1)
  const exactPalette = collectUniquePalette(image.rgba)
  const compressSteps = exactPalette ? 2 : 1
  await reportProcessStage(report, 'compressing', 0)
  const candidates: Candidate[] = [
    { bytes, quantized: false },
    { bytes: stripped, quantized: false },
    { bytes: encodePngRgba(image), quantized: false },
  ]
  await reportProcessTask(report, 'compressing', 1, compressSteps)
  if (exactPalette) {
    candidates.push({
      bytes: encodePngIndexed(image.width, image.height, mapRgbaToIndices(image.rgba, exactPalette), exactPalette),
      quantized: false,
    })
    await reportProcessTask(report, 'compressing', 2, compressSteps)
  } else if (mode !== 'lossless') {
    const counts = mode === 'strong' ? [256, 128, 64] : [256]
    await reportProcessStage(report, 'optimizing', 0)
    let done = 0
    for (const colors of counts) {
      const palette = medianCutPalette(image.rgba, colors)
      if (palette.length >= 2) {
        const unditheredError = paletteError(image.rgba, palette)
        const skipStrong = mode === 'strong' && colors < 256 && unditheredError > 40
        const skipBalanced = mode === 'balanced' && unditheredError > 28 && countUniqueColors(image.rgba, 1024) <= 1024
        if (!skipStrong && !skipBalanced) {
          const dither = unditheredError > 6
          const indices = dither
            ? ditherToPalette(image, palette)
            : mapRgbaToIndices(image.rgba, palette)
          candidates.push({
            bytes: encodePngIndexed(image.width, image.height, indices, palette),
            quantized: true,
          })
        }
      }
      done += 1
      await reportProcessTask(report, 'optimizing', done, counts.length)
    }
  }
  await reportProcessStage(report, 'finalizing', 0)
  const best = pickBest(candidates, originalSize)
  const unique = countUniqueColors(image.rgba, PHOTO_UNIQUE_LIMIT)
  await reportProcessStage(report, 'finalizing', 1)
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

function medianCutPalette(rgba: Uint8Array, maxColors: number): PngPaletteColor[] {
  const histogram = new Map<number, HistColor>()
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index] ?? 0
    const g = rgba[index + 1] ?? 0
    const b = rgba[index + 2] ?? 0
    const a = rgba[index + 3] ?? 255
    const key = r << 24 | g << 16 | b << 8 | a
    const existing = histogram.get(key)
    if (existing) existing.count += 1
    else histogram.set(key, { r, g, b, a, count: 1 })
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

function paletteError(rgba: Uint8Array, palette: readonly PngPaletteColor[]): number {
  if (rgba.length === 0) return 0
  let total = 0
  const pixels = rgba.length / 4
  for (let index = 0; index < rgba.length; index += 4) {
    const nearest = palette[nearestPaletteIndex(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0, rgba[index + 3] ?? 255, palette)]
    if (!nearest) continue
    total += Math.abs((rgba[index] ?? 0) - nearest.r)
      + Math.abs((rgba[index + 1] ?? 0) - nearest.g)
      + Math.abs((rgba[index + 2] ?? 0) - nearest.b)
      + Math.abs((rgba[index + 3] ?? 255) - nearest.a)
  }
  return total / pixels / 4
}


function ditherToPalette(image: PngRgbaImage, palette: readonly PngPaletteColor[]): Uint8Array {
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

import type { ProcessingProgress } from '@/processing/types/processing'
import { canvasToBlob, type ImageFormat } from './image'
import { compressPng, type PngCompressMode } from './png-compress'

export type ImageOptimizeMode = 'auto' | 'lossless' | 'strong'

export interface ImageOptimizeOptions {
  mime: ImageFormat
  enabled?: boolean
  mode?: ImageOptimizeMode
  width?: number
  height?: number
  onProgress?: (progress: ProcessingProgress) => void
}

export interface OptimizedImage {
  blob: Blob
  mime: ImageFormat
  originalSize: number
  optimizedSize: number
  savedBytes: number
  savedRatio: number
  recommendWebp: boolean
  width?: number
  height?: number
}

export function pngModeFromOptimize(mode: ImageOptimizeMode): PngCompressMode {
  if (mode === 'lossless') return 'lossless'
  if (mode === 'strong') return 'strong'
  return 'balanced'
}

export function rasterEncodeQuality(mime: ImageFormat, mode: ImageOptimizeMode = 'auto'): number {
  if (mime === 'image/png') return 1
  if (mime === 'image/webp') {
    if (mode === 'lossless') return 0.9
    if (mode === 'strong') return 0.68
    return 0.82
  }
  if (mode === 'lossless') return 0.92
  if (mode === 'strong') return 0.72
  return 0.86
}

function passthrough(source: Blob, mime: ImageFormat, extra: { width?: number; height?: number; recommendWebp?: boolean } = {}): OptimizedImage {
  return {
    blob: source,
    mime,
    originalSize: source.size,
    optimizedSize: source.size,
    savedBytes: 0,
    savedRatio: 0,
    recommendWebp: extra.recommendWebp ?? false,
    ...(extra.width != null ? { width: extra.width } : {}),
    ...(extra.height != null ? { height: extra.height } : {}),
  }
}

function pickSmaller(original: Blob, candidate: Blob): Blob {
  return candidate.size > 0 && candidate.size <= original.size ? candidate : original
}

export async function optimizeImageOutput(source: Blob, options: ImageOptimizeOptions): Promise<OptimizedImage> {
  const mime = options.mime
  const mode = options.mode ?? 'auto'
  if (options.enabled === false || mime !== 'image/png') {
    return passthrough(source, mime)
  }
  try {
    const outer = options.onProgress
    const result = await compressPng(new Uint8Array(await source.arrayBuffer()), {
      mode: pngModeFromOptimize(mode),
      ...(outer ? {
        onProgress: (progress: ProcessingProgress) => outer({ ...progress, progress: null }),
      } : {}),
    })
    const compressed = new Blob([result.bytes.slice()], { type: 'image/png' })
    const blob = pickSmaller(source, compressed)
    const savedBytes = Math.max(0, source.size - blob.size)
    return {
      blob,
      mime: 'image/png',
      originalSize: source.size,
      optimizedSize: blob.size,
      savedBytes,
      savedRatio: source.size > 0 ? savedBytes / source.size : 0,
      recommendWebp: result.recommendWebp,
      ...(result.width != null ? { width: result.width } : {}),
      ...(result.height != null ? { height: result.height } : {}),
    }
  } catch {
    return passthrough(source, mime)
  }
}

export async function exportCanvasImage(
  canvas: HTMLCanvasElement,
  mime: ImageFormat,
  options: { enabled?: boolean; mode?: ImageOptimizeMode; quality?: number } = {},
): Promise<OptimizedImage> {
  const mode = options.mode ?? 'auto'
  const quality = mime === 'image/png' ? 1 : (options.quality ?? rasterEncodeQuality(mime, mode))
  const generated = await canvasToBlob(canvas, mime, quality)
  return optimizeImageOutput(generated, {
    mime,
    mode,
    width: canvas.width,
    height: canvas.height,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  })
}

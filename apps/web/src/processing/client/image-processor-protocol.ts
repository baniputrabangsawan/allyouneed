import type { ImageCrop, WatermarkPosition } from '@/features/image/image-utils'
import type { MergeOptions } from '@/features/image/merge-png-utils'
import type { MemeTextLayer } from '@/features/image/meme-utils'
import type { ProcessingProgress } from '@/processing/types/processing'
import type { ImageDrawOptions, ImageFormat } from './image'
import type { ImageOptimizeMode } from './image-optimize'
import type { PngCompressMode } from './png-compress'

export interface TransferBlob {
  buffer: ArrayBuffer
  type: string
  name: string
}

export interface ImageJobOptimize {
  enabled?: boolean
  mode?: ImageOptimizeMode
}

export interface ProcessImageJobOptions {
  format: ImageFormat
  quality: number
  width?: number
  height?: number
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  backgroundColor?: string
  crop?: ImageCrop
  blur?: number
  brightness?: number
  contrast?: number
  saturation?: number
  grayscale?: number
  pixelate?: number
  maxPixels?: number
  watermark?: string
  watermarkPosition?: WatermarkPosition
  watermarkOpacity?: number
  watermarkSize?: number
  watermarkPadding?: number
  watermarkRotation?: number
}

export type ImageJob =
  | { op: 'compressPng'; file: Blob; mode?: PngCompressMode }
  | { op: 'processImage'; file: Blob; options: ProcessImageJobOptions; optimize?: ImageJobOptimize; watermarkImage?: Blob }
  | { op: 'mergePng'; inputs: { file: Blob; width: number; height: number }[]; options: MergeOptions; background: string | null; optimize?: ImageJobOptimize }
  | { op: 'renderMeme'; file: Blob; layers: readonly MemeTextLayer[]; format: ImageFormat; quality?: number; optimize?: ImageJobOptimize }
  | { op: 'exportProcessed'; file: Blob; draw: ImageDrawOptions; mime: ImageFormat; quality?: number; optimize?: ImageJobOptimize }

export interface ImageJobResult {
  blob: Blob
  mime: string
  originalSize: number
  optimizedSize: number
  savedBytes: number
  savedRatio: number
  recommendWebp: boolean
  width?: number
  height?: number
  quantized?: boolean
}

export type SerializedImageJob =
  | { op: 'compressPng'; file: TransferBlob; mode?: PngCompressMode }
  | { op: 'processImage'; file: TransferBlob; options: ProcessImageJobOptions; optimize?: ImageJobOptimize; watermarkImage?: TransferBlob }
  | { op: 'mergePng'; inputs: { file: TransferBlob; width: number; height: number }[]; options: MergeOptions; background: string | null; optimize?: ImageJobOptimize }
  | { op: 'renderMeme'; file: TransferBlob; layers: MemeTextLayer[]; format: ImageFormat; quality?: number; optimize?: ImageJobOptimize }
  | { op: 'exportProcessed'; file: TransferBlob; draw: ImageDrawOptions; mime: ImageFormat; quality?: number; optimize?: ImageJobOptimize }

export type WorkerRequest =
  | { type: 'cancel'; id: number }
  | { type: 'job'; id: number; job: SerializedImageJob }

export interface SerializedImageJobResult {
  buffer: ArrayBuffer
  mime: string
  originalSize: number
  optimizedSize: number
  savedBytes: number
  savedRatio: number
  recommendWebp: boolean
  width?: number
  height?: number
  quantized?: boolean
}

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: ProcessingProgress }
  | { type: 'done'; id: number; result: SerializedImageJobResult }
  | { type: 'error'; id: number; message: string }

export function fileFromTransfer(blob: TransferBlob): File {
  return new File([blob.buffer], blob.name || 'image', { type: blob.type || 'application/octet-stream' })
}

export function resultFromSerialized(result: SerializedImageJobResult): ImageJobResult {
  return {
    blob: new Blob([result.buffer], { type: result.mime }),
    mime: result.mime,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savedBytes: result.savedBytes,
    savedRatio: result.savedRatio,
    recommendWebp: result.recommendWebp,
    ...(result.width != null ? { width: result.width } : {}),
    ...(result.height != null ? { height: result.height } : {}),
    ...(result.quantized != null ? { quantized: result.quantized } : {}),
  }
}

export async function blobToTransfer(blob: Blob, name = 'image'): Promise<TransferBlob> {
  return {
    buffer: await blob.arrayBuffer(),
    type: blob.type || 'application/octet-stream',
    name: blob instanceof File && blob.name ? blob.name : name,
  }
}

export function collectTransferables(job: SerializedImageJob): Transferable[] {
  if (job.op === 'mergePng') return job.inputs.map((input) => input.file.buffer)
  const buffers: Transferable[] = [job.file.buffer]
  if (job.op === 'processImage' && job.watermarkImage) buffers.push(job.watermarkImage.buffer)
  return buffers
}

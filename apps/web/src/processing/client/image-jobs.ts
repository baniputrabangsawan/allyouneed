import type { ProcessingProgress } from '@/processing/types/processing'
import { processImage } from './image'
import { optimizeImageOutput, type OptimizedImage } from './image-optimize'
import type { ImageJob, ImageJobResult } from './image-processor-protocol'
import { mergePngImages } from './merge-png'
import { renderMeme } from './meme'
import { compressPng } from './png-compress'

function fromOptimized(result: OptimizedImage): ImageJobResult {
  return {
    blob: result.blob,
    mime: result.mime,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savedBytes: result.savedBytes,
    savedRatio: result.savedRatio,
    recommendWebp: result.recommendWebp,
    ...(result.width != null ? { width: result.width } : {}),
    ...(result.height != null ? { height: result.height } : {}),
  }
}

export async function executeImageJob(
  job: ImageJob,
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<ImageJobResult> {
  if (job.op === 'compressPng') {
    const bytes = new Uint8Array(await job.file.arrayBuffer())
    const result = await compressPng(bytes, {
      ...(job.mode ? { mode: job.mode } : {}),
      ...(onProgress ? { onProgress } : {}),
    })
    return {
      blob: new Blob([result.bytes.slice()], { type: 'image/png' }),
      mime: 'image/png',
      originalSize: result.originalSize,
      optimizedSize: result.compressedSize,
      savedBytes: result.savedBytes,
      savedRatio: result.savedRatio,
      recommendWebp: result.recommendWebp,
      width: result.width,
      height: result.height,
      quantized: result.quantized,
    }
  }
  if (job.op === 'processImage') {
    const file = job.file instanceof File ? job.file : new File([job.file], 'image', { type: job.file.type })
    const blob = await processImage(file, {
      ...job.options,
      ...(job.watermarkImage ? { watermarkImage: job.watermarkImage } : {}),
    }, onProgress)
    const optimized = await optimizeImageOutput(blob, {
      mime: job.options.format,
      ...(job.optimize?.enabled === undefined ? {} : { enabled: job.optimize.enabled }),
      ...(job.optimize?.mode === undefined ? {} : { mode: job.optimize.mode }),
      ...(onProgress ? { onProgress } : {}),
    })
    return fromOptimized(optimized)
  }
  if (job.op === 'mergePng') {
    const result = await mergePngImages(
      job.inputs.map((input) => ({
        file: input.file instanceof File ? input.file : new File([input.file], 'image.png', { type: input.file.type || 'image/png' }),
        width: input.width,
        height: input.height,
      })),
      job.options,
      job.background,
      job.optimize ?? {},
      onProgress,
    )
    return {
      blob: result.blob,
      mime: 'image/png',
      originalSize: result.originalSize,
      optimizedSize: result.optimizedSize,
      savedBytes: Math.max(0, result.originalSize - result.optimizedSize),
      savedRatio: result.savedRatio,
      recommendWebp: result.recommendWebp,
      width: result.width,
      height: result.height,
    }
  }
  if (job.op === 'renderMeme') {
    const file = job.file instanceof File ? job.file : new File([job.file], 'image', { type: job.file.type })
    const result = await renderMeme(file, job.layers, {
      format: job.format === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      ...(job.quality === undefined ? {} : { quality: job.quality }),
      ...(job.optimize?.enabled === undefined ? {} : { optimize: job.optimize.enabled }),
      ...(job.optimize?.mode === undefined ? {} : { optimizeMode: job.optimize.mode }),
    }, onProgress)
    return {
      blob: result.blob,
      mime: job.format,
      originalSize: result.originalSize,
      optimizedSize: result.optimizedSize,
      savedBytes: Math.max(0, result.originalSize - result.optimizedSize),
      savedRatio: result.savedRatio,
      recommendWebp: result.recommendWebp,
      width: result.width,
      height: result.height,
    }
  }
  const file = job.file instanceof File ? job.file : new File([job.file], 'image', { type: job.file.type })
  const blob = await processImage(file, {
    format: job.mime,
    quality: job.quality ?? 1,
    ...job.draw,
  }, onProgress)
  const optimized = await optimizeImageOutput(blob, {
    mime: job.mime,
    ...(job.optimize?.enabled === undefined ? {} : { enabled: job.optimize.enabled }),
    ...(job.optimize?.mode === undefined ? {} : { mode: job.optimize.mode }),
    ...(onProgress ? { onProgress } : {}),
  })
  return fromOptimized(optimized)
}

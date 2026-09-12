import { assertValidImageSize } from '@/features/image/image-utils'
import { drawMemeLayers, type MemeFormat, type MemeTextLayer } from '@/features/image/meme-utils'
import { exportCanvasImage, type ImageOptimizeMode } from './image-optimize'

export interface MemeRenderOptions {
  format: MemeFormat
  quality?: number
  optimize?: boolean
  optimizeMode?: ImageOptimizeMode
}

export interface MemeRenderResult {
  blob: Blob
  width: number
  height: number
  originalSize: number
  optimizedSize: number
  savedRatio: number
  recommendWebp: boolean
}

export async function renderMeme(
  file: File,
  layers: readonly MemeTextLayer[],
  options: MemeRenderOptions,
): Promise<MemeRenderResult> {
  const bitmap = await createImageBitmap(file)
  try {
    assertValidImageSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available in this browser.')
    if (options.format === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(bitmap, 0, 0)
    drawMemeLayers(context, canvas, layers)
    const output = await exportCanvasImage(canvas, options.format, {
      ...(options.optimize === undefined ? {} : { enabled: options.optimize }),
      ...(options.optimizeMode === undefined ? {} : { mode: options.optimizeMode }),
      ...(options.quality === undefined ? {} : { quality: options.quality }),
    })
    return {
      blob: output.blob,
      width: canvas.width,
      height: canvas.height,
      originalSize: output.originalSize,
      optimizedSize: output.optimizedSize,
      savedRatio: output.savedRatio,
      recommendWebp: output.recommendWebp,
    }
  } finally {
    bitmap.close()
  }
}

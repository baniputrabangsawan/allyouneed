import { assertValidImageSize } from '@/features/image/image-utils'
import { drawMemeLayers, type MemeFormat, type MemeTextLayer } from '@/features/image/meme-utils'

export interface MemeRenderOptions {
  format: MemeFormat
  quality?: number
}

export interface MemeRenderResult {
  blob: Blob
  width: number
  height: number
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
    const blob = await canvasToBlob(canvas, options.format, options.quality ?? 0.92)
    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    bitmap.close()
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, format: MemeFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Meme export failed.')),
    format,
    Math.min(1, Math.max(0, quality)),
  ))
}

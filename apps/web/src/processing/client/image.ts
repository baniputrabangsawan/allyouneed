import {
  assertValidImageSize, normalizeCrop, rotatedSize, watermarkPoint,
  type ImageCrop, type WatermarkPosition,
} from '@/features/image/image-utils'
import { photoEditorFilter } from '@/features/image/photo-editor-utils'
import type { ProcessingProgress } from '@/processing/types/processing'
import { reportProcessStage, reportProcessTask } from './process-stage'
export type { ImageCrop, WatermarkPosition } from '@/features/image/image-utils'

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ImageDrawOptions {
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
}

export interface ImageOptions extends ImageDrawOptions {
  format: ImageFormat
  quality: number
  watermark?: string
  watermarkImage?: Blob
  watermarkPosition?: WatermarkPosition
  watermarkOpacity?: number
  watermarkSize?: number
  watermarkPadding?: number
  watermarkRotation?: number
}

export async function processImage(file: File, options: ImageOptions, onProgress?: (progress: ProcessingProgress) => void): Promise<Blob> {
  await reportProcessStage(onProgress, 'preparing', 0)
  const bitmap = await createImageBitmap(file)
  try {
    await reportProcessStage(onProgress, 'preparing', 1)
    await reportProcessStage(onProgress, 'compressing', 0)
    const canvas = drawProcessedImage(bitmap, options)
    await drawWatermark(getContext(canvas), canvas, options)
    await reportProcessTask(onProgress, 'compressing', 1, 2)
    const blob = await canvasToBlob(canvas, options.format, options.quality)
    await reportProcessTask(onProgress, 'compressing', 2, 2)
    return blob
  } finally {
    bitmap.close()
  }
}

export function drawProcessedImage(bitmap: ImageBitmap, options: ImageDrawOptions, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  assertValidImageSize(bitmap.width, bitmap.height, options.maxPixels)
  const crop = normalizeCrop(options.crop, bitmap)
  const targetWidth = Math.round(options.width ?? crop.width)
  const targetHeight = Math.round(options.height ?? crop.height)
  assertValidImageSize(targetWidth, targetHeight, options.maxPixels)
  const output = rotatedSize(targetWidth, targetHeight, options.rotation)
  assertValidImageSize(output.width, output.height, options.maxPixels)
  const target = canvas ?? makeCanvas(output.width, output.height)
  target.width = output.width
  target.height = output.height
  const context = getContext(target)
  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor
    context.fillRect(0, 0, target.width, target.height)
  }
  context.translate(target.width / 2, target.height / 2)
  context.rotate(((options.rotation ?? 0) * Math.PI) / 180)
  context.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1)
  context.filter = photoEditorFilter({
    brightness: options.brightness ?? 100,
    contrast: options.contrast ?? 100,
    saturation: options.saturation ?? 100,
    grayscale: options.grayscale ?? 0,
    blur: options.blur ?? 0,
  })
  const pixelSize = Math.max(1, Math.round(options.pixelate ?? 1))
  if (pixelSize > 1) {
    const pixelCanvas = makeCanvas(Math.max(1, Math.ceil(targetWidth / pixelSize)), Math.max(1, Math.ceil(targetHeight / pixelSize)))
    const pixelContext = getContext(pixelCanvas)
    pixelContext.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, pixelCanvas.width, pixelCanvas.height)
    context.imageSmoothingEnabled = false
    context.drawImage(pixelCanvas, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight)
  } else {
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight)
  }
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.filter = 'none'
  return target
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Image processing failed.')),
    format,
    Math.min(1, Math.max(0, quality)),
  ))
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  return context
}

async function drawWatermark(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options: ImageOptions): Promise<void> {
  if (!options.watermark && !options.watermarkImage) return
  const opacity = Math.min(1, Math.max(0, options.watermarkOpacity ?? 0.75))
  const padding = Math.max(0, options.watermarkPadding ?? Math.round(canvas.width * 0.025))
  const rotation = ((options.watermarkRotation ?? 0) * Math.PI) / 180
  const position = options.watermarkPosition ?? 'bottom-right'
  let watermarkBitmap: ImageBitmap | undefined
  try {
    if (options.watermarkImage) watermarkBitmap = await createImageBitmap(options.watermarkImage)
    const defaultSize = Math.max(18, Math.round(canvas.width * 0.045))
    const size = Math.max(1, options.watermarkSize ?? defaultSize)
    let width: number
    let height: number
    if (watermarkBitmap) {
      const scale = size / watermarkBitmap.width
      width = size
      height = watermarkBitmap.height * scale
    } else {
      context.font = `600 ${size}px system-ui`
      width = context.measureText(options.watermark ?? '').width
      height = size
    }
    const point = watermarkPoint(canvas, { width, height }, position, padding)
    context.save()
    try {
      context.globalAlpha = opacity
      context.translate(point.x + width / 2, point.y + height / 2)
      context.rotate(rotation)
      if (watermarkBitmap) {
        context.drawImage(watermarkBitmap, -width / 2, -height / 2, width, height)
      } else {
        context.font = `600 ${size}px system-ui`
        context.fillStyle = '#fff'
        context.strokeStyle = `rgb(0 0 0 / ${Math.min(opacity * 0.5, 0.45)})`
        context.lineWidth = Math.max(2, size / 14)
        context.textBaseline = 'top'
        context.strokeText(options.watermark ?? '', -width / 2, -height / 2)
        context.fillText(options.watermark ?? '', -width / 2, -height / 2)
      }
    } finally {
      context.restore()
    }
  } finally {
    watermarkBitmap?.close()
  }
}

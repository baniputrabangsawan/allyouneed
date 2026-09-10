import {
  assertValidImageSize, normalizeCrop, rotatedSize, watermarkPoint,
  type ImageCrop, type WatermarkPosition,
} from '@/features/image/image-utils'

export type { ImageCrop, WatermarkPosition } from '@/features/image/image-utils'

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ImageOptions {
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
  pixelate?: number
  watermark?: string
  watermarkImage?: Blob
  watermarkPosition?: WatermarkPosition
  watermarkOpacity?: number
  watermarkSize?: number
  watermarkPadding?: number
  watermarkRotation?: number
  maxPixels?: number
}

export async function processImage(file: File, options: ImageOptions): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    assertValidImageSize(bitmap.width, bitmap.height, options.maxPixels)
    const crop = normalizeCrop(options.crop, bitmap)
    const targetWidth = Math.round(options.width ?? crop.width)
    const targetHeight = Math.round(options.height ?? crop.height)
    assertValidImageSize(targetWidth, targetHeight, options.maxPixels)
    const output = rotatedSize(targetWidth, targetHeight, options.rotation)
    assertValidImageSize(output.width, output.height, options.maxPixels)
    const canvas = makeCanvas(output.width, output.height)
    const context = getContext(canvas)
    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(((options.rotation ?? 0) * Math.PI) / 180)
    context.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1)
    context.filter = options.blur && options.blur > 0 ? `blur(${options.blur}px)` : 'none'
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
    await drawWatermark(context, canvas, options)
    return await canvasToBlob(canvas, options.format, options.quality)
  } finally {
    bitmap.close()
  }
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

function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Image processing failed.')),
    format,
    Math.min(1, Math.max(0, quality)),
  ))
}

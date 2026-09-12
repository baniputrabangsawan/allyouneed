import { fileMatchesMediaAccept } from '@/lib/media/accept'

export const MAX_IMAGE_PIXELS = 40_000_000
export const MAX_IMAGE_DIMENSION = 16_384

export type ImageWorkspaceMode =
  | 'compress'
  | 'resize'
  | 'crop'
  | 'transform'
  | 'converter'
  | 'watermark'
  | 'metadata'
  | 'svg-to-png'
  | 'favicon'
  | 'meme'
  | 'photo-editor'

const imageConverterSlugs = new Set([
  'convert-to-jpg',
  'convert-from-jpg',
  'image-converter',
  'jpg-to-png',
  'png-to-jpg',
  'jpg-to-webp',
  'png-to-webp',
  'webp-to-jpg',
])

export function getImageWorkspaceMode(slug: string): ImageWorkspaceMode | null {
  if (slug === 'compress-image') return 'compress'
  if (slug === 'resize-image') return 'resize'
  if (slug === 'crop-image') return 'crop'
  if (slug === 'rotate-image' || slug === 'flip-image') return 'transform'
  if (slug === 'watermark-image') return 'watermark'
  if (slug === 'remove-metadata') return 'metadata'
  if (slug === 'favicon-generator') return 'favicon'
  if (slug === 'svg-to-png') return 'svg-to-png'
  if (slug === 'meme-generator') return 'meme'
  if (slug === 'photo-editor') return 'photo-editor'
  if (imageConverterSlugs.has(slug)) return 'converter'
  return null
}

export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ImageCrop {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface FileLike {
  name: string
  size: number
  type: string
}

export interface FileValidationOptions {
  accept?: readonly string[]
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number
}

export interface FileValidationResult<T extends FileLike> {
  files: T[]
  error?: string
}

export function assertValidImageSize(width: number, height: number, maxPixels = MAX_IMAGE_PIXELS): void {
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1) throw new Error('Maximum pixel count must be a positive whole number.')
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('Image dimensions must be positive whole numbers.')
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(`Image dimensions cannot exceed ${MAX_IMAGE_DIMENSION}px.`)
  }
  if (width * height > maxPixels) {
    throw new Error(`Image cannot exceed ${Math.round(maxPixels / 1_000_000)} megapixels.`)
  }
}

export function normalizeCrop(crop: ImageCrop | undefined, source: Size): ImageCrop {
  if (!crop) return { x: 0, y: 0, width: source.width, height: source.height }
  const values = [crop.x, crop.y, crop.width, crop.height]
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) {
    throw new Error('Crop values must describe a positive area inside the image.')
  }
  const x = Math.round(crop.x)
  const y = Math.round(crop.y)
  const width = Math.round(crop.width)
  const height = Math.round(crop.height)
  if (width < 1 || height < 1) throw new Error('Crop area must be at least one pixel.')
  if (x + width > source.width || y + height > source.height) {
    throw new Error('Crop area extends outside the image.')
  }
  return { x, y, width, height }
}

export function rotatedSize(width: number, height: number, rotation = 0): Size {
  const radians = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  }
}

export function watermarkPoint(
  canvas: Size,
  watermark: Size,
  position: WatermarkPosition,
  padding: number,
): Point {
  const safePadding = Math.max(0, padding)
  const [vertical, horizontal] = position === 'center' ? ['center', 'center'] : position.split('-')
  const x = horizontal === 'left'
    ? safePadding
    : horizontal === 'right'
      ? canvas.width - watermark.width - safePadding
      : (canvas.width - watermark.width) / 2
  const y = vertical === 'top'
    ? safePadding
    : vertical === 'bottom'
      ? canvas.height - watermark.height - safePadding
      : (canvas.height - watermark.height) / 2
  return { x, y }
}

export function fileMatchesAccept(file: FileLike, accept: readonly string[]): boolean {
  return fileMatchesMediaAccept(file, accept)
}

export function validateFiles<T extends FileLike>(
  selected: readonly T[],
  options: FileValidationOptions = {},
): FileValidationResult<T> {
  if (selected.length === 0) return { files: [] }
  const limit = options.multiple ? Math.max(1, Math.floor(options.maxFiles ?? Number.MAX_SAFE_INTEGER)) : 1
  if (selected.length > limit) {
    return { files: [], error: `Select no more than ${limit} file${limit === 1 ? '' : 's'}.` }
  }
  const accept = options.accept ?? []
  const unsupported = selected.find((file) => !fileMatchesAccept(file, accept))
  if (unsupported) return { files: [], error: `${unsupported.name} has an unsupported file format.` }
  if (options.maxFileSize !== undefined) {
    const oversized = selected.find((file) => file.size > options.maxFileSize!)
    if (oversized) {
      const megabytes = Math.round(options.maxFileSize / 1024 / 1024)
      return { files: [], error: `${oversized.name} exceeds the ${megabytes} MB limit.` }
    }
  }
  return { files: [...selected] }
}

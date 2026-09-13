export type ImagePreviewState = 'empty' | 'processing' | 'ready' | 'failed'

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i
const IMAGE_MIME = /^image\//i

const NON_IMAGE_OUTPUT = new Set([
  'image-to-base64',
  'color-picker',
  'color-palette-generator',
  'image-metadata-viewer',
])

const IMAGE_FILE_OUTPUT_SLUGS = new Set([
  'pdf-to-jpg',
  'pdf-to-png',
  'video-to-gif',
  'generate-thumbnail',
  'video-screenshot',
  'website-screenshot',
])

export function imagePreviewState(input: {
  processing?: boolean | undefined
  failed?: boolean | undefined
  resultSrc?: string | null | undefined
}): ImagePreviewState {
  if (input.failed) return 'failed'
  if (input.resultSrc) return 'ready'
  if (input.processing) return 'processing'
  return 'empty'
}

export function isImageResultFile(filename?: string | undefined, mime?: string | undefined): boolean {
  if (mime && IMAGE_MIME.test(mime)) return true
  const name = filename?.split('?')[0] ?? ''
  return IMAGE_EXT.test(name)
}

export function toolOutputsImage(tool: {
  category: string
  slug: string
  outputFormats?: readonly string[] | undefined
}): boolean {
  if (NON_IMAGE_OUTPUT.has(tool.slug)) return false
  if (tool.outputFormats?.some((format) => format.startsWith('image/'))) return true
  if (IMAGE_FILE_OUTPUT_SLUGS.has(tool.slug)) return true
  return tool.category === 'image' || tool.category === 'qr'
}

export function shouldCompare(
  originalSrc?: string | null | undefined,
  resultSrc?: string | null | undefined,
  compare = true,
): boolean {
  if (!compare) return false
  return Boolean(originalSrc && resultSrc && originalSrc !== resultSrc)
}

export function usesCheckerboard(options: {
  checkerboard?: boolean | undefined
  mime?: string | undefined
  filename?: string | undefined
}): boolean {
  if (options.checkerboard === false) return false
  if (options.checkerboard) return true
  const mime = options.mime ?? ''
  const name = options.filename ?? ''
  return mime === 'image/png' || mime === 'image/webp' || mime === 'image/gif' || /\.(png|webp|gif)$/i.test(name)
}

export function shouldAutoDownload(options: {
  id?: string | null | undefined
  source?: Blob | string | null | undefined
  filename?: string | null | undefined
  enabled?: boolean | undefined
  restored?: boolean | undefined
}): boolean {
  return Boolean(
    options.enabled !== false
    && !options.restored
    && options.id
    && options.source
    && options.filename,
  )
}

export function mimeLabel(mime?: string | undefined, filename?: string | undefined): string | undefined {
  const fromMime = mime?.split(';')[0]?.trim().toLowerCase()
  if (fromMime === 'image/jpeg' || fromMime === 'image/jpg') return 'JPG'
  if (fromMime === 'image/png') return 'PNG'
  if (fromMime === 'image/webp') return 'WebP'
  if (fromMime === 'image/gif') return 'GIF'
  if (fromMime === 'image/svg+xml') return 'SVG'
  if (fromMime === 'image/x-icon' || fromMime === 'image/vnd.microsoft.icon') return 'ICO'
  if (fromMime?.startsWith('image/')) return fromMime.slice(6).toUpperCase()
  const name = filename?.split('?')[0] ?? ''
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG'
  if (ext === 'png') return 'PNG'
  if (ext === 'webp') return 'WebP'
  if (ext === 'gif') return 'GIF'
  if (ext === 'svg') return 'SVG'
  if (ext === 'ico') return 'ICO'
  return undefined
}

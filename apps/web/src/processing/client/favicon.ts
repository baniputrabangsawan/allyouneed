import {
  assertValidImageSize,
} from '@/features/image/image-utils'
import {
  buildFaviconHtml,
  encodeIco,
  encodeZip,
  ensureSvgSize,
  FAVICON_ICO_FILENAME,
  FAVICON_ICO_MIME,
  FAVICON_ICO_SIZES,
  FAVICON_PNG_ASSETS,
  FAVICON_PNG_MIME,
  FAVICON_ZIP_MIME,
  isSvgFile,
  objectFitRect,
  type FaviconFile,
  type FaviconFit,
} from '@/features/image/favicon-utils'

export interface FaviconPack {
  files: FaviconFile[]
  zip: Blob
  html: string
}

export async function generateFaviconPack(file: File, options: { fit: FaviconFit }): Promise<FaviconPack> {
  const bitmap = await decodeSourceImage(file)
  try {
    const pngFiles: FaviconFile[] = []
    for (const asset of FAVICON_PNG_ASSETS) {
      const blob = await renderFaviconPng(bitmap, asset.width, asset.height, options.fit)
      pngFiles.push({
        filename: asset.filename,
        blob,
        mime: blob.type || FAVICON_PNG_MIME,
        width: asset.width,
        height: asset.height,
      })
    }
    return await assembleFaviconPack(pngFiles)
  } finally {
    bitmap.close()
  }
}

export async function assembleFaviconPack(pngFiles: readonly FaviconFile[]): Promise<FaviconPack> {
  const pngBytes = new Map<number, Uint8Array>()
  for (const file of pngFiles) {
    if (file.mime !== FAVICON_PNG_MIME && file.blob.type && file.blob.type !== FAVICON_PNG_MIME) {
      throw new Error(`${file.filename} is not a PNG favicon.`)
    }
    if (file.width && file.height && (FAVICON_ICO_SIZES as readonly number[]).includes(file.width) && file.width === file.height) {
      pngBytes.set(file.width, new Uint8Array(await file.blob.arrayBuffer()))
    }
  }
  const icoImages = FAVICON_ICO_SIZES.map((size) => {
    const data = pngBytes.get(size)
    if (!data) throw new Error('Favicon ICO generation is missing a PNG size.')
    return { width: size, height: size, data }
  })
  const ico: FaviconFile = {
    filename: FAVICON_ICO_FILENAME,
    blob: new Blob([toArrayBuffer(encodeIco(icoImages))], { type: FAVICON_ICO_MIME }),
    mime: FAVICON_ICO_MIME,
  }
  const files = [...pngFiles, ico]
  const zipBytes = encodeZip(await Promise.all(files.map(async (entry) => ({
    name: entry.filename,
    data: new Uint8Array(await entry.blob.arrayBuffer()),
  }))))
  return {
    files,
    zip: new Blob([toArrayBuffer(zipBytes)], { type: FAVICON_ZIP_MIME }),
    html: buildFaviconHtml(files),
  }
}

export async function decodeSourceImage(file: File): Promise<ImageBitmap> {
  try {
    const bitmap = await createImageBitmap(file)
    if (bitmap.width > 0 && bitmap.height > 0) {
      assertValidImageSize(bitmap.width, bitmap.height)
      return bitmap
    }
    bitmap.close()
  } catch {
    // SVG and a few still-image types need an element decode path.
  }
  if (isSvgFile(file)) return decodeSvg(file)
  return decodeViaHtmlImage(file)
}

async function decodeSvg(file: File): Promise<ImageBitmap> {
  const sized = new Blob([ensureSvgSize(await file.text())], { type: 'image/svg+xml' })
  try {
    const bitmap = await createImageBitmap(sized)
    if (bitmap.width > 0 && bitmap.height > 0) {
      assertValidImageSize(bitmap.width, bitmap.height)
      return bitmap
    }
    bitmap.close()
  } catch {
    // Fall through to HTMLImageElement decoding when the browser rejects SVG bitmaps.
  }
  return decodeViaHtmlImage(sized)
}

function decodeViaHtmlImage(source: Blob): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(url)
      void (async () => {
        try {
          if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('This image could not be read.')
          assertValidImageSize(image.naturalWidth, image.naturalHeight)
          resolve(await createImageBitmap(image))
        } catch (reason) {
          reject(reason instanceof Error ? reason : new Error('This image could not be read.'))
        }
      })()
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image could not be decoded in this browser.'))
    }
    image.src = url
  })
}

async function renderFaviconPng(source: ImageBitmap, width: number, height: number, fit: FaviconFit): Promise<Blob> {
  assertValidImageSize(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  const dest = objectFitRect(source, { width, height }, fit)
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, source.width, source.height, dest.x, dest.y, dest.width, dest.height)
  const blob = await canvasToPng(canvas)
  if (blob.type && blob.type !== FAVICON_PNG_MIME) throw new Error('Favicon PNG encoding failed.')
  return blob.type ? blob : new Blob([await blob.arrayBuffer()], { type: FAVICON_PNG_MIME })
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Favicon PNG encoding failed.')),
    FAVICON_PNG_MIME,
  ))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

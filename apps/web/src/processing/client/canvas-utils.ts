import type { ImageFormat } from './image'

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
export type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function supportsOffscreenCanvasHere(): boolean {
  return typeof OffscreenCanvas === 'function'
}

export function createProcessCanvas(width: number, height: number): AnyCanvas {
  if (supportsOffscreenCanvasHere()) return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  throw new Error('Canvas is not available in this browser.')
}

export function get2dContext(canvas: AnyCanvas): Canvas2DContext {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  return context
}

export async function canvasToBlob(canvas: AnyCanvas, format: ImageFormat, quality = 1): Promise<Blob> {
  const clamped = Math.min(1, Math.max(0, quality))
  if (isOffscreenCanvas(canvas) && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: format, quality: clamped })
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Image processing failed.')),
      format,
      clamped,
    )
  })
}

export function isOffscreenCanvas(canvas: AnyCanvas): canvas is OffscreenCanvas {
  return typeof OffscreenCanvas === 'function' && canvas instanceof OffscreenCanvas
}

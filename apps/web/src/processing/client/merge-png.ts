import {
  assertSafeMergeSize,
  computeMergeLayout,
  MERGE_ERROR,
  type MergeOptions,
  type MergeSource,
} from '@/features/image/merge-png-utils'
import type { ProcessingProgress } from '@/processing/types/processing'
import { createProcessCanvas, get2dContext } from './canvas-utils'
import { exportCanvasImage, type ImageOptimizeMode } from './image-optimize'

export interface MergePngInput {
  file: File
  width: number
  height: number
}

export interface MergePngResult {
  blob: Blob
  width: number
  height: number
  originalSize: number
  optimizedSize: number
  savedRatio: number
  recommendWebp: boolean
}

export interface MergePngOptimize {
  enabled?: boolean
  mode?: ImageOptimizeMode
}

async function decodePng(file: File): Promise<ImageBitmap> {
  try {
    if (typeof createImageBitmap === 'function') return await createImageBitmap(file)
  } catch {
    // Fall through to HTMLImageElement decode when the DOM is available.
  }
  if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error(MERGE_ERROR.decode)
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(MERGE_ERROR.decode))
      element.src = url
    })
    if (typeof createImageBitmap === 'function') return await createImageBitmap(image)
    throw new Error(MERGE_ERROR.decode)
  } catch {
    throw new Error(MERGE_ERROR.decode)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function mergePngImages(
  inputs: readonly MergePngInput[],
  options: MergeOptions,
  background: string | null,
  optimize: MergePngOptimize = {},
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<MergePngResult> {
  const sources: MergeSource[] = inputs.map((input) => ({ width: input.width, height: input.height }))
  const layout = computeMergeLayout(sources, options)
  assertSafeMergeSize(layout.width, layout.height)

  const canvas = createProcessCanvas(layout.width, layout.height)
  const context = get2dContext(canvas)
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  const bitmaps: ImageBitmap[] = []
  try {
    for (const input of inputs) {
      try {
        bitmaps.push(await decodePng(input.file))
      } catch {
        throw new Error(MERGE_ERROR.decode)
      }
    }
    for (const [index, bitmap] of bitmaps.entries()) {
      const placement = layout.placements[index]
      if (!placement) continue
      context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height)
    }
    try {
      const output = await exportCanvasImage(canvas, 'image/png', {
        ...(optimize.enabled === undefined ? {} : { enabled: optimize.enabled }),
        ...(optimize.mode === undefined ? {} : { mode: optimize.mode }),
        ...(onProgress ? { onProgress } : {}),
      })
      return {
        blob: output.blob,
        width: layout.width,
        height: layout.height,
        originalSize: output.originalSize,
        optimizedSize: output.optimizedSize,
        savedRatio: output.savedRatio,
        recommendWebp: output.recommendWebp,
      }
    } catch {
      throw new Error(MERGE_ERROR.export)
    }
  } finally {
    for (const bitmap of bitmaps) bitmap.close()
  }
}

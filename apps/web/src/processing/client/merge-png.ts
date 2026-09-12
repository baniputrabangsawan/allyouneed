import {
  assertSafeMergeSize,
  computeMergeLayout,
  MERGE_ERROR,
  type MergeOptions,
  type MergeSource,
} from '@/features/image/merge-png-utils'
import { canvasToBlob } from './image'

export interface MergePngInput {
  file: File
  width: number
  height: number
}

export interface MergePngResult {
  blob: Blob
  width: number
  height: number
}

async function decodePng(file: File): Promise<ImageBitmap> {
  try {
    if (typeof createImageBitmap === 'function') return await createImageBitmap(file)
  } catch {
    // Fall through to HTMLImageElement decode.
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

export async function mergePngImages(
  inputs: readonly MergePngInput[],
  options: MergeOptions,
  background: string | null,
): Promise<MergePngResult> {
  const sources: MergeSource[] = inputs.map((input) => ({ width: input.width, height: input.height }))
  const layout = computeMergeLayout(sources, options)
  assertSafeMergeSize(layout.width, layout.height)

  const canvas = makeCanvas(layout.width, layout.height)
  const context = getContext(canvas)
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
    let blob: Blob
    try {
      blob = await canvasToBlob(canvas, 'image/png', 1)
    } catch {
      throw new Error(MERGE_ERROR.export)
    }
    return { blob, width: layout.width, height: layout.height }
  } finally {
    for (const bitmap of bitmaps) bitmap.close()
  }
}

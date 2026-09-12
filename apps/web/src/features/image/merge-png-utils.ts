import { assertValidImageSize, MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, type Size } from './image-utils'

export const MAX_MERGE_FILES = 20
export const MIN_MERGE_FILES = 2
export const MERGE_PNG_ACCEPT = ['image/png', '.png'] as const
export const MERGE_GAPS = [0, 4, 8, 16, 24, 32] as const
export const MERGE_PADDINGS = [0, 8, 16, 24, 32] as const
export const MERGE_GRID_COLUMN_CHOICES = [2, 3, 4, 'auto'] as const

export type MergeLayout = 'vertical' | 'horizontal' | 'grid'
export type MergeSizing = 'original' | 'fit-uniform' | 'fit-largest-width' | 'fit-largest-height' | 'custom'
export type MergeAlignX = 'left' | 'center' | 'right'
export type MergeAlignY = 'top' | 'center' | 'bottom'
export type MergeBackground = 'transparent' | 'white' | 'black' | 'custom'
export type MergeGridColumns = 2 | 3 | 4 | 'auto'

export type MergeSource = Size

export type MergeCustomCell = Size

export interface MergeOptions {
  layout: MergeLayout
  sizing: MergeSizing
  alignX: MergeAlignX
  alignY: MergeAlignY
  gap: number
  padding: number
  columns: MergeGridColumns
  customCell: MergeCustomCell
}

export interface MergePlacement {
  x: number
  y: number
  width: number
  height: number
}

export interface MergeLayoutResult extends Size {
  placements: MergePlacement[]
  columns: number
  rows: number
}

export const MERGE_ERROR = {
  needTwo: 'MERGE_NEED_TWO',
  tooMany: 'MERGE_TOO_MANY',
  tooLarge: 'MERGE_TOO_LARGE',
  decode: 'MERGE_DECODE',
  export: 'MERGE_EXPORT',
} as const

export function defaultMergeOptions(): MergeOptions {
  return {
    layout: 'vertical',
    sizing: 'original',
    alignX: 'center',
    alignY: 'center',
    gap: 0,
    padding: 0,
    columns: 'auto',
    customCell: { width: 512, height: 512 },
  }
}

export function resolveGridColumns(count: number, columns: MergeGridColumns = 'auto'): number {
  if (count <= 1) return Math.max(1, count)
  if (columns === 'auto') return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))))
  return Math.min(Math.max(1, columns), count)
}

export function scaledSize(source: MergeSource, options: Pick<MergeOptions, 'sizing' | 'customCell'>, bounds: Size): Size {
  const width = Math.max(1, Math.round(source.width))
  const height = Math.max(1, Math.round(source.height))
  if (options.sizing === 'original') return { width, height }
  if (options.sizing === 'fit-largest-width') {
    const scale = bounds.width / width
    return { width: bounds.width, height: Math.max(1, Math.round(height * scale)) }
  }
  if (options.sizing === 'fit-largest-height') {
    const scale = bounds.height / height
    return { width: Math.max(1, Math.round(width * scale)), height: bounds.height }
  }
  const cell = options.sizing === 'custom'
    ? { width: Math.max(1, Math.round(options.customCell.width)), height: Math.max(1, Math.round(options.customCell.height)) }
    : bounds
  const scale = Math.min(cell.width / width, cell.height / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function alignXOffset(container: number, size: number, align: MergeAlignX): number {
  if (align === 'left') return 0
  if (align === 'right') return Math.max(0, container - size)
  return Math.max(0, Math.round((container - size) / 2))
}

export function alignYOffset(container: number, size: number, align: MergeAlignY): number {
  if (align === 'top') return 0
  if (align === 'bottom') return Math.max(0, container - size)
  return Math.max(0, Math.round((container - size) / 2))
}

export function resolveMergeBackground(kind: MergeBackground, custom = '#808080'): string | null {
  if (kind === 'transparent') return null
  if (kind === 'white') return '#ffffff'
  if (kind === 'black') return '#000000'
  return custom || '#808080'
}

export function computeMergeLayout(sources: readonly MergeSource[], options: MergeOptions): MergeLayoutResult {
  const gap = Math.max(0, Math.round(options.gap))
  const padding = Math.max(0, Math.round(options.padding))
  if (sources.length === 0) return { width: padding * 2, height: padding * 2, placements: [], columns: 0, rows: 0 }

  const bounds: Size = {
    width: Math.max(...sources.map((source) => Math.max(1, Math.round(source.width)))),
    height: Math.max(...sources.map((source) => Math.max(1, Math.round(source.height)))),
  }
  const sizes = sources.map((source) => scaledSize(source, options, bounds))

  if (options.layout === 'vertical') {
    const innerWidth = Math.max(...sizes.map((size) => size.width))
    const innerHeight = sizes.reduce((sum, size) => sum + size.height, 0) + gap * Math.max(0, sizes.length - 1)
    let y = padding
    const placements = sizes.map((size) => {
      const placement: MergePlacement = {
        x: padding + alignXOffset(innerWidth, size.width, options.alignX),
        y,
        width: size.width,
        height: size.height,
      }
      y += size.height + gap
      return placement
    })
    return {
      width: innerWidth + padding * 2,
      height: innerHeight + padding * 2,
      placements,
      columns: 1,
      rows: sizes.length,
    }
  }

  if (options.layout === 'horizontal') {
    const innerWidth = sizes.reduce((sum, size) => sum + size.width, 0) + gap * Math.max(0, sizes.length - 1)
    const innerHeight = Math.max(...sizes.map((size) => size.height))
    let x = padding
    const placements = sizes.map((size) => {
      const placement: MergePlacement = {
        x,
        y: padding + alignYOffset(innerHeight, size.height, options.alignY),
        width: size.width,
        height: size.height,
      }
      x += size.width + gap
      return placement
    })
    return {
      width: innerWidth + padding * 2,
      height: innerHeight + padding * 2,
      placements,
      columns: sizes.length,
      rows: 1,
    }
  }

  const columns = resolveGridColumns(sizes.length, options.columns)
  const rows = Math.ceil(sizes.length / columns)
  const cellWidth = options.sizing === 'custom'
    ? Math.max(1, Math.round(options.customCell.width))
    : Math.max(...sizes.map((size) => size.width))
  const cellHeight = options.sizing === 'custom'
    ? Math.max(1, Math.round(options.customCell.height))
    : Math.max(...sizes.map((size) => size.height))
  const innerWidth = columns * cellWidth + gap * Math.max(0, columns - 1)
  const innerHeight = rows * cellHeight + gap * Math.max(0, rows - 1)
  const placements = sizes.map((size, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    return {
      x: padding + col * (cellWidth + gap) + alignXOffset(cellWidth, size.width, options.alignX),
      y: padding + row * (cellHeight + gap) + alignYOffset(cellHeight, size.height, options.alignY),
      width: size.width,
      height: size.height,
    }
  })
  return {
    width: innerWidth + padding * 2,
    height: innerHeight + padding * 2,
    placements,
    columns,
    rows,
  }
}

export function assertSafeMergeSize(width: number, height: number): void {
  try {
    assertValidImageSize(width, height, MAX_IMAGE_PIXELS)
  } catch {
    throw new Error(MERGE_ERROR.tooLarge)
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(MERGE_ERROR.tooLarge)
  }
}

export function moveIndex(from: number, to: number, length: number): number | null {
  if (from < 0 || from >= length || to < 0 || to >= length || from === to) return null
  return to
}

export function reorderItems<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  if (moveIndex(from, to, next.length) == null) return next
  const removed = next.splice(from, 1)
  next.splice(to, 0, ...removed)
  return next
}

export function remainingMergeSlots(currentCount: number): number {
  return Math.max(0, MAX_MERGE_FILES - currentCount)
}

export function mergeOutputFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14)
  return `kits-merged-${stamp}.png`
}

import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from './image-utils'
import {
  alignXOffset,
  alignYOffset,
  assertSafeMergeSize,
  computeMergeLayout,
  defaultMergeOptions,
  MERGE_ERROR,
  mergeOutputFilename,
  remainingMergeSlots,
  reorderItems,
  resolveGridColumns,
  resolveMergeBackground,
  scaledSize,
  MAX_MERGE_FILES,
} from './merge-png-utils'

const a = { width: 100, height: 50 }
const b = { width: 200, height: 70 }

describe('merge png layout', () => {
  it('stacks vertically using the max width and summed heights plus gap', () => {
    const layout = computeMergeLayout([a, b], { ...defaultMergeOptions(), layout: 'vertical', gap: 10 })
    expect(layout).toMatchObject({ width: 200, height: 130, columns: 1, rows: 2 })
    expect(layout.placements).toEqual([
      { x: 50, y: 0, width: 100, height: 50 },
      { x: 0, y: 60, width: 200, height: 70 },
    ])
  })

  it('adds padding around a vertical stack', () => {
    const layout = computeMergeLayout([a, b], { ...defaultMergeOptions(), layout: 'vertical', gap: 10, padding: 8 })
    expect(layout).toMatchObject({ width: 216, height: 146 })
    expect(layout.placements[0]).toEqual({ x: 58, y: 8, width: 100, height: 50 })
    expect(layout.placements[1]).toEqual({ x: 8, y: 68, width: 200, height: 70 })
  })

  it('lays out horizontally using the max height and summed widths plus gap', () => {
    const layout = computeMergeLayout([a, b], { ...defaultMergeOptions(), layout: 'horizontal', gap: 10, alignY: 'top' })
    expect(layout).toMatchObject({ width: 310, height: 70, columns: 2, rows: 1 })
    expect(layout.placements).toEqual([
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 110, y: 0, width: 200, height: 70 },
    ])
  })

  it('aligns a shorter image to the bottom of a horizontal row', () => {
    const layout = computeMergeLayout([a, b], { ...defaultMergeOptions(), layout: 'horizontal', alignY: 'bottom' })
    expect(layout.placements[0]).toEqual({ x: 0, y: 20, width: 100, height: 50 })
    expect(layout.placements[1]).toEqual({ x: 100, y: 0, width: 200, height: 70 })
  })

  it('places a 2-column grid with centered cells', () => {
    const layout = computeMergeLayout(
      [a, b, { width: 80, height: 40 }],
      { ...defaultMergeOptions(), layout: 'grid', columns: 2, gap: 8 },
    )
    expect(layout.columns).toBe(2)
    expect(layout.rows).toBe(2)
    expect(layout.width).toBe(408)
    expect(layout.height).toBe(148)
    expect(layout.placements[0]).toEqual({ x: 50, y: 10, width: 100, height: 50 })
    expect(layout.placements[1]).toEqual({ x: 208, y: 0, width: 200, height: 70 })
    expect(layout.placements[2]).toEqual({ x: 60, y: 93, width: 80, height: 40 })
  })

  it('fits uniformly to the largest source without stretching', () => {
    expect(scaledSize(a, { sizing: 'fit-uniform', customCell: { width: 1, height: 1 } }, { width: 200, height: 70 }))
      .toEqual({ width: 140, height: 70 })
    expect(scaledSize(b, { sizing: 'fit-uniform', customCell: { width: 1, height: 1 } }, { width: 200, height: 70 }))
      .toEqual({ width: 200, height: 70 })
  })

  it('fits to largest width or height while keeping aspect ratio', () => {
    expect(scaledSize(a, { sizing: 'fit-largest-width', customCell: { width: 1, height: 1 } }, { width: 200, height: 70 }))
      .toEqual({ width: 200, height: 100 })
    expect(scaledSize(b, { sizing: 'fit-largest-height', customCell: { width: 1, height: 1 } }, { width: 200, height: 70 }))
      .toEqual({ width: 200, height: 70 })
  })

  it('uses custom cell size as a contain box', () => {
    expect(scaledSize(b, { sizing: 'custom', customCell: { width: 100, height: 100 } }, { width: 200, height: 70 }))
      .toEqual({ width: 100, height: 35 })
  })
})

describe('merge png helpers', () => {
  it('picks auto grid columns from the square root, capped at 4', () => {
    expect(resolveGridColumns(1, 'auto')).toBe(1)
    expect(resolveGridColumns(2, 'auto')).toBe(2)
    expect(resolveGridColumns(3, 'auto')).toBe(2)
    expect(resolveGridColumns(4, 'auto')).toBe(2)
    expect(resolveGridColumns(9, 'auto')).toBe(3)
    expect(resolveGridColumns(16, 'auto')).toBe(4)
    expect(resolveGridColumns(5, 3)).toBe(3)
  })

  it('aligns along both axes', () => {
    expect(alignXOffset(200, 100, 'left')).toBe(0)
    expect(alignXOffset(200, 100, 'center')).toBe(50)
    expect(alignXOffset(200, 100, 'right')).toBe(100)
    expect(alignYOffset(70, 50, 'top')).toBe(0)
    expect(alignYOffset(70, 50, 'center')).toBe(10)
    expect(alignYOffset(70, 50, 'bottom')).toBe(20)
  })

  it('maps background kinds without filling transparent', () => {
    expect(resolveMergeBackground('transparent')).toBeNull()
    expect(resolveMergeBackground('white')).toBe('#ffffff')
    expect(resolveMergeBackground('black')).toBe('#000000')
    expect(resolveMergeBackground('custom', '#ff00aa')).toBe('#ff00aa')
  })

  it('reorders items and reports remaining slots', () => {
    expect(reorderItems(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(reorderItems(['a', 'b'], 0, 0)).toEqual(['a', 'b'])
    expect(remainingMergeSlots(0)).toBe(MAX_MERGE_FILES)
    expect(remainingMergeSlots(18)).toBe(2)
  })

  it('rejects oversized merged canvases without silently downscaling', () => {
    expect(() => assertSafeMergeSize(4_000, 3_000)).not.toThrow()
    expect(() => assertSafeMergeSize(MAX_IMAGE_DIMENSION + 1, 10)).toThrow(MERGE_ERROR.tooLarge)
    expect(() => assertSafeMergeSize(10_000, Math.ceil(MAX_IMAGE_PIXELS / 10_000) + 1)).toThrow(MERGE_ERROR.tooLarge)
  })

  it('names the download from a timestamp', () => {
    expect(mergeOutputFilename(new Date('2026-09-12T08:15:30.000Z'))).toBe('kits-merged-20260912081530.png')
  })
})

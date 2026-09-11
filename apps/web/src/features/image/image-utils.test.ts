import { describe, expect, it } from 'vitest'
import {
  assertValidImageSize, fileMatchesAccept, getImageWorkspaceMode, normalizeCrop, rotatedSize, validateFiles, watermarkPoint,
} from './image-utils'

describe('image workspace modes', () => {
  it('maps implemented canvas tools and rejects incomplete image-canvas slugs', () => {
    expect(getImageWorkspaceMode('compress-image')).toBe('compress')
    expect(getImageWorkspaceMode('resize-image')).toBe('resize')
    expect(getImageWorkspaceMode('crop-image')).toBe('crop')
    expect(getImageWorkspaceMode('rotate-image')).toBe('transform')
    expect(getImageWorkspaceMode('flip-image')).toBe('transform')
    expect(getImageWorkspaceMode('watermark-image')).toBe('watermark')
    expect(getImageWorkspaceMode('remove-metadata')).toBe('metadata')
    expect(getImageWorkspaceMode('png-to-jpg')).toBe('converter')
    expect(getImageWorkspaceMode('svg-to-png')).toBe('svg-to-png')
    expect(getImageWorkspaceMode('favicon-generator')).toBe('favicon')
    expect(getImageWorkspaceMode('meme-generator')).toBe('meme')
    expect(getImageWorkspaceMode('photo-editor')).toBe('photo-editor')
  })
})

describe('image calculations', () => {
  it('validates dimensions and pixel count', () => {
    expect(() => assertValidImageSize(4_000, 3_000)).not.toThrow()
    expect(() => assertValidImageSize(10_000, 5_000)).toThrow('40 megapixels')
    expect(() => assertValidImageSize(1.5, 20)).toThrow('positive whole numbers')
  })

  it('normalizes valid crops and rejects out-of-bounds crops', () => {
    expect(normalizeCrop(undefined, { width: 800, height: 600 })).toEqual({ x: 0, y: 0, width: 800, height: 600 })
    expect(normalizeCrop({ x: 10.4, y: 20.4, width: 100.4, height: 200.4 }, { width: 800, height: 600 }))
      .toEqual({ x: 10, y: 20, width: 100, height: 200 })
    expect(() => normalizeCrop({ x: 750, y: 0, width: 100, height: 100 }, { width: 800, height: 600 }))
      .toThrow('outside')
  })

  it('calculates rotated bounds and all watermark alignments', () => {
    expect(rotatedSize(1200, 800, 90)).toEqual({ width: 800, height: 1200 })
    const expected = {
      'top-left': { x: 10, y: 10 }, 'top-center': { x: 120, y: 10 }, 'top-right': { x: 230, y: 10 },
      'center-left': { x: 10, y: 90 }, center: { x: 120, y: 90 }, 'center-right': { x: 230, y: 90 },
      'bottom-left': { x: 10, y: 170 }, 'bottom-center': { x: 120, y: 170 }, 'bottom-right': { x: 230, y: 170 },
    } as const
    for (const [position, point] of Object.entries(expected)) {
      expect(watermarkPoint({ width: 300, height: 200 }, { width: 60, height: 20 }, position as keyof typeof expected, 10)).toEqual(point)
    }
  })
})

describe('file validation', () => {
  const png = { name: 'photo.PNG', size: 100, type: 'image/png' }
  const jpeg = { name: 'photo.jpg', size: 200, type: 'image/jpeg' }

  it('matches MIME types, wildcards, and extensions', () => {
    expect(fileMatchesAccept(png, ['image/png'])).toBe(true)
    expect(fileMatchesAccept(jpeg, ['image/*'])).toBe(true)
    expect(fileMatchesAccept({ ...png, type: '' }, ['.png'])).toBe(true)
    expect(fileMatchesAccept(png, ['.jpg'])).toBe(false)
  })

  it('validates the entire selection before returning files', () => {
    expect(validateFiles([png, jpeg], { accept: ['image/*'], multiple: true, maxFiles: 2 }).files).toEqual([png, jpeg])
    expect(validateFiles([png, jpeg], { multiple: false }).error).toContain('1 file')
    expect(validateFiles([png, jpeg], { multiple: true, maxFiles: 1 }).error).toContain('1 file')
    expect(validateFiles([jpeg], { accept: ['.png'] }).error).toContain('unsupported')
    expect(validateFiles([jpeg], { maxFileSize: 100 }).error).toContain('exceeds')
  })
})

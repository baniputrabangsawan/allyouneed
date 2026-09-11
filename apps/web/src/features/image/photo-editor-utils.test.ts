import { describe, expect, it } from 'vitest'
import { normalizeCrop } from './image-utils'
import {
  clampPhotoEditorState,
  createPhotoEditorHistory,
  dragCrop,
  identityPhotoEditorState,
  isIdentityPhotoEditorState,
  photoEditorExportSpec,
  photoEditorFilter,
  photoEditorOutputSize,
  photoEditorStatesEqual,
  pushPhotoEditorHistory,
  redoPhotoEditorHistory,
  resetPhotoEditorHistory,
  rotatePhotoEditorState,
  undoPhotoEditorHistory,
} from './photo-editor-utils'

const source = { width: 800, height: 600 }

describe('photo editor identity', () => {
  it('treats a full-frame unedited state as identity', () => {
    const identity = identityPhotoEditorState(source)
    expect(isIdentityPhotoEditorState(identity, source)).toBe(true)
    expect(identity.crop).toEqual({ x: 0, y: 0, width: 800, height: 600 })
    expect(photoEditorStatesEqual(identity, { ...identity, flipX: true })).toBe(false)
    expect(isIdentityPhotoEditorState({ ...identity, brightness: 110 }, source)).toBe(false)
  })
})

describe('photo editor history', () => {
  it('undoes, redoes, and clears redo on a new push', () => {
    const identity = identityPhotoEditorState(source)
    let history = createPhotoEditorHistory(identity)
    history = pushPhotoEditorHistory(history, { ...identity, brightness: 110 })
    history = pushPhotoEditorHistory(history, { ...identity, brightness: 120 })
    expect(history.present.brightness).toBe(120)

    history = undoPhotoEditorHistory(history)
    expect(history.present.brightness).toBe(110)
    history = undoPhotoEditorHistory(history)
    expect(history.present).toEqual(identity)
    history = undoPhotoEditorHistory(history)
    expect(history.present).toEqual(identity)

    history = redoPhotoEditorHistory(history)
    expect(history.present.brightness).toBe(110)
    history = redoPhotoEditorHistory(history)
    expect(history.present.brightness).toBe(120)

    history = undoPhotoEditorHistory(history)
    history = pushPhotoEditorHistory(history, { ...identity, contrast: 80 })
    expect(history.future).toEqual([])
    expect(history.present.contrast).toBe(80)
    expect(history.past).toHaveLength(2)
  })

  it('ignores duplicate pushes and resets to identity', () => {
    const identity = identityPhotoEditorState(source)
    let history = pushPhotoEditorHistory(createPhotoEditorHistory(identity), identity)
    expect(history.past).toEqual([])
    history = pushPhotoEditorHistory(history, { ...identity, flipY: true })
    history = resetPhotoEditorHistory(source)
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
    expect(isIdentityPhotoEditorState(history.present, source)).toBe(true)
  })
})

describe('photo editor geometry', () => {
  it('swaps output size after a crop and 90° rotate', () => {
    const cropped = {
      ...identityPhotoEditorState(source),
      crop: { x: 10, y: 20, width: 100, height: 40 },
      rotation: 90,
    }
    expect(photoEditorOutputSize(cropped, source)).toEqual({ width: 40, height: 100 })
    expect(photoEditorOutputSize(rotatePhotoEditorState(identityPhotoEditorState(source), 90), source))
      .toEqual({ width: 600, height: 800 })
  })

  it('does not change size when flipping', () => {
    const flipped = { ...identityPhotoEditorState(source), flipX: true, flipY: true }
    expect(photoEditorOutputSize(flipped, source)).toEqual({ width: 800, height: 600 })
  })

  it('rejects invalid crops through normalizeCrop', () => {
    const invalid = { ...identityPhotoEditorState(source), crop: { x: 750, y: 0, width: 100, height: 100 } }
    expect(() => photoEditorOutputSize(invalid, source)).toThrow('outside')
    expect(() => normalizeCrop(invalid.crop, source)).toThrow('outside')
  })

  it('clamps live crop drags inside the source', () => {
    const crop = { x: 10, y: 10, width: 100, height: 80 }
    expect(dragCrop(crop, 'move', { x: -40, y: 0 }, source)).toEqual({ x: 0, y: 10, width: 100, height: 80 })
    expect(dragCrop(crop, 'se', { x: 20, y: 10 }, source)).toEqual({ x: 10, y: 10, width: 120, height: 90 })
    expect(dragCrop(crop, 'nw', { x: 20, y: 20 }, source)).toEqual({ x: 30, y: 30, width: 80, height: 60 })
  })
})

describe('photo editor filters and export', () => {
  it('builds a CSS filter only for non-identity adjustments', () => {
    const identity = identityPhotoEditorState(source)
    expect(photoEditorFilter(identity)).toBe('none')
    expect(photoEditorFilter({ ...identity, brightness: 120, contrast: 80, saturation: 50, grayscale: 40, blur: 5 }))
      .toBe('brightness(1.2) contrast(0.8) saturate(0.5) grayscale(0.4) blur(5px)')
  })

  it('reports export dimensions and MIME, ignoring quality for PNG', () => {
    const cropped = {
      ...identityPhotoEditorState(source),
      crop: { x: 0, y: 0, width: 200, height: 100 },
      rotation: 90,
    }
    expect(photoEditorExportSpec(cropped, source, 'image/jpeg', 80)).toEqual({
      width: 100, height: 200, mime: 'image/jpeg', quality: 0.8,
    })
    expect(photoEditorExportSpec(cropped, source, 'image/webp', 50)).toEqual({
      width: 100, height: 200, mime: 'image/webp', quality: 0.5,
    })
    expect(photoEditorExportSpec(cropped, source, 'image/png', 80)).toEqual({
      width: 100, height: 200, mime: 'image/png',
    })
  })

  it('clamps filter and crop values for live editing', () => {
    const clamped = clampPhotoEditorState({
      ...identityPhotoEditorState(source),
      brightness: 400,
      grayscale: -10,
      blur: 99,
      rotation: 450,
      crop: { x: -8, y: 10, width: 900, height: 10 },
    }, source)
    expect(clamped.brightness).toBe(200)
    expect(clamped.grayscale).toBe(0)
    expect(clamped.blur).toBe(50)
    expect(clamped.rotation).toBe(90)
    expect(clamped.crop.x).toBe(0)
    expect(clamped.crop.width).toBe(800)
  })
})

import { normalizeCrop, rotatedSize, type ImageCrop, type Point, type Size } from './image-utils'

export type PhotoEditorFormat = 'image/jpeg' | 'image/png' | 'image/webp'
export type PhotoCropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface PhotoEditorState {
  crop: ImageCrop
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
  grayscale: number
  blur: number
}

export interface PhotoEditorHistory {
  past: PhotoEditorState[]
  present: PhotoEditorState
  future: PhotoEditorState[]
}

export interface PhotoEditorExportSpec {
  width: number
  height: number
  mime: PhotoEditorFormat
  quality?: number
}

const MAX_HISTORY = 50

export function identityPhotoEditorState(source: Size): PhotoEditorState {
  return {
    crop: { x: 0, y: 0, width: source.width, height: source.height },
    rotation: 0,
    flipX: false,
    flipY: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    blur: 0,
  }
}

export function photoEditorStatesEqual(a: PhotoEditorState, b: PhotoEditorState): boolean {
  return a.rotation === b.rotation
    && a.flipX === b.flipX
    && a.flipY === b.flipY
    && a.brightness === b.brightness
    && a.contrast === b.contrast
    && a.saturation === b.saturation
    && a.grayscale === b.grayscale
    && a.blur === b.blur
    && a.crop.x === b.crop.x
    && a.crop.y === b.crop.y
    && a.crop.width === b.crop.width
    && a.crop.height === b.crop.height
}

export function isIdentityPhotoEditorState(state: PhotoEditorState, source: Size): boolean {
  return photoEditorStatesEqual(state, identityPhotoEditorState(source))
}

export function clampPhotoEditorState(state: PhotoEditorState, source: Size): PhotoEditorState {
  return {
    crop: clampCrop(state.crop, source),
    rotation: normalizeRotation(state.rotation),
    flipX: Boolean(state.flipX),
    flipY: Boolean(state.flipY),
    brightness: clamp(state.brightness, 0, 200),
    contrast: clamp(state.contrast, 0, 200),
    saturation: clamp(state.saturation, 0, 200),
    grayscale: clamp(state.grayscale, 0, 100),
    blur: clamp(state.blur, 0, 50),
  }
}

export function createPhotoEditorHistory(present: PhotoEditorState): PhotoEditorHistory {
  return { past: [], present, future: [] }
}

export function pushPhotoEditorHistory(history: PhotoEditorHistory, next: PhotoEditorState): PhotoEditorHistory {
  if (photoEditorStatesEqual(history.present, next)) return history
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  }
}

export function undoPhotoEditorHistory(history: PhotoEditorHistory): PhotoEditorHistory {
  const previous = history.past.at(-1)
  if (!previous) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redoPhotoEditorHistory(history: PhotoEditorHistory): PhotoEditorHistory {
  const [next, ...rest] = history.future
  if (!next) return history
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: rest,
  }
}

export function resetPhotoEditorHistory(source: Size): PhotoEditorHistory {
  return createPhotoEditorHistory(identityPhotoEditorState(source))
}

export function rotatePhotoEditorState(state: PhotoEditorState, degrees: number): PhotoEditorState {
  return { ...state, rotation: normalizeRotation(state.rotation + degrees) }
}

export function photoEditorFilter(state: Pick<PhotoEditorState, 'brightness' | 'contrast' | 'saturation' | 'grayscale' | 'blur'>): string {
  const parts: string[] = []
  if (state.brightness !== 100) parts.push(`brightness(${formatFilterAmount(state.brightness / 100)})`)
  if (state.contrast !== 100) parts.push(`contrast(${formatFilterAmount(state.contrast / 100)})`)
  if (state.saturation !== 100) parts.push(`saturate(${formatFilterAmount(state.saturation / 100)})`)
  if (state.grayscale > 0) parts.push(`grayscale(${formatFilterAmount(state.grayscale / 100)})`)
  if (state.blur > 0) parts.push(`blur(${state.blur}px)`)
  return parts.length === 0 ? 'none' : parts.join(' ')
}

export function photoEditorOutputSize(state: PhotoEditorState, source: Size): Size {
  const crop = normalizeCrop(state.crop, source)
  return rotatedSize(crop.width, crop.height, state.rotation)
}

export function photoEditorExportSpec(
  state: PhotoEditorState,
  source: Size,
  format: PhotoEditorFormat,
  qualityPercent: number,
): PhotoEditorExportSpec {
  const size = photoEditorOutputSize(state, source)
  if (format === 'image/png') return { width: size.width, height: size.height, mime: format }
  return {
    width: size.width,
    height: size.height,
    mime: format,
    quality: clamp(qualityPercent, 0, 100) / 100,
  }
}

export function clampCrop(crop: ImageCrop, source: Size): ImageCrop {
  const x = clamp(Math.round(crop.x), 0, Math.max(0, source.width - 1))
  const y = clamp(Math.round(crop.y), 0, Math.max(0, source.height - 1))
  const width = clamp(Math.round(crop.width), 1, Math.max(1, source.width - x))
  const height = clamp(Math.round(crop.height), 1, Math.max(1, source.height - y))
  return { x, y, width, height }
}

export function dragCrop(crop: ImageCrop, handle: PhotoCropHandle, delta: Point, source: Size): ImageCrop {
  if (handle === 'move') {
    return clampCrop({
      x: crop.x + delta.x,
      y: crop.y + delta.y,
      width: crop.width,
      height: crop.height,
    }, source)
  }

  let x = crop.x
  let y = crop.y
  let x2 = crop.x + crop.width
  let y2 = crop.y + crop.height
  if (handle === 'w' || handle === 'nw' || handle === 'sw') x += delta.x
  if (handle === 'e' || handle === 'ne' || handle === 'se') x2 += delta.x
  if (handle === 'n' || handle === 'nw' || handle === 'ne') y += delta.y
  if (handle === 's' || handle === 'sw' || handle === 'se') y2 += delta.y
  if (x2 < x) [x, x2] = [x2, x]
  if (y2 < y) [y, y2] = [y2, y]
  return clampCrop({ x, y, width: x2 - x, height: y2 - y }, source)
}

export function fitDisplaySize(source: Size, bounds: Size): Size {
  const scale = Math.min(1, bounds.width / source.width, bounds.height / source.height)
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

function normalizeRotation(degrees: number): number {
  return ((Math.round(degrees / 90) * 90) % 360 + 360) % 360
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function formatFilterAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

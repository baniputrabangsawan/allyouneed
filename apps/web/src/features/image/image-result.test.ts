import { describe, expect, it } from 'vitest'
import {
  imagePreviewState,
  isImageResultFile,
  mimeLabel,
  shouldAutoDownload,
  shouldCompare,
  toolOutputsImage,
  usesCheckerboard,
} from './image-result'

describe('image result helpers', () => {
  it('maps preview states from processing, result, and failure', () => {
    expect(imagePreviewState({})).toBe('empty')
    expect(imagePreviewState({ processing: true })).toBe('processing')
    expect(imagePreviewState({ processing: true, resultSrc: 'blob:result' })).toBe('ready')
    expect(imagePreviewState({ failed: true, resultSrc: 'blob:result' })).toBe('failed')
  })

  it('detects image downloads and skips archives or text', () => {
    expect(isImageResultFile('cutout.png')).toBe(true)
    expect(isImageResultFile('photo.JPG')).toBe(true)
    expect(isImageResultFile('pack.zip')).toBe(false)
    expect(isImageResultFile('notes.txt', 'text/plain')).toBe(false)
    expect(isImageResultFile('result.bin', 'image/webp')).toBe(true)
  })

  it('marks image-output tools without treating text image utilities as previews', () => {
    expect(toolOutputsImage({ category: 'image', slug: 'compress-image' })).toBe(true)
    expect(toolOutputsImage({ category: 'image', slug: 'remove-background', outputFormats: ['image/png'] })).toBe(true)
    expect(toolOutputsImage({ category: 'qr', slug: 'qr-code-generator', outputFormats: ['image/png'] })).toBe(true)
    expect(toolOutputsImage({ category: 'pdf', slug: 'pdf-to-jpg' })).toBe(true)
    expect(toolOutputsImage({ category: 'video', slug: 'video-to-gif' })).toBe(true)
    expect(toolOutputsImage({ category: 'pdf', slug: 'compress-pdf' })).toBe(false)
    expect(toolOutputsImage({ category: 'image', slug: 'image-to-base64' })).toBe(false)
    expect(toolOutputsImage({ category: 'audio', slug: 'audio-converter' })).toBe(false)
  })

  it('compares original and result only when both exist and differ', () => {
    expect(shouldCompare('blob:a', 'blob:b')).toBe(true)
    expect(shouldCompare('blob:a', 'blob:a')).toBe(false)
    expect(shouldCompare('blob:a', 'blob:b', false)).toBe(false)
    expect(shouldCompare(undefined, 'blob:b')).toBe(false)
  })

  it('uses a checkerboard for transparent-capable rasters', () => {
    expect(usesCheckerboard({ mime: 'image/png' })).toBe(true)
    expect(usesCheckerboard({ filename: 'cutout.webp' })).toBe(true)
    expect(usesCheckerboard({ mime: 'image/jpeg' })).toBe(false)
    expect(usesCheckerboard({ checkerboard: false, mime: 'image/png' })).toBe(false)
    expect(usesCheckerboard({ checkerboard: true, mime: 'image/jpeg' })).toBe(true)
  })

  it('auto-downloads a new result once and skips restored jobs', () => {
    expect(shouldAutoDownload({ id: 'job-1', source: 'https://cdn/result.png', filename: 'out.png' })).toBe(true)
    expect(shouldAutoDownload({ id: 'job-1', source: 'https://cdn/result.png', filename: 'out.png', restored: true })).toBe(false)
    expect(shouldAutoDownload({ id: 'job-1', source: 'https://cdn/result.png', filename: 'out.png', enabled: false })).toBe(false)
    expect(shouldAutoDownload({ id: '', source: 'https://cdn/result.png', filename: 'out.png' })).toBe(false)
  })

  it('labels common image MIME types without inventing metrics', () => {
    expect(mimeLabel('image/png')).toBe('PNG')
    expect(mimeLabel('image/jpeg')).toBe('JPG')
    expect(mimeLabel(undefined, 'export.webp')).toBe('WebP')
  })
})

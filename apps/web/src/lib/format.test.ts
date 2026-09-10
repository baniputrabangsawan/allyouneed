import { describe, expect, it } from 'vitest'
import { formatBytes, outputFilename } from './format'

describe('format utilities', () => {
  it('formats byte sizes', () => expect(formatBytes(2.8 * 1024 * 1024)).toBe('2.8 MB'))
  it('creates safe download names', () => expect(outputFilename('my photo.JPG', 'resized', 'webp')).toBe('my-photo-resized.webp'))
})

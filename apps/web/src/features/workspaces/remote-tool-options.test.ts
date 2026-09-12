import { describe, expect, it } from 'vitest'
import { defaultRemoteOptions, formatPageList, parsePageList, sanitizeRemoteOptions } from './remote-tool-options'

describe('parsePageList', () => {
  it('parses comma-separated pages and ranges', () => {
    expect(parsePageList('1, 3-5, 8')).toEqual([1, 3, 4, 5, 8])
  })

  it('ignores invalid tokens', () => {
    expect(parsePageList('0, -2, foo, 2-1, 4')).toEqual([4])
  })

  it('round-trips through formatPageList', () => {
    expect(formatPageList(parsePageList('1,3,5'))).toBe('1, 3, 5')
  })
})

describe('defaultRemoteOptions', () => {
  it('returns a copy of known defaults', () => {
    const first = defaultRemoteOptions('change-audio-speed')
    first.speed = 2
    expect(defaultRemoteOptions('change-audio-speed')).toEqual({ speed: 1 })
  })

  it('returns an empty object for tools without options', () => {
    expect(defaultRemoteOptions('merge-pdf')).toEqual({})
  })

  it('defaults add-subtitle to burn-in with style options', () => {
    expect(defaultRemoteOptions('add-subtitle')).toEqual({
      mode: 'burn',
      format: 'mp4',
      fontSize: 24,
      fontColor: '#ffffff',
      outline: 'outline',
      position: 'bottom',
      marginV: 24,
    })
  })

  it('defaults blur-face to blur without strength', () => {
    expect(defaultRemoteOptions('blur-face')).toEqual({ mode: 'blur' })
  })
})

describe('sanitizeRemoteOptions', () => {
  it('keeps blur-face mode-only and ignores leftover strength', () => {
    expect(sanitizeRemoteOptions('blur-face', { mode: 'pixelate', strength: 32 })).toEqual({ mode: 'pixelate' })
    expect(sanitizeRemoteOptions('blur-face', { strength: 0 })).toEqual({ mode: 'blur' })
    expect(sanitizeRemoteOptions('blur-face', { mode: 'wipe' })).toEqual({ mode: 'blur' })
  })
})

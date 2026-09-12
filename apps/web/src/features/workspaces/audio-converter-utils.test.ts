import { describe, expect, it } from 'vitest'
import {
  buildAudioConvertOptions,
  defaultAudioBitrate,
  formatBytes,
  formatDuration,
  isLosslessAudioFormat,
} from './audio-converter-utils'

describe('audio converter options', () => {
  it('omits bitrate for lossless formats', () => {
    expect(isLosslessAudioFormat('wav')).toBe(true)
    expect(isLosslessAudioFormat('flac')).toBe(true)
    expect(isLosslessAudioFormat('mp3')).toBe(false)
    expect(buildAudioConvertOptions({
      format: 'wav',
      bitrate: '320k',
      sampleRate: 'original',
      channels: 'original',
    })).toEqual({ format: 'wav' })
  })

  it('sends bitrate and optional resampling for lossy formats', () => {
    expect(defaultAudioBitrate('opus')).toBe('128k')
    expect(buildAudioConvertOptions({
      format: 'mp3',
      bitrate: '192k',
      sampleRate: 44100,
      channels: 1,
    })).toEqual({ format: 'mp3', bitrate: '192k', sampleRate: 44100, channels: 1 })
  })

  it('formats size and duration for the result panel', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatDuration(12.4)).toBe('12.4s')
    expect(formatDuration(75.2)).toBe('1m 15.2s')
  })
})

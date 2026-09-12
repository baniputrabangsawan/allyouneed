import { describe, expect, it } from 'vitest'
import { formatAcceptLabels } from './accept-labels'
import { mediaKindFromFile, previewKind, resultMediaKind } from './kind'
import { workflowErrorCode, workflowMessage } from './workflow-error'

describe('formatAcceptLabels', () => {
  it('dedupes MIME aliases and uses readable names', () => {
    expect(formatAcceptLabels([
      'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg', 'audio/webm',
      'audio/flac', 'audio/aac', 'audio/opus', 'video/mp4', 'video/webm', 'video/quicktime',
    ])).toEqual(['MP3', 'WAV', 'M4A', 'OGG', 'WebM', 'FLAC', 'AAC', 'Opus', 'MP4', 'MOV'])
  })
})

describe('media kind', () => {
  it('treats MediaRecorder webm as audio unless video MIME is set', () => {
    expect(mediaKindFromFile(new File([], 'recording.webm', { type: 'audio/webm' }))).toBe('audio')
    expect(mediaKindFromFile(new File([], 'clip.webm', { type: 'video/webm' }))).toBe('video')
    expect(mediaKindFromFile(new File([], 'recording.webm'))).toBe('audio')
    expect(previewKind(new File([], 'clip.mp4'), 'video')).toBe('video')
  })

  it('maps extract-audio results to audio', () => {
    expect(resultMediaKind({ category: 'video', slug: 'extract-audio-from-video' })).toBe('audio')
    expect(resultMediaKind({ category: 'video', slug: 'video-compressor' })).toBe('video')
    expect(resultMediaKind({ category: 'audio', slug: 'noise-reduction' })).toBe('audio')
  })
})

describe('workflow errors', () => {
  it('maps Failed to fetch to UPLOAD_FAILED copy', () => {
    expect(workflowErrorCode(new TypeError('Failed to fetch'))).toBe('UPLOAD_FAILED')
    expect(workflowMessage(new TypeError('Failed to fetch'), {
      uploadFailed: 'Could not reach the processing server.',
      processingFailed: 'Processing failed.',
    })).toBe('Could not reach the processing server.')
  })
})

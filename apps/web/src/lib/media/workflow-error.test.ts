import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { errorFromJob, workflowErrorCode, workflowMessage } from './workflow-error'

const copy = {
  apiUnreachable: 'Could not reach the processing server.',
  uploadFailed: 'The file could not be uploaded.',
  queueUnavailable: 'The processing queue is unavailable.',
  processingFailed: 'Processing failed.',
  ffmpegFailed: 'The media engine could not process this file.',
  resultFetchFailed: 'The processed result could not be loaded.',
}

describe('workflow errors', () => {
  it('maps network failures to API_UNREACHABLE', () => {
    expect(workflowErrorCode(new TypeError('Failed to fetch'))).toBe('API_UNREACHABLE')
    expect(workflowErrorCode(new ApiError('down', { status: 0, code: 'API_UNREACHABLE' }))).toBe('API_UNREACHABLE')
    expect(workflowErrorCode(new ApiError('timed out', { status: 0, code: 'TIMEOUT' }))).toBe('API_UNREACHABLE')
    expect(workflowMessage(new TypeError('Failed to fetch'), copy)).toBe(copy.apiUnreachable)
  })

  it('keeps upload failures distinct from an unreachable API', () => {
    expect(workflowErrorCode(new ApiError('Upload failed.', { status: 0, code: 'UPLOAD_FAILED' }))).toBe('UPLOAD_FAILED')
    expect(workflowMessage(new Error('Upload failed (0).'), copy)).toBe(copy.uploadFailed)
  })

  it('maps queue, ffmpeg, and result codes', () => {
    expect(workflowErrorCode(new ApiError('queue', { status: 503, code: 'PROCESSING_QUEUE_UNAVAILABLE' }))).toBe('QUEUE_UNAVAILABLE')
    expect(workflowErrorCode(errorFromJob({ code: 'FFMPEG_FAILED', message: 'ffmpeg log' }))).toBe('FFMPEG_FAILED')
    expect(workflowMessage(errorFromJob({ code: 'FFMPEG_FAILED', message: 'ffmpeg log' }), copy)).toBe(copy.ffmpegFailed)
    expect(workflowErrorCode(new ApiError('not ready', { status: 409, code: 'JOB_NOT_READY' }))).toBe('RESULT_FETCH_FAILED')
  })

  it('keeps structured processing messages', () => {
    expect(workflowMessage(new ApiError('This file has no audio stream.', {
      status: 422,
      code: 'AUDIO_STREAM_NOT_FOUND',
    }), copy)).toBe('This file has no audio stream.')
  })

  it('maps subtitle codes to user-safe copy', () => {
    const messages = {
      ...copy,
      noVideoStream: 'This file has no video stream.',
      invalidSubtitleFile: 'That subtitle file could not be read.',
      unsupportedSubtitleFormat: 'Use an .srt, .vtt, or .ass subtitle file.',
      subtitleRenderFailed: 'Subtitles could not be burned into this video.',
    }
    expect(workflowErrorCode(errorFromJob({ code: 'NO_VIDEO_STREAM', message: 'ffprobe' }))).toBe('NO_VIDEO_STREAM')
    expect(workflowErrorCode(errorFromJob({ code: 'VIDEO_STREAM_NOT_FOUND', message: 'ffprobe' }))).toBe('NO_VIDEO_STREAM')
    expect(workflowErrorCode(errorFromJob({ code: 'INVALID_SUBTITLE_FILE', message: 'parse' }))).toBe('INVALID_SUBTITLE_FILE')
    expect(workflowErrorCode(errorFromJob({ code: 'UNSUPPORTED_SUBTITLE_FORMAT', message: 'txt' }))).toBe('UNSUPPORTED_SUBTITLE_FORMAT')
    expect(workflowErrorCode(errorFromJob({ code: 'SUBTITLE_RENDER_FAILED', message: 'libass' }))).toBe('SUBTITLE_RENDER_FAILED')
    expect(workflowMessage(errorFromJob({ code: 'SUBTITLE_RENDER_FAILED', message: 'libass' }), messages)).toBe(messages.subtitleRenderFailed)
    expect(workflowMessage(errorFromJob({ code: 'INVALID_SUBTITLE_FILE', message: 'parse' }), messages)).toBe(messages.invalidSubtitleFile)
  })

  it('surfaces no-face job messages instead of a generic failure', () => {
    expect(workflowMessage(errorFromJob({
      code: 'NO_FACES_DETECTED',
      message: 'No face detected',
    }), copy)).toBe('No face detected')
  })

  it('maps speech codes without collapsing them', () => {
    expect(workflowErrorCode(errorFromJob({ code: 'NO_AUDIO_STREAM', message: 'no audio' }))).toBe('NO_AUDIO_STREAM')
    expect(workflowErrorCode(errorFromJob({ code: 'MODEL_UNAVAILABLE', message: 'missing' }))).toBe('MODEL_UNAVAILABLE')
    expect(workflowErrorCode(errorFromJob({ code: 'TEXT_TOO_LONG', message: 'long' }))).toBe('TEXT_TOO_LONG')
    expect(workflowMessage(errorFromJob({ code: 'TTS_FAILED', message: 'Speech could not be generated.' }), copy)).toBe('Speech could not be generated.')
  })

  it('maps background removal failures without leaking CUDA details', () => {
    const messages = {
      ...copy,
      modelUnavailable: 'Quality background removal model is not available.',
      aiProcessingFailed: 'Background removal failed. Please try again.',
    }
    expect(workflowErrorCode(errorFromJob({ code: 'MODEL_UNAVAILABLE', message: 'missing' }))).toBe('MODEL_UNAVAILABLE')
    expect(workflowErrorCode(errorFromJob({
      code: 'BACKGROUND_REMOVAL_FAILED',
      message: 'CUDA error: out of memory',
    }))).toBe('AI_PROCESSING_FAILED')
    expect(workflowMessage(errorFromJob({
      code: 'BACKGROUND_REMOVAL_FAILED',
      message: 'CUDA error: out of memory',
    }), messages)).toBe(messages.aiProcessingFailed)
    expect(workflowMessage(errorFromJob({ code: 'MODEL_UNAVAILABLE', message: 'missing' }), messages)).toBe(messages.modelUnavailable)
  })
})

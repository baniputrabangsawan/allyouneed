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
})

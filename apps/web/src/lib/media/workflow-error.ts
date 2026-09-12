import { ApiError } from '../api/client'

export type WorkflowErrorCode =
  | 'API_UNREACHABLE'
  | 'UPLOAD_FAILED'
  | 'QUEUE_UNAVAILABLE'
  | 'PROCESSING_FAILED'
  | 'FFMPEG_FAILED'
  | 'RESULT_FETCH_FAILED'
  | 'NO_AUDIO_STREAM'
  | 'NO_VIDEO_STREAM'
  | 'INVALID_SUBTITLE_FILE'
  | 'UNSUPPORTED_SUBTITLE_FORMAT'
  | 'SUBTITLE_RENDER_FAILED'
  | 'UNSUPPORTED_MEDIA'
  | 'TRANSCRIPTION_FAILED'
  | 'MODEL_UNAVAILABLE'
  | 'TEXT_TOO_LONG'
  | 'VOICE_UNAVAILABLE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'VOICE_LANGUAGE_MISMATCH'
  | 'STYLE_UNAVAILABLE'
  | 'STYLE_VOICE_MISMATCH'
  | 'TTS_FAILED'
  | 'AI_PROCESSING_FAILED'

export interface WorkflowMessages {
  apiUnreachable: string
  uploadFailed: string
  queueUnavailable: string
  processingFailed: string
  ffmpegFailed: string
  resultFetchFailed: string
  textTooLong?: string
  noAudioStream?: string
  noVideoStream?: string
  invalidSubtitleFile?: string
  unsupportedSubtitleFormat?: string
  subtitleRenderFailed?: string
  unsupportedMedia?: string
  transcriptionFailed?: string
  modelUnavailable?: string
  voiceUnavailable?: string
  unsupportedLanguage?: string
  voiceLanguageMismatch?: string
  styleUnavailable?: string
  styleVoiceMismatch?: string
  ttsFailed?: string
  aiProcessingFailed?: string
}

const NETWORK_PATTERN = /failed to fetch|networkerror|load failed|err_connection|econnrefused|fetch failed/i

export function errorFromJob(error?: { code?: string; message?: string } | null): ApiError {
  return new ApiError(error?.message ?? 'Processing failed.', {
    status: 500,
    code: error?.code ?? 'PROCESSING_FAILED',
  })
}

export function workflowErrorCode(reason: unknown): WorkflowErrorCode {
  if (reason instanceof ApiError) {
    if (reason.code === 'API_UNREACHABLE' || reason.code === 'TIMEOUT') return 'API_UNREACHABLE'
    if (reason.code === 'UPLOAD_FAILED') return 'UPLOAD_FAILED'
    if (reason.code === 'PROCESSING_QUEUE_UNAVAILABLE') return 'QUEUE_UNAVAILABLE'
    if (reason.code === 'FFMPEG_FAILED') return 'FFMPEG_FAILED'
    if (reason.code === 'RESULT_FETCH_FAILED' || reason.code === 'JOB_NOT_READY') return 'RESULT_FETCH_FAILED'
    if (reason.code === 'NO_AUDIO_STREAM' || reason.code === 'AUDIO_STREAM_NOT_FOUND') return 'NO_AUDIO_STREAM'
    if (reason.code === 'NO_VIDEO_STREAM' || reason.code === 'VIDEO_STREAM_NOT_FOUND') return 'NO_VIDEO_STREAM'
    if (reason.code === 'INVALID_SUBTITLE_FILE') return 'INVALID_SUBTITLE_FILE'
    if (reason.code === 'UNSUPPORTED_SUBTITLE_FORMAT') return 'UNSUPPORTED_SUBTITLE_FORMAT'
    if (reason.code === 'SUBTITLE_RENDER_FAILED') return 'SUBTITLE_RENDER_FAILED'
    if (reason.code === 'UNSUPPORTED_MEDIA') return 'UNSUPPORTED_MEDIA'
    if (reason.code === 'TRANSCRIPTION_FAILED') return 'TRANSCRIPTION_FAILED'
    if (reason.code === 'MODEL_UNAVAILABLE' || reason.code === 'SERVICE_UNAVAILABLE') return 'MODEL_UNAVAILABLE'
    if (reason.code === 'BACKGROUND_REMOVAL_FAILED' || reason.code === 'AI_PROCESSING_FAILED') return 'AI_PROCESSING_FAILED'
    if (reason.code === 'TEXT_TOO_LONG') return 'TEXT_TOO_LONG'
    if (reason.code === 'VOICE_UNAVAILABLE') return 'VOICE_UNAVAILABLE'
    if (reason.code === 'UNSUPPORTED_LANGUAGE') return 'UNSUPPORTED_LANGUAGE'
    if (reason.code === 'VOICE_LANGUAGE_MISMATCH') return 'VOICE_LANGUAGE_MISMATCH'
    if (reason.code === 'STYLE_UNAVAILABLE') return 'STYLE_UNAVAILABLE'
    if (reason.code === 'STYLE_VOICE_MISMATCH') return 'STYLE_VOICE_MISMATCH'
    if (reason.code === 'TTS_FAILED') return 'TTS_FAILED'
    if (reason.status === 0) return 'API_UNREACHABLE'
    return 'PROCESSING_FAILED'
  }
  const message = reason instanceof Error ? reason.message : ''
  if (/upload failed/i.test(message)) return 'UPLOAD_FAILED'
  if (NETWORK_PATTERN.test(message)) return 'API_UNREACHABLE'
  return 'PROCESSING_FAILED'
}

export function workflowMessage(reason: unknown, messages: WorkflowMessages): string {
  const code = workflowErrorCode(reason)
  if (code === 'API_UNREACHABLE') return messages.apiUnreachable
  if (code === 'UPLOAD_FAILED') return messages.uploadFailed
  if (code === 'QUEUE_UNAVAILABLE') return messages.queueUnavailable
  if (code === 'FFMPEG_FAILED') return messages.ffmpegFailed
  if (code === 'RESULT_FETCH_FAILED') return messages.resultFetchFailed
  if (code === 'NO_AUDIO_STREAM') return messages.noAudioStream ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'NO_VIDEO_STREAM') return messages.noVideoStream ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'INVALID_SUBTITLE_FILE') return messages.invalidSubtitleFile ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'UNSUPPORTED_SUBTITLE_FORMAT') return messages.unsupportedSubtitleFormat ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'SUBTITLE_RENDER_FAILED') return messages.subtitleRenderFailed ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'UNSUPPORTED_MEDIA') return messages.unsupportedMedia ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'TRANSCRIPTION_FAILED') return messages.transcriptionFailed ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'MODEL_UNAVAILABLE') return messages.modelUnavailable ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'AI_PROCESSING_FAILED') return messages.aiProcessingFailed ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'TEXT_TOO_LONG') return messages.textTooLong ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'VOICE_UNAVAILABLE') return messages.voiceUnavailable ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'UNSUPPORTED_LANGUAGE') return messages.unsupportedLanguage ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'VOICE_LANGUAGE_MISMATCH') return messages.voiceLanguageMismatch ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'STYLE_UNAVAILABLE') return messages.styleUnavailable ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'STYLE_VOICE_MISMATCH') return messages.styleVoiceMismatch ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (code === 'TTS_FAILED') return messages.ttsFailed ?? (reason instanceof Error ? reason.message : messages.processingFailed)
  if (reason instanceof Error && reason.message && !NETWORK_PATTERN.test(reason.message)) {
    return reason.message
  }
  return messages.processingFailed
}

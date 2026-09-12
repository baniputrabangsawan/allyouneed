import { ApiError } from '../api/client'

export type WorkflowErrorCode =
  | 'API_UNREACHABLE'
  | 'UPLOAD_FAILED'
  | 'QUEUE_UNAVAILABLE'
  | 'PROCESSING_FAILED'
  | 'FFMPEG_FAILED'
  | 'RESULT_FETCH_FAILED'

export interface WorkflowMessages {
  apiUnreachable: string
  uploadFailed: string
  queueUnavailable: string
  processingFailed: string
  ffmpegFailed: string
  resultFetchFailed: string
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
  if (reason instanceof Error && reason.message && !NETWORK_PATTERN.test(reason.message)) {
    return reason.message
  }
  return messages.processingFailed
}

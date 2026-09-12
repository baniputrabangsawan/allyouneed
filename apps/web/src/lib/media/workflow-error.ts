import { ApiError } from '../api/client'

export type WorkflowErrorCode = 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | 'RESULT_FETCH_FAILED'

export function workflowErrorCode(reason: unknown): WorkflowErrorCode {
  if (reason instanceof ApiError) {
    if (reason.status === 0 || reason.code === 'TIMEOUT') return 'UPLOAD_FAILED'
    return 'PROCESSING_FAILED'
  }
  const message = reason instanceof Error ? reason.message : ''
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'UPLOAD_FAILED'
  return 'PROCESSING_FAILED'
}

export function workflowMessage(
  reason: unknown,
  messages: { uploadFailed: string; processingFailed: string },
): string {
  if (workflowErrorCode(reason) === 'UPLOAD_FAILED') return messages.uploadFailed
  if (reason instanceof Error && reason.message && !/failed to fetch/i.test(reason.message)) {
    return reason.message
  }
  return messages.processingFailed
}

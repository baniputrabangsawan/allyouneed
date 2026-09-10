export interface ApiResponse<T> {
  data: T
}

export interface ApiErrorPayload {
  code?: string
  message?: string
  detail?: string
  requestId?: string
  details?: unknown
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'

export interface JobProgress {
  progress: number | null
  stage?: string
}

export interface Job extends JobProgress {
  jobId: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  error?: ApiErrorPayload
}

export interface CreateJobRequest<TInput, TOptions = Record<string, unknown>> {
  toolId: string
  input: TInput
  options?: TOptions
}

export interface JobResult<T> {
  jobId: string
  result: T
}

export interface PresignUploadRequest {
  filename: string
  contentType: string
  size: number
  toolId: string
}

export interface PresignedUpload {
  uploadUrl: string
  fileKey: string
  expiresIn: number
  headers?: Readonly<Record<string, string>>
}

export interface CompleteUploadRequest {
  fileKey: string
}

export interface UploadedFile {
  fileKey: string
}

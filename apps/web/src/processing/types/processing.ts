export type ProcessingStatus =
  | 'idle'
  | 'ready'
  | 'validating'
  | 'preparing'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ProcessingProgress {
  progress: number | null
  stage?: string
  current?: number
  total?: number
}

export interface ProcessingResult<T> {
  data: T
  duration?: number
}

export interface ProcessingError {
  code: string
  message: string
  retryable?: boolean
}

export interface ProcessingOptions {
  signal?: AbortSignal
  onProgress?: (progress: ProcessingProgress) => void
}

export interface Processor<TInput, TOutput> {
  process(input: TInput, options?: ProcessingOptions): Promise<ProcessingResult<TOutput>>
}

export type ToolState<T = unknown> =
  | { status: 'idle' }
  | { status: 'ready' }
  | { status: 'validating' }
  | { status: 'preparing'; progress?: ProcessingProgress }
  | { status: 'uploading'; progress: ProcessingProgress }
  | { status: 'queued'; progress?: ProcessingProgress }
  | { status: 'processing'; progress: ProcessingProgress }
  | { status: 'completed'; result: ProcessingResult<T> }
  | { status: 'failed'; error: ProcessingError }
  | { status: 'cancelled' }

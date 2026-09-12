import { supportsWebWorkers } from '@/lib/browser-capabilities'
import type { ProcessingProgress } from '@/processing/types/processing'
import { executeImageJob } from './image-jobs'
import {
  blobToTransfer,
  collectTransferables,
  resultFromSerialized,
  type ImageJob,
  type ImageJobResult,
  type SerializedImageJob,
  type WorkerRequest,
  type WorkerResponse,
} from './image-processor-protocol'

interface PendingJob {
  id: number
  resolve: (result: ImageJobResult) => void
  reject: (reason: Error) => void
  onProgress?: (progress: ProcessingProgress) => void
}

const PROGRESS_INTERVAL_MS = 50

let worker: Worker | null = null
let workerFailed = false
let nextId = 1
const pending = new Map<number, PendingJob>()
const lastProgressAt = new Map<number, { at: number; percent: number | null }>()

function canUseWorker(): boolean {
  return !workerFailed && typeof window !== 'undefined' && supportsWebWorkers()
}

function ensureWorker(): Worker | null {
  if (!canUseWorker()) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./image-processor.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const job = pending.get(message.id)
      if (!job) return
      if (message.type === 'progress') {
        const previous = lastProgressAt.get(message.id)
        const now = performance.now()
        const percent = message.progress.progress
        const jumped = previous == null
          || previous.percent == null
          || percent == null
          || Math.abs(percent - previous.percent) >= 1
        if (!jumped && now - previous.at < PROGRESS_INTERVAL_MS) return
        lastProgressAt.set(message.id, { at: now, percent: percent ?? previous?.percent ?? null })
        job.onProgress?.(message.progress)
        return
      }
      pending.delete(message.id)
      lastProgressAt.delete(message.id)
      if (message.type === 'done') job.resolve(resultFromSerialized(message.result))
      else job.reject(new Error(message.message))
    }
    worker.onerror = () => {
      workerFailed = true
      failAll(new Error('Image processing worker failed.'))
      worker?.terminate()
      worker = null
    }
    return worker
  } catch {
    workerFailed = true
    worker = null
    return null
  }
}

function failAll(reason: Error): void {
  for (const job of pending.values()) job.reject(reason)
  pending.clear()
  lastProgressAt.clear()
}

async function serializeJob(job: ImageJob): Promise<SerializedImageJob> {
  if (job.op === 'compressPng') {
    return { op: 'compressPng', file: await blobToTransfer(job.file, 'source.png'), ...(job.mode ? { mode: job.mode } : {}) }
  }
  if (job.op === 'processImage') {
    return {
      op: 'processImage',
      file: await blobToTransfer(job.file),
      options: job.options,
      ...(job.optimize ? { optimize: job.optimize } : {}),
      ...(job.watermarkImage ? { watermarkImage: await blobToTransfer(job.watermarkImage, 'watermark') } : {}),
    }
  }
  if (job.op === 'mergePng') {
    return {
      op: 'mergePng',
      inputs: await Promise.all(job.inputs.map(async (input, index) => ({
        file: await blobToTransfer(input.file, `merge-${index}.png`),
        width: input.width,
        height: input.height,
      }))),
      options: job.options,
      background: job.background,
      ...(job.optimize ? { optimize: job.optimize } : {}),
    }
  }
  if (job.op === 'renderMeme') {
    return {
      op: 'renderMeme',
      file: await blobToTransfer(job.file),
      layers: [...job.layers],
      format: job.format,
      ...(job.quality === undefined ? {} : { quality: job.quality }),
      ...(job.optimize ? { optimize: job.optimize } : {}),
    }
  }
  return {
    op: 'exportProcessed',
    file: await blobToTransfer(job.file),
    draw: job.draw,
    mime: job.mime,
    ...(job.quality === undefined ? {} : { quality: job.quality }),
    ...(job.optimize ? { optimize: job.optimize } : {}),
  }
}

function throttleProgress(onProgress?: (progress: ProcessingProgress) => void) {
  if (!onProgress) return undefined
  let lastAt = 0
  let lastPercent: number | null = null
  return (progress: ProcessingProgress) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const percent = progress.progress
    const jumped = lastPercent == null || percent == null || Math.abs(percent - lastPercent) >= 1
    if (!jumped && now - lastAt < PROGRESS_INTERVAL_MS) return
    lastAt = now
    lastPercent = percent ?? lastPercent
    onProgress(progress)
  }
}

export async function runImageJob(
  job: ImageJob,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal,
): Promise<ImageJobResult> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const report = throttleProgress(onProgress)
  const host = ensureWorker()
  if (!host) return executeImageJob(job, report)
  const id = nextId
  nextId += 1
  const serialized = await serializeJob(job)
  return new Promise((resolve, reject) => {
    const abort = () => {
      pending.delete(id)
      lastProgressAt.delete(id)
      host.postMessage({ type: 'cancel', id } satisfies WorkerRequest)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    pending.set(id, {
      id,
      resolve: (result) => {
        signal?.removeEventListener('abort', abort)
        resolve(result)
      },
      reject: (reason) => {
        signal?.removeEventListener('abort', abort)
        reject(reason)
      },
      ...(report ? { onProgress: report } : {}),
    })
    host.postMessage({ type: 'job', id, job: serialized } satisfies WorkerRequest, collectTransferables(serialized))
  })
}

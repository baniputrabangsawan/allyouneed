/// <reference lib="webworker" />

import { executeImageJob } from './image-jobs'
import {
  fileFromTransfer,
  type ImageJob,
  type SerializedImageJob,
  type WorkerRequest,
  type WorkerResponse,
} from './image-processor-protocol'

const worker = self as unknown as DedicatedWorkerGlobalScope
let currentId: number | null = null
let cancelled = false

worker.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (message.type === 'cancel') {
    if (currentId === message.id) cancelled = true
    return
  }
  void run(message.id, message.job)
}

async function run(id: number, serialized: SerializedImageJob): Promise<void> {
  currentId = id
  cancelled = false
  try {
    const result = await executeImageJob(hydrateJob(serialized), (progress) => {
      if (cancelled || currentId !== id) return
      post({ type: 'progress', id, progress })
    })
    if (cancelled || currentId !== id) return
    const buffer = await result.blob.arrayBuffer()
    post({
      type: 'done',
      id,
      result: {
        buffer,
        mime: result.mime,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savedBytes: result.savedBytes,
        savedRatio: result.savedRatio,
        recommendWebp: result.recommendWebp,
        ...(result.width != null ? { width: result.width } : {}),
        ...(result.height != null ? { height: result.height } : {}),
        ...(result.quantized != null ? { quantized: result.quantized } : {}),
      },
    }, [buffer])
  } catch (reason) {
    if (cancelled || currentId !== id) return
    post({
      type: 'error',
      id,
      message: reason instanceof Error ? reason.message : 'Image processing failed.',
    })
  } finally {
    if (currentId === id) currentId = null
  }
}

function hydrateJob(job: SerializedImageJob): ImageJob {
  if (job.op === 'compressPng') {
    return { op: 'compressPng', file: fileFromTransfer(job.file), ...(job.mode ? { mode: job.mode } : {}) }
  }
  if (job.op === 'processImage') {
    return {
      op: 'processImage',
      file: fileFromTransfer(job.file),
      options: job.options,
      ...(job.optimize ? { optimize: job.optimize } : {}),
      ...(job.watermarkImage ? { watermarkImage: fileFromTransfer(job.watermarkImage) } : {}),
    }
  }
  if (job.op === 'mergePng') {
    return {
      op: 'mergePng',
      inputs: job.inputs.map((input) => ({
        file: fileFromTransfer(input.file),
        width: input.width,
        height: input.height,
      })),
      options: job.options,
      background: job.background,
      ...(job.optimize ? { optimize: job.optimize } : {}),
    }
  }
  if (job.op === 'renderMeme') {
    return {
      op: 'renderMeme',
      file: fileFromTransfer(job.file),
      layers: job.layers,
      format: job.format,
      ...(job.quality === undefined ? {} : { quality: job.quality }),
      ...(job.optimize ? { optimize: job.optimize } : {}),
    }
  }
  return {
    op: 'exportProcessed',
    file: fileFromTransfer(job.file),
    draw: job.draw,
    mime: job.mime,
    ...(job.quality === undefined ? {} : { quality: job.quality }),
    ...(job.optimize ? { optimize: job.optimize } : {}),
  }
}

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer)
}

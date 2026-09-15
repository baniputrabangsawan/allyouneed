import { supportsWebWorkers } from '@/lib/browser-capabilities'
import { yieldToUi } from './process-stage'
import { diffJsonText, JSON_YIELD_THRESHOLD } from './json-diff'
import type { JsonDiffOptions, JsonDiffResult } from './json-diff'
import type { JsonDiffWorkerRequest, JsonDiffWorkerResponse } from './json-diff-protocol'

interface PendingDiff {
  resolve: (result: JsonDiffResult) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let workerFailed = false
let nextId = 1
const pending = new Map<number, PendingDiff>()

export async function runJsonDiff(
  left: string,
  right: string,
  options: JsonDiffOptions = {},
  signal?: AbortSignal,
): Promise<JsonDiffResult> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const ignoreKeyOrder = options.ignoreKeyOrder !== false
  const large = left.length + right.length >= JSON_YIELD_THRESHOLD
  const hosted = large ? ensureWorker() : null
  if (!hosted) {
    if (large) await yieldToUi()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return diffJsonText(left, right, { ignoreKeyOrder })
  }

  const id = nextId
  nextId += 1
  return new Promise<JsonDiffResult>((resolve, reject) => {
    const abort = () => {
      pending.delete(id)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    pending.set(id, {
      resolve: (result) => {
        signal?.removeEventListener('abort', abort)
        resolve(result)
      },
      reject: (reason) => {
        signal?.removeEventListener('abort', abort)
        reject(reason)
      },
    })
    const request: JsonDiffWorkerRequest = { id, type: 'diff', left, right, ignoreKeyOrder }
    hosted.postMessage(request)
  })
}

function canUseWorker(): boolean {
  return !workerFailed && typeof window !== 'undefined' && supportsWebWorkers()
}

function ensureWorker(): Worker | null {
  if (!canUseWorker()) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./json-diff.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<JsonDiffWorkerResponse>) => {
      const message = event.data
      const job = pending.get(message.id)
      if (!job) return
      pending.delete(message.id)
      if (message.type === 'done') job.resolve(message.result)
      else job.reject(new Error(message.message))
    }
    worker.onerror = () => {
      workerFailed = true
      failAll(new Error('JSON diff worker failed.'))
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
}

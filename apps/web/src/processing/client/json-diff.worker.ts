/// <reference lib="webworker" />

import { diffJsonText } from './json-diff'
import type { JsonDiffWorkerRequest, JsonDiffWorkerResponse } from './json-diff-protocol'

const worker = self as unknown as DedicatedWorkerGlobalScope

worker.onmessage = (event: MessageEvent<JsonDiffWorkerRequest>) => {
  const message = event.data
  if (message.type !== 'diff') return
  try {
    const result = diffJsonText(message.left, message.right, { ignoreKeyOrder: message.ignoreKeyOrder })
    post({ id: message.id, type: 'done', result })
  } catch (reason) {
    post({
      id: message.id,
      type: 'error',
      message: reason instanceof Error ? reason.message : 'JSON diff failed.',
    })
  }
}

function post(message: JsonDiffWorkerResponse): void {
  worker.postMessage(message)
}

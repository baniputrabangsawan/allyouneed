import type { JsonDiffResult } from './json-diff'

export type JsonDiffWorkerRequest = {
  id: number
  type: 'diff'
  left: string
  right: string
  ignoreKeyOrder: boolean
}

export type JsonDiffWorkerResponse =
  | { id: number; type: 'done'; result: JsonDiffResult }
  | { id: number; type: 'error'; message: string }

export const JSON_MAX_CHARS = 2_000_000
export const JSON_YIELD_THRESHOLD = 80_000
export const JSON_MAX_ENTRIES = 10_000
const VALUE_PREVIEW_CHARS = 8_000

export type JsonDiffKind = 'added' | 'removed' | 'changed' | 'unchanged'

export interface JsonDiffEntry {
  path: string
  kind: JsonDiffKind
  left?: string
  right?: string
}

export interface JsonDiffCounts {
  added: number
  removed: number
  changed: number
  unchanged: number
}

export interface JsonDiffResult {
  entries: JsonDiffEntry[]
  counts: JsonDiffCounts
  truncated: boolean
  leftError?: string
  rightError?: string
}

export interface JsonDiffOptions {
  ignoreKeyOrder?: boolean
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u

export function formatJsonPath(parts: ReadonlyArray<string | number>): string {
  if (parts.length === 0) return '(root)'
  let out = ''
  for (const part of parts) {
    if (typeof part === 'number') {
      out += `[${part}]`
      continue
    }
    if (IDENTIFIER.test(part)) {
      out = out ? `${out}.${part}` : part
      continue
    }
    out += `[${JSON.stringify(part)}]`
  }
  return out
}

export function formatJson(input: string): string {
  if (input.length > JSON_MAX_CHARS) {
    throw new Error(`JSON is too large. Maximum is ${JSON_MAX_CHARS.toLocaleString()} characters.`)
  }
  return JSON.stringify(JSON.parse(input), null, 2)
}

export function diffJsonText(leftText: string, rightText: string, options: JsonDiffOptions = {}): JsonDiffResult {
  const ignoreKeyOrder = options.ignoreKeyOrder !== false
  const leftEmpty = leftText.trim() === ''
  const rightEmpty = rightText.trim() === ''
  if (leftEmpty && rightEmpty) return emptyResult()

  const left = parseSide(leftText, 'JSON A')
  const right = parseSide(rightText, 'JSON B')
  if (left.error || right.error) {
    return {
      ...emptyResult(),
      ...(left.error ? { leftError: left.error } : {}),
      ...(right.error ? { rightError: right.error } : {}),
    }
  }

  const entries: JsonDiffEntry[] = []
  const state = { truncated: false }
  walk(left.value, right.value, [], ignoreKeyOrder, entries, state)
  return {
    entries,
    counts: countEntries(entries),
    truncated: state.truncated,
  }
}

export function formatDiffReport(result: JsonDiffResult): string {
  if (result.leftError || result.rightError) {
    return [result.leftError, result.rightError].filter(Boolean).join('\n')
  }
  const { added, removed, changed, unchanged } = result.counts
  if (result.entries.length === 0) return ''
  if (added + removed + changed === 0) return 'JSON A and JSON B are identical.'
  const lines = [
    `${added} added, ${removed} removed, ${changed} changed, ${unchanged} unchanged${result.truncated ? ' (truncated)' : ''}`,
    ...result.entries.map(formatReportLine),
  ]
  return lines.join('\n')
}

function formatReportLine(entry: JsonDiffEntry): string {
  if (entry.kind === 'added') return `+ Added     ${entry.path}  ${entry.right ?? ''}`
  if (entry.kind === 'removed') return `- Removed   ${entry.path}  ${entry.left ?? ''}`
  if (entry.kind === 'changed') return `~ Changed   ${entry.path}  ${entry.left ?? ''} → ${entry.right ?? ''}`
  return `  Unchanged ${entry.path}  ${entry.left ?? entry.right ?? ''}`
}

function emptyResult(): JsonDiffResult {
  return {
    entries: [],
    counts: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    truncated: false,
  }
}

function parseSide(text: string, label: string): { value?: unknown; error?: string } {
  if (text.trim() === '') return { error: `${label} is empty.` }
  if (text.length > JSON_MAX_CHARS) {
    return { error: `${label} is too large. Maximum is ${JSON_MAX_CHARS.toLocaleString()} characters.` }
  }
  try {
    return { value: JSON.parse(text) as unknown }
  } catch (reason) {
    return { error: reason instanceof SyntaxError ? reason.message : `${label} is not valid JSON.` }
  }
}

function walk(
  left: unknown,
  right: unknown,
  path: Array<string | number>,
  ignoreKeyOrder: boolean,
  out: JsonDiffEntry[],
  state: { truncated: boolean },
): void {
  if (state.truncated) return
  if (jsonEqual(left, right, ignoreKeyOrder)) {
    push(out, { path: formatJsonPath(path), kind: 'unchanged', left: previewValue(left), right: previewValue(right) }, state)
    return
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    diffObjects(left, right, path, ignoreKeyOrder, out, state)
    return
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    diffArrays(left, right, path, ignoreKeyOrder, out, state)
    return
  }
  push(out, { path: formatJsonPath(path), kind: 'changed', left: previewValue(left), right: previewValue(right) }, state)
}

function diffObjects(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  path: Array<string | number>,
  ignoreKeyOrder: boolean,
  out: JsonDiffEntry[],
  state: { truncated: boolean },
): void {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  const leftSet = new Set(leftKeys)
  const orderChanged = !ignoreKeyOrder
    && leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key))
    && leftKeys.some((key, index) => key !== rightKeys[index])
  if (orderChanged) {
    push(out, {
      path: formatJsonPath(path),
      kind: 'changed',
      left: previewValue(leftKeys),
      right: previewValue(rightKeys),
    }, state)
  }
  const keys = ignoreKeyOrder
    ? [...new Set([...leftKeys, ...rightKeys])].sort()
    : [...leftKeys, ...rightKeys.filter((key) => !leftSet.has(key))]
  for (const key of keys) {
    if (state.truncated) return
    const hasLeft = Object.hasOwn(left, key)
    const hasRight = Object.hasOwn(right, key)
    const nextPath = [...path, key]
    if (!hasLeft) {
      push(out, { path: formatJsonPath(nextPath), kind: 'added', right: previewValue(right[key]) }, state)
      continue
    }
    if (!hasRight) {
      push(out, { path: formatJsonPath(nextPath), kind: 'removed', left: previewValue(left[key]) }, state)
      continue
    }
    walk(left[key], right[key], nextPath, ignoreKeyOrder, out, state)
  }
}

function diffArrays(
  left: unknown[],
  right: unknown[],
  path: Array<string | number>,
  ignoreKeyOrder: boolean,
  out: JsonDiffEntry[],
  state: { truncated: boolean },
): void {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (state.truncated) return
    const nextPath = [...path, index]
    if (index >= left.length) {
      push(out, { path: formatJsonPath(nextPath), kind: 'added', right: previewValue(right[index]) }, state)
      continue
    }
    if (index >= right.length) {
      push(out, { path: formatJsonPath(nextPath), kind: 'removed', left: previewValue(left[index]) }, state)
      continue
    }
    walk(left[index], right[index], nextPath, ignoreKeyOrder, out, state)
  }
}

function jsonEqual(left: unknown, right: unknown, ignoreKeyOrder: boolean): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => jsonEqual(item, right[index], ignoreKeyOrder))
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false
    if (!ignoreKeyOrder && leftKeys.some((key, index) => key !== rightKeys[index])) return false
    return leftKeys.every((key) => Object.hasOwn(right, key) && jsonEqual(left[key], right[key], ignoreKeyOrder))
  }
  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function previewValue(value: unknown): string {
  const text = JSON.stringify(value)
  if (text.length <= VALUE_PREVIEW_CHARS) return text
  return `${text.slice(0, VALUE_PREVIEW_CHARS)}…`
}

function push(out: JsonDiffEntry[], entry: JsonDiffEntry, state: { truncated: boolean }): void {
  if (out.length >= JSON_MAX_ENTRIES) {
    state.truncated = true
    return
  }
  out.push(entry)
}

function countEntries(entries: readonly JsonDiffEntry[]): JsonDiffCounts {
  const counts: JsonDiffCounts = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  for (const entry of entries) counts[entry.kind] += 1
  return counts
}

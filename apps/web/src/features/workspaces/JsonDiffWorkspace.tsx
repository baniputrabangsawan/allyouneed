import { useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { formatDiffReport, formatJson } from '@/processing/client/json-diff'
import type { JsonDiffKind, JsonDiffResult } from '@/processing/client/json-diff'
import { runJsonDiff } from '@/processing/client/run-json-diff'
import { CopyButton } from './workspace-ui'

type ResultFilter = 'changes' | 'all' | JsonDiffKind

const KIND_MARK: Record<JsonDiffKind, string> = {
  added: '+',
  removed: '−',
  changed: '~',
  unchanged: '',
}

const KIND_LABEL: Record<JsonDiffKind, string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
}

const DISPLAY_LIMIT = 2000
const emptyDiff: JsonDiffResult = {
  entries: [],
  counts: { added: 0, removed: 0, changed: 0, unchanged: 0 },
  truncated: false,
}

export function JsonDiffWorkspace({ tool }: { tool: ToolDefinition }) {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(true)
  const [result, setResult] = useState<JsonDiffResult>(emptyDiff)
  const [filter, setFilter] = useState<ResultFilter>('changes')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void compare(left, right, ignoreKeyOrder, controller.signal)
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [left, right, ignoreKeyOrder])

  async function compare(nextLeft: string, nextRight: string, nextIgnore: boolean, signal: AbortSignal) {
    if (nextLeft.trim() === '' && nextRight.trim() === '') {
      setResult(emptyDiff)
      setBusy(false)
      return
    }
    setBusy(true)
    try {
      const next = await runJsonDiff(nextLeft, nextRight, { ignoreKeyOrder: nextIgnore }, signal)
      if (signal.aborted) return
      setResult(next)
    } catch (reason) {
      if (signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
      setResult({
        ...emptyDiff,
        leftError: reason instanceof Error ? reason.message : 'The JSON could not be compared.',
      })
    } finally {
      if (!signal.aborted) setBusy(false)
    }
  }

  function formatBoth() {
    setLeft(tryFormat(left))
    setRight(tryFormat(right))
  }

  function swap() {
    setLeft(right)
    setRight(left)
  }

  function clear() {
    setLeft('')
    setRight('')
    setResult(emptyDiff)
  }

  const changeCount = result.counts.added + result.counts.removed + result.counts.changed
  const visible = useMemo(() => {
    if (filter === 'all') return result.entries
    if (filter === 'changes') return result.entries.filter((entry) => entry.kind !== 'unchanged')
    return result.entries.filter((entry) => entry.kind === filter)
  }, [filter, result.entries])
  const shown = visible.slice(0, DISPLAY_LIMIT)
  const copyValue = formatDiffReport(result)
  const idle = left.trim() === '' && right.trim() === ''
  const invalid = Boolean(result.leftError || result.rightError)

  return (
    <section className="workspace json-diff-workspace" aria-label={tool.name} aria-busy={busy}>
      <div className="editor-grid">
        <label>
          <span>JSON A</span>
          <textarea
            aria-label="JSON A"
            aria-invalid={Boolean(result.leftError)}
            aria-describedby={result.leftError ? 'json-diff-a-error' : undefined}
            spellCheck={false}
            value={left}
            onChange={(event) => setLeft(event.target.value)}
          />
        </label>
        <label>
          <span>JSON B</span>
          <textarea
            aria-label="JSON B"
            aria-invalid={Boolean(result.rightError)}
            aria-describedby={result.rightError ? 'json-diff-b-error' : undefined}
            spellCheck={false}
            value={right}
            onChange={(event) => setRight(event.target.value)}
          />
        </label>
      </div>
      {result.leftError ? <p id="json-diff-a-error" className="field-error" role="alert">JSON A: {result.leftError}</p> : null}
      {result.rightError ? <p id="json-diff-b-error" className="field-error" role="alert">JSON B: {result.rightError}</p> : null}

      <div className="button-row">
        <button className="button secondary" type="button" disabled={idle} onClick={swap}>Swap A/B</button>
        <button className="button secondary" type="button" disabled={idle || busy} onClick={formatBoth}>Format Both</button>
        <CopyButton value={copyValue} label="Copy Diff" />
        <button className="button secondary" type="button" disabled={idle && !invalid} onClick={clear}>Clear</button>
      </div>

      <label className="json-diff-option">
        <input
          type="checkbox"
          checked={ignoreKeyOrder}
          onChange={(event) => setIgnoreKeyOrder(event.target.checked)}
        />
        Ignore object key order
      </label>
      <p className="option-help">Array order stays meaningful. Object keys are matched by name{ignoreKeyOrder ? ', not insertion order.' : ', and key-order changes are reported.'}</p>

      <div className="json-diff-results">
        <div className="panel-label">
          <span>Diff Results</span>
          <span aria-live="polite">
            {busy ? 'Comparing…' : idle ? 'Paste JSON A and JSON B' : invalid ? 'Fix JSON to compare' : summaryText(result, changeCount)}
          </span>
        </div>
        {!idle && !invalid && !busy ? (
          <>
            <div className="segmented json-diff-filters" role="radiogroup" aria-label="Diff filter">
              {filterButton('changes', 'Changes', filter, setFilter, changeCount)}
              {filterButton('added', 'Added', filter, setFilter, result.counts.added)}
              {filterButton('removed', 'Removed', filter, setFilter, result.counts.removed)}
              {filterButton('changed', 'Changed', filter, setFilter, result.counts.changed)}
              {filterButton('unchanged', 'Unchanged', filter, setFilter, result.counts.unchanged)}
              {filterButton('all', 'All', filter, setFilter, result.entries.length)}
            </div>
            {changeCount === 0 ? (
              <p className="json-diff-identical" role="status">JSON A and JSON B are identical.</p>
            ) : null}
            {shown.length > 0 ? (
              <ul className="json-diff-list">
                {shown.map((entry, index) => (
                  <li key={`${entry.kind}:${entry.path}:${index}`} className={`json-diff-row is-${entry.kind}`}>
                    <span className="json-diff-status">
                      <span aria-hidden="true">{KIND_MARK[entry.kind]}</span>
                      {KIND_LABEL[entry.kind]}
                    </span>
                    <code className="json-diff-path">{entry.path}</code>
                    <span className="json-diff-values">
                      {entry.kind === 'changed' ? `${entry.left ?? ''} → ${entry.right ?? ''}` : entry.right ?? entry.left ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {visible.length > DISPLAY_LIMIT ? (
              <p className="option-help">Showing {DISPLAY_LIMIT.toLocaleString()} of {visible.length.toLocaleString()} rows.</p>
            ) : null}
            {result.truncated ? (
              <p className="option-help">Diff stopped after {result.entries.length.toLocaleString()} changes to keep the browser responsive.</p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}

function tryFormat(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return formatJson(value)
  } catch {
    return value
  }
}

function summaryText(result: JsonDiffResult, changeCount: number) {
  const { added, removed, changed, unchanged } = result.counts
  if (changeCount === 0) return `${unchanged} unchanged`
  return `${added} added · ${removed} removed · ${changed} changed · ${unchanged} unchanged`
}

function filterButton(
  value: ResultFilter,
  label: string,
  current: ResultFilter,
  setFilter: (value: ResultFilter) => void,
  count: number,
) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={current === value}
      className={current === value ? 'active' : ''}
      onClick={() => setFilter(value)}
    >
      {label} {count}
    </button>
  )
}

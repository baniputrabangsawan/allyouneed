import { useMemo, useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import {
  formatRegexLiteral,
  highlightSegments,
  REGEX_FLAGS,
  SAMPLE_PATTERNS,
  testRegex,
  type RegexFlag,
} from '@/processing/client/regex-tester'
import { CopyButton } from './workspace-ui'

const DISPLAY_LIMIT = 200
const DEFAULT_FLAGS: RegexFlag[] = ['g']

export function RegexTesterWorkspace({ tool }: { tool: ToolDefinition }) {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<RegexFlag[]>(DEFAULT_FLAGS)
  const [text, setText] = useState('')

  const flagString = flags.join('')
  const result = useMemo(() => testRegex(pattern, flagString, text), [pattern, flagString, text])
  const highlight = useMemo(() => {
    if (!result.ok || !text) return null
    return highlightSegments(text, result.matches)
  }, [result, text])
  const shown = result.ok ? result.matches.slice(0, DISPLAY_LIMIT) : []
  const idle = pattern === '' && text === ''
  const copyValue = result.ok && pattern ? formatRegexLiteral(pattern, flagString) : ''

  function toggleFlag(flag: RegexFlag) {
    setFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag])
  }

  function clear() {
    setPattern('')
    setFlags(DEFAULT_FLAGS)
    setText('')
  }

  return (
    <section className="workspace regex-tester-workspace" aria-label={tool.name}>
      <label className="field">
        <span>Regular Expression</span>
        <input
          aria-label="Regular Expression"
          aria-invalid={result.ok ? undefined : true}
          aria-describedby={result.ok ? undefined : 'regex-tester-error'}
          spellCheck={false}
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder="e.g. \\d+"
        />
      </label>

      <fieldset className="regex-flags">
        <legend>Flags</legend>
        {REGEX_FLAGS.map((flag) => (
          <label key={flag} className="regex-flag">
            <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
            {flag}
          </label>
        ))}
      </fieldset>

      <label className="counter-editor">
        <span>Test Text</span>
        <textarea aria-label="Test Text" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} />
      </label>

      <div className="regex-samples" role="group" aria-label="Sample patterns">
        {SAMPLE_PATTERNS.map((sample) => (
          <button
            key={sample.id}
            className="button secondary"
            type="button"
            onClick={() => {
              setPattern(sample.pattern)
              setFlags(sample.flags.split('') as RegexFlag[])
            }}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <p className="option-help">Sample patterns are generic examples, not universal validation guarantees.</p>

      {!result.ok ? <p id="regex-tester-error" className="field-error" role="alert">{result.error}</p> : null}

      <div className="button-row">
        <CopyButton value={copyValue} label="Copy Regex" />
        <button className="button secondary" type="button" disabled={idle} onClick={clear}>Clear</button>
      </div>

      {result.ok ? (
        <div className="regex-results">
          <div className="panel-label">
            <span>Matches</span>
            <span aria-live="polite">{matchSummary(result.matches.length, result.truncated, result.textTruncated)}</span>
          </div>

          {text && highlight ? (
            <pre className="regex-highlight" aria-label="Highlighted matches">
              {highlight.segments.map((segment, index) => (
                segment.matched
                  ? <mark key={index}>{segment.text}</mark>
                  : <span key={index}>{segment.text}</span>
              ))}
              {highlight.truncated ? <span className="regex-truncated">…</span> : null}
            </pre>
          ) : null}

          {shown.length ? (
            <ol className="regex-match-list">
              {shown.map((match, index) => (
                <li key={`${match.index}-${index}`} className="regex-match-row">
                  <span className="regex-match-index">index {match.index}</span>
                  <code className="regex-match-full">{match.match || '(empty)'}</code>
                  {match.groups.length ? (
                    <span className="regex-match-groups">
                      {match.groups.map((group, groupIndex) => (
                        <span key={groupIndex}>${groupIndex + 1}: {group || '(empty)'}</span>
                      ))}
                      {match.namedGroups
                        ? Object.entries(match.namedGroups).map(([name, value]) => (
                          <span key={name}>${name}: {value || '(empty)'}</span>
                        ))
                        : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="option-help">{idle ? 'Enter a pattern and test text.' : 'No matches.'}</p>
          )}
          {result.truncated || shown.length < result.matches.length ? (
            <p className="option-help">Showing {shown.length} of {result.truncated ? `${result.matches.length}+` : result.matches.length} matches.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function matchSummary(count: number, truncated: boolean, textTruncated: boolean): string {
  const label = `${count}${truncated ? '+' : ''} match${count === 1 && !truncated ? '' : 'es'}`
  return textTruncated ? `${label} (text truncated)` : label
}

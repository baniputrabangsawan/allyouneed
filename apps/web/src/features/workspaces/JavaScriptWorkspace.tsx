import { useState } from 'react'
import {
  DEFAULT_JS_FORMAT_OPTIONS,
  formatJavaScript,
  JS_YIELD_THRESHOLD,
  yieldToMain,
  type JsFormatOptions,
  type JsTabWidth,
  type JsTrailingComma,
} from './javascript-utils'
import { CopyButton, TextPanels } from './workspace-ui'

export function JavaScriptWorkspace() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [semi, setSemi] = useState(DEFAULT_JS_FORMAT_OPTIONS.semi)
  const [singleQuote, setSingleQuote] = useState(DEFAULT_JS_FORMAT_OPTIONS.singleQuote)
  const [tabWidth, setTabWidth] = useState<JsTabWidth>(DEFAULT_JS_FORMAT_OPTIONS.tabWidth)
  const [trailingComma, setTrailingComma] = useState<JsTrailingComma>(DEFAULT_JS_FORMAT_OPTIONS.trailingComma)
  const [busy, setBusy] = useState(false)

  async function format() {
    if (busy) return
    setBusy(true)
    setError('')
    const snapshot = input
    const options: JsFormatOptions = { semi, singleQuote, tabWidth, trailingComma }
    try {
      if (snapshot.length >= JS_YIELD_THRESHOLD) await yieldToMain()
      setOutput(await formatJavaScript(snapshot, options))
      setError('')
    } catch (reason) {
      setOutput('')
      setError(reason instanceof Error ? reason.message : 'The JavaScript could not be formatted.')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setInput('')
    setOutput('')
    setError('')
  }

  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="JavaScript input" outputLabel="JavaScript result" error={error}>
    <label>Semicolons <select aria-label="Semicolons" value={semi ? 'on' : 'off'} disabled={busy} onChange={(event) => setSemi(event.target.value === 'on')}>
      <option value="on">On</option>
      <option value="off">Off</option>
    </select></label>
    <label>Quotes <select aria-label="Quotes" value={singleQuote ? 'single' : 'double'} disabled={busy} onChange={(event) => setSingleQuote(event.target.value === 'single')}>
      <option value="double">Double</option>
      <option value="single">Single</option>
    </select></label>
    <label>Tab width <select aria-label="Tab width" value={String(tabWidth)} disabled={busy} onChange={(event) => setTabWidth(Number(event.target.value) as JsTabWidth)}>
      <option value="2">2 spaces</option>
      <option value="4">4 spaces</option>
    </select></label>
    <label>Trailing commas <select aria-label="Trailing commas" value={trailingComma} disabled={busy} onChange={(event) => setTrailingComma(event.target.value as JsTrailingComma)}>
      <option value="all">All</option>
      <option value="es5">ES5</option>
      <option value="none">None</option>
    </select></label>
    <button className="button primary" type="button" disabled={busy} onClick={() => void format()}>{busy ? 'Formatting…' : 'Format'}</button>
    <CopyButton value={output}/>
    <button className="button secondary" type="button" disabled={busy} onClick={clear}>Clear</button>
  </TextPanels>
}

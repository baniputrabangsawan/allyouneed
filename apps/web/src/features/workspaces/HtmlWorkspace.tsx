import { useState } from 'react'
import {
  DEFAULT_HTML_FORMAT_OPTIONS,
  HTML_YIELD_THRESHOLD,
  processHtml,
  yieldToMain,
  type HtmlAction,
  type HtmlIndent,
} from './html-utils'
import { CopyButton, TextPanels } from './workspace-ui'

export function HtmlWorkspace() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState<HtmlIndent>(DEFAULT_HTML_FORMAT_OPTIONS.indent)
  const [printWidth, setPrintWidth] = useState(DEFAULT_HTML_FORMAT_OPTIONS.printWidth)
  const [busy, setBusy] = useState(false)

  async function run(action: HtmlAction) {
    if (busy) return
    setBusy(true)
    setError('')
    const snapshot = input
    const options = { indent, printWidth }
    try {
      if (snapshot.length >= HTML_YIELD_THRESHOLD) await yieldToMain()
      setOutput(await processHtml(snapshot, action, options))
      setError('')
    } catch (reason) {
      setOutput('')
      setError(reason instanceof Error ? reason.message : 'The HTML could not be processed.')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setInput('')
    setOutput('')
    setError('')
  }

  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="HTML input" outputLabel="HTML result" error={error}>
    <label>Indent <select aria-label="Indentation" value={indent} disabled={busy} onChange={(event) => setIndent(event.target.value as HtmlIndent)}>
      <option value="2">2 spaces</option>
      <option value="4">4 spaces</option>
      <option value="tab">Tabs</option>
    </select></label>
    <label>Print width <input aria-label="Print width" type="number" min={1} max={1000} value={printWidth} disabled={busy} onChange={(event) => setPrintWidth(Number(event.target.value))}/></label>
    <button className="button primary" type="button" disabled={busy} onClick={() => void run('format')}>{busy ? 'Working…' : 'Format'}</button>
    <button className="button secondary" type="button" disabled={busy} onClick={() => void run('minify')}>Minify</button>
    <CopyButton value={output}/>
    <button className="button secondary" type="button" disabled={busy} onClick={clear}>Clear</button>
  </TextPanels>
}

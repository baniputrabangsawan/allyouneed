import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, TextPanels } from './workspace-ui'
import {
  processXml, XML_YIELD_THRESHOLD, yieldToMain,
  type XmlAction, type XmlIndent,
} from './xml-utils'

export function XmlWorkspace({ tool }: { tool: ToolDefinition }) {
  void tool
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState<XmlIndent>('2')
  const [busy, setBusy] = useState(false)

  async function run(action: XmlAction) {
    if (busy) return
    setBusy(true)
    setError('')
    const snapshot = input
    const snapshotIndent = indent
    try {
      if (snapshot.length >= XML_YIELD_THRESHOLD) await yieldToMain()
      setOutput(processXml(snapshot, action, snapshotIndent))
      setError('')
    } catch (reason) {
      setOutput('')
      setError(reason instanceof Error ? reason.message : 'The XML could not be processed.')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setInput('')
    setOutput('')
    setError('')
  }

  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="XML input" outputLabel="XML result" error={error}>
    <label>Indent <select aria-label="Indentation" value={indent} disabled={busy} onChange={(event) => setIndent(event.target.value as XmlIndent)}>
      <option value="2">2 spaces</option>
      <option value="4">4 spaces</option>
      <option value="tab">Tabs</option>
    </select></label>
    <button className="button primary" type="button" disabled={busy} onClick={() => void run('format')}>{busy ? 'Working…' : 'Format / Pretty Print'}</button>
    <button className="button secondary" type="button" disabled={busy} onClick={() => void run('minify')}>Minify</button>
    <button className="button secondary" type="button" disabled={busy} onClick={() => void run('validate')}>Validate</button>
    <CopyButton value={output}/>
    <button className="button secondary" type="button" disabled={busy} onClick={clear}>Clear</button>
  </TextPanels>
}

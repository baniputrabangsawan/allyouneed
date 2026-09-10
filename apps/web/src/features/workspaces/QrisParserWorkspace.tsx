import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { parseQris, type QrisParseResult } from './focused-workspace-utils'

export function QrisParserWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<QrisParseResult>()
  const [error, setError] = useState('')
  function parse() {
    try { setResult(parseQris(input)); setError('') }
    catch (reason) { setResult(undefined); setError(reason instanceof Error ? reason.message : 'The payload could not be parsed.') }
  }
  return <section className="workspace">
    <label className="counter-editor"><span>QRIS EMV payload</span><textarea aria-label="QRIS EMV payload" spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)}/></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="button-row"><button className="button primary" type="button" onClick={parse}>{tool.name}</button></div>
    {result && <div className="result-card" aria-live="polite">
      <p><strong>Checksum:</strong> {result.checksum}</p>
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th scope="col">Tag</th><th scope="col">Value</th></tr></thead><tbody>{result.tags.map(({ tag, value }, index) => <tr key={`${tag}-${index}`}><th scope="row">{tag}</th><td><code>{value}</code></td></tr>)}</tbody></table></div>
    </div>}
  </section>
}

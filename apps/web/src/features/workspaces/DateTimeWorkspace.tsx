import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, TextPanels } from './workspace-ui'

export function DateTimeWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)))
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  function convert() {
    const numeric = Number(input.trim())
    const date = Number.isFinite(numeric) ? new Date(numeric * (Math.abs(numeric) < 1e12 ? 1000 : 1)) : new Date(input)
    if (Number.isNaN(date.getTime())) { setError('Enter a Unix timestamp in seconds or milliseconds, or a valid date.'); setOutput(''); return }
    setOutput(`ISO: ${date.toISOString()}\nLocal: ${date.toLocaleString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix milliseconds: ${date.getTime()}`); setError('')
  }
  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="Timestamp or date" outputLabel="Converted date and timestamp" error={error}><button className="button primary" type="button" onClick={convert}>{tool.name}</button><button className="button secondary" type="button" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Use current time</button><CopyButton value={output}/></TextPanels>
}

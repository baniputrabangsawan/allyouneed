import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { secureRandomInt, secureString } from './workspace-utils'
import { CopyButton, DownloadButton } from './workspace-ui'

const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+='

export function RandomWorkspace({ tool }: { tool: ToolDefinition }) {
  const [length, setLength] = useState(tool.slug === 'pin-generator' ? 6 : 20)
  const [minimum, setMinimum] = useState(1)
  const [maximum, setMaximum] = useState(100)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  function generate() {
    try {
      const result = tool.slug === 'uuid-generator' ? crypto.randomUUID() : tool.slug === 'random-number-generator' ? String(secureRandomInt(minimum, maximum)) : tool.slug === 'pin-generator' ? secureString(length, '0123456789') : secureString(length, passwordAlphabet)
      setOutput(result); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Secure generation is unavailable.'); setOutput('') }
  }
  return <section className="workspace compact-workspace"><div className="options-panel">{tool.slug === 'random-number-generator' ? <div className="field-grid"><label className="field"><span>Minimum</span><input aria-label="Minimum" type="number" value={minimum} onChange={(event) => setMinimum(Number(event.target.value))}/></label><label className="field"><span>Maximum</span><input aria-label="Maximum" type="number" value={maximum} onChange={(event) => setMaximum(Number(event.target.value))}/></label></div> : tool.slug !== 'uuid-generator' && <label className="field"><span>Length</span><input aria-label="Length" type="number" min="1" max={tool.slug === 'pin-generator' ? 32 : 128} value={length} onChange={(event) => setLength(Number(event.target.value))}/></label>}<button className="button primary" type="button" onClick={generate}>Generate securely</button></div><div className="result-card"><p className="eyebrow">Web Crypto result</p><code>{output}</code>{error && <p className="field-error" role="alert">{error}</p>}<div className="button-row"><CopyButton value={output}/><DownloadButton value={output} filename={`${tool.slug}.txt`}/></div></div></section>
}

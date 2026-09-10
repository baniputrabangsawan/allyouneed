import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, DownloadButton, TextPanels } from './workspace-ui'

type HashAlgorithm = 'SHA-256' | 'SHA-512'

export function CryptoWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>(tool.slug === 'sha-512' ? 'SHA-512' : 'SHA-256')
  async function hash() {
    try {
      if (!crypto.subtle) throw new Error('Web Crypto hashing is unavailable in this browser context.')
      const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input))
      setOutput([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hashing failed.'); setOutput('') }
  }
  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="Text to hash" outputLabel={`${algorithm} digest`} error={error}>{tool.slug === 'hash-generator' && <label>Algorithm <select aria-label="Hash algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}><option>SHA-256</option><option>SHA-512</option></select></label>}<button className="button primary" type="button" onClick={() => void hash()}>Generate hash</button><CopyButton value={output}/><DownloadButton value={output} filename={`${algorithm.toLowerCase()}.txt`}/></TextPanels>
}

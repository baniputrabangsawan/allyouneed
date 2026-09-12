import { useEffect, useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { bytesToBase64, decodeBase64Text, decodeJwtPayload, encodeBase64Text } from './workspace-utils'
import { CopyButton, DownloadButton, TextPanels } from './workspace-ui'

export function EncodingWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('download.bin')
  const imageDecode = tool.slug === 'base64-to-image'
  const preview = imageDecode && /^data:image\/[a-z0-9.+-]+;base64,/i.test(output) ? output : ''
  useEffect(() => () => { setOutput('') }, [tool.slug])
  function run() {
    try {
      const result = tool.slug === 'url-encode' ? encodeURIComponent(input) : tool.slug === 'url-decode' ? decodeURIComponent(input) : tool.slug === 'base64-encode' ? encodeBase64Text(input) : tool.slug === 'base64-decode' ? decodeBase64Text(input) : tool.slug === 'jwt-decoder' ? decodeJwtPayload(input) : imageDecode ? normalizeImageDataUrl(input) : input
      setOutput(result); setError('')
    } catch (reason) { setOutput(''); setError(reason instanceof Error ? reason.message : 'The input could not be processed.') }
  }
  async function readFile(file: File | undefined) {
    if (!file) return
    try { setFileName(`${file.name}.base64.txt`); setOutput(`data:${file.type || 'application/octet-stream'};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`); setError('') }
    catch { setError('The selected file could not be read.'); setOutput('') }
  }
  if (tool.slug === 'image-to-base64') return <section className="workspace"><label className="field"><span>Image or file</span><input aria-label="Image or file" type="file" accept="image/*" onChange={(event) => void readFile(event.target.files?.[0])}/></label>{error && <p role="alert" className="field-error">{error}</p>}<label className="counter-editor"><span>Base64 data URL</span><textarea aria-label="Base64 data URL" readOnly value={output}/></label><div className="button-row"><CopyButton value={output}/><DownloadButton value={output} filename={fileName}/></div></section>
  return <TextPanels input={input} output={output} onInput={setInput} inputLabel={imageDecode ? 'Base64 image or data URL' : tool.slug === 'jwt-decoder' ? 'JWT' : 'Input'} outputLabel={imageDecode ? 'Normalized image data URL' : 'Result'} error={error}>
    {tool.slug === 'jwt-decoder' && <p role="note"><strong>Warning:</strong> This only decodes the payload. It does not verify the signature or prove the token is trustworthy.</p>}
    <button className="button primary" type="button" onClick={run}>{tool.name}</button><CopyButton value={output}/>{preview && <a className="button secondary" href={preview} download="decoded-image">Download image</a>}
    {preview && <img src={preview} alt="Decoded image preview" style={{ maxWidth: '100%', maxHeight: 320 }}/>} 
  </TextPanels>
}

function normalizeImageDataUrl(value: string): string {
  const trimmed = value.trim()
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed
  bytesToBase64(new Uint8Array(0)); atob(trimmed)
  return `data:image/png;base64,${trimmed}`
}

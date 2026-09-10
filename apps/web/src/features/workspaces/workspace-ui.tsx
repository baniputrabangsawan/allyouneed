import { useState, type ReactNode } from 'react'

export function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState('Copy')
  async function copy() {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setStatus('Copied'); window.setTimeout(() => setStatus('Copy'), 1500) }
    catch { setStatus('Copy failed') }
  }
  return <button className="button secondary" type="button" disabled={!value} onClick={copy}>{status}</button>
}

export function DownloadButton({ value, filename, type = 'text/plain' }: { value: string; filename: string; type?: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([value], { type }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
  }
  return <button className="button secondary" type="button" disabled={!value} onClick={download}>Download</button>
}

export function TextPanels({ input, output, onInput, second, onSecond, inputLabel = 'Input', outputLabel = 'Output', error, children }: { input: string; output: string; onInput: (value: string) => void; second?: string; onSecond?: (value: string) => void; inputLabel?: string; outputLabel?: string; error?: string; children: ReactNode }) {
  return <section className="workspace"><div className="editor-grid"><label><span>{inputLabel}</span><textarea aria-label={inputLabel} spellCheck={false} value={input} onChange={(event) => onInput(event.target.value)}/></label>{onSecond ? <label><span>Second text</span><textarea aria-label="Second text" spellCheck={false} value={second} onChange={(event) => onSecond(event.target.value)}/></label> : <label><span>{outputLabel}</span><textarea aria-label={outputLabel} readOnly value={output} placeholder="Your result appears here"/></label>}</div>{onSecond && <label className="counter-editor"><span>{outputLabel}</span><textarea aria-label={outputLabel} readOnly value={output}/></label>}{error && <p className="field-error" role="alert">{error}</p>}<div className="button-row">{children}</div></section>
}

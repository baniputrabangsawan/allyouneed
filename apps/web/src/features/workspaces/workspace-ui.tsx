import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/i18n'
import { downloadBlob } from '@/lib/media/download'

export function CopyButton({ value }: { value: string }) {
  const copy = useT()
  const [status, setStatus] = useState<string>(copy.workspace.copy)
  const resetTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resetTimer.current), [])
  async function onCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setStatus(copy.workspace.copied)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setStatus(copy.workspace.copy), 1500)
    } catch {
      setStatus(copy.workspace.copyFailed)
    }
  }
  return <button className="button secondary" type="button" disabled={!value} onClick={onCopy}>{status}</button>
}

export function DownloadButton({ value, filename, type = 'text/plain', label }: { value: string; filename: string; type?: string; label?: string }) {
  const copy = useT()
  function download() {
    downloadBlob(new Blob([value], { type }), filename)
  }
  return <button className="button secondary" type="button" disabled={!value} onClick={download}>{label ?? copy.workspace.download}</button>
}

export function TextPanels({ input, output, onInput, second, onSecond, inputLabel, outputLabel, error, children }: { input: string; output: string; onInput: (value: string) => void; second?: string; onSecond?: (value: string) => void; inputLabel?: string; outputLabel?: string; error?: string; children: ReactNode }) {
  const copy = useT()
  const inLabel = inputLabel ?? copy.workspace.input
  const outLabel = outputLabel ?? copy.workspace.output
  return <section className="workspace"><div className="editor-grid"><label><span>{inLabel}</span><textarea aria-label={inLabel} spellCheck={false} value={input} onChange={(event) => onInput(event.target.value)}/></label>{onSecond ? <label><span>{copy.workspace.secondText}</span><textarea aria-label={copy.workspace.secondText} spellCheck={false} value={second} onChange={(event) => onSecond(event.target.value)}/></label> : <label><span>{outLabel}</span><textarea aria-label={outLabel} readOnly value={output} placeholder={copy.workspace.resultPlaceholder}/></label>}</div>{onSecond && <label className="counter-editor"><span>{outLabel}</span><textarea aria-label={outLabel} readOnly value={output}/></label>}{error && <p className="field-error" role="alert">{error}</p>}<div className="button-row">{children}</div></section>
}

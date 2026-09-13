import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/i18n'
import { downloadBlob } from '@/lib/media/download'

export function CopyButton({ value, label, className, keepWidth }: { value: string; label?: string; className?: string; keepWidth?: boolean }) {
  const copy = useT()
  const idle = label ?? copy.workspace.copy
  const [status, setStatus] = useState(idle)
  const resetTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resetTimer.current), [])
  useEffect(() => { setStatus(idle) }, [idle])
  async function onCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setStatus(copy.workspace.copied)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setStatus(idle), 1500)
    } catch {
      setStatus(copy.workspace.copyFailed)
    }
  }
  return (
    <button className={['button', 'secondary', className].filter(Boolean).join(' ')} type="button" disabled={!value} aria-label={keepWidth ? status : undefined} onClick={onCopy}>
      {keepWidth ? (
        <span className="copy-button-label">
          <span>{idle}</span>
          <span>{copy.workspace.copied}</span>
          <span>{copy.workspace.copyFailed}</span>
          <span className="copy-button-status">{status}</span>
        </span>
      ) : status}
    </button>
  )
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

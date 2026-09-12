import { FileImage, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileDropzone } from '@/components/file/FileDropzone'
import { ProcessingProgressPanel } from '@/features/workspaces/processing-progress'
import { ImageResultPreview } from '@/features/image/ImageResultPreview'
import { formatBytes, outputFilename } from '@/lib/format'
import { parseSvgMarkup, svgToPng } from '@/processing/client/svg'
import { withProcessStages, type ProcessStage } from '@/processing/client/process-stage'
interface PngResult {
  blob: Blob
  url: string
  durationMs: number
  width: number
  height: number
}

const accept = ['image/svg+xml', '.svg'] as const

export function SvgToPngWorkspace() {
  const sourceUrlRef = useRef('')
  const resultUrlRef = useRef('')
  const selectionRef = useRef(0)
  const runningRef = useRef(false)
  const [processStage, setProcessStage] = useState<ProcessStage>('preparing')
  const [file, setFile] = useState<File | null>(null)
  const [markup, setMarkup] = useState('')
  const [draft, setDraft] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [result, setResult] = useState<PngResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState('')
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [width, setWidth] = useState(32)
  const [height, setHeight] = useState(32)
  const [scale, setScale] = useState(1)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [transparent, setTransparent] = useState(true)
  const [background, setBackground] = useState('#ffffff')

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
  }

  function resetSettings() {
    clearResult()
    setWidth(naturalWidth || 32)
    setHeight(naturalHeight || 32)
    setScale(1)
    setLockAspectRatio(true)
    setTransparent(true)
    setBackground('#ffffff')
    setStatus(file ? 'ready' : 'idle')
    setError('')
  }

  function removeFile() {
    selectionRef.current += 1
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = ''
    setSourceUrl('')
    setFile(null)
    setMarkup('')
    setWarnings([])
    setNaturalWidth(0)
    setNaturalHeight(0)
    setWidth(32)
    setHeight(32)
    setScale(1)
    clearResult()
    setStatus('idle')
    setError('')
  }

  async function chooseFile(next: File) {
    selectionRef.current += 1
    const selection = selectionRef.current
    try {
      const text = await next.text()
      const parsed = parseSvgMarkup(text)
      if (selection !== selectionRef.current) return
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      clearResult()
      const blob = new Blob([parsed.markup], { type: 'image/svg+xml' })
      const nextUrl = URL.createObjectURL(blob)
      sourceUrlRef.current = nextUrl
      setFile(next)
      setMarkup(parsed.markup)
      setWarnings(parsed.warnings)
      setSourceUrl(nextUrl)
      setNaturalWidth(parsed.dimensions.width)
      setNaturalHeight(parsed.dimensions.height)
      setWidth(parsed.dimensions.width)
      setHeight(parsed.dimensions.height)
      setScale(1)
      setStatus('ready')
      setError('')
    } catch (reason) {
      if (selection !== selectionRef.current) return
      setStatus('failed')
      setError(reason instanceof Error ? reason.message : 'The source is not valid SVG.')
    }
  }

  function useDraft() {
    const text = draft.trim()
    if (!text) {
      setError('Paste SVG markup first.')
      return
    }
    void chooseFile(new File([text], 'pasted.svg', { type: 'image/svg+xml' }))
  }

  function updateWidth(next: number) {
    setWidth(next)
    if (lockAspectRatio && naturalWidth > 0) {
      setHeight(Math.max(1, Math.round(next * naturalHeight / naturalWidth)))
      setScale(Number((next / naturalWidth).toFixed(4)))
    }
  }

  function updateHeight(next: number) {
    setHeight(next)
    if (lockAspectRatio && naturalHeight > 0) {
      setWidth(Math.max(1, Math.round(next * naturalWidth / naturalHeight)))
      setScale(Number((next / naturalHeight).toFixed(4)))
    }
  }

  function updateScale(next: number) {
    setScale(next)
    if (naturalWidth > 0 && naturalHeight > 0) {
      setWidth(Math.max(1, Math.round(naturalWidth * next)))
      setHeight(Math.max(1, Math.round(naturalHeight * next)))
    }
  }

  async function run() {
    if (!markup || runningRef.current) return
    runningRef.current = true
    const selection = selectionRef.current
    setStatus('processing')
    setError('')
    const startedAt = performance.now()
    try {
      const output = await withProcessStages(setProcessStage, () => svgToPng(markup, {
        width,
        height,
        scale,
        preserveAspectRatio: lockAspectRatio,
        background: transparent ? 'transparent' : background,
      }))
      if (selection !== selectionRef.current) return
      clearResult()
      const url = URL.createObjectURL(output.blob)
      resultUrlRef.current = url
      setWarnings(output.warnings)
      setResult({ blob: output.blob, url, durationMs: performance.now() - startedAt, width: output.width, height: output.height })
      setStatus('completed')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'SVG conversion failed.')
      setStatus('failed')
      setProcessStage('failed')
    } finally {
      runningRef.current = false
    }
  }

  return (
    <section className="workspace">
      {!file ? (
        <>
          <FileDropzone accept={accept} onFileSelected={(next) => void chooseFile(next)}/>
          <Field label="Or paste SVG markup">
            <textarea aria-label="SVG markup" spellCheck={false} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>'/>
          </Field>
          <button className="button secondary action-button" type="button" onClick={useDraft}>Use pasted SVG</button>
          {error && <p className="field-error" role="alert">{error}</p>}
        </>
      ) : (
        <div className="image-workspace">
          <div className="preview-panel">
            <div className="panel-label">
              <span>Preview</span>
              <button type="button" className="text-button" onClick={removeFile}><Trash2 size={15}/> Remove</button>
            </div>
            <ImageResultPreview
              originalSrc={sourceUrl}
              resultSrc={result?.url}
              checkerboard={transparent}
              processing={status === 'processing'}
              failed={status === 'failed'}
              originalAlt="Selected SVG"
              resultAlt="Converted PNG"
              downloadId={result?.url}
              downloadSource={result?.blob}
              downloadFilename={result ? outputFilename(file.name, 'converted', 'png') : undefined}
              meta={result ? { filename: outputFilename(file.name, 'converted', 'png'), mime: 'image/png', width: result.width, height: result.height, size: result.blob.size, originalSize: file.size, durationMs: result.durationMs } : undefined}
            />
            <div className="file-summary">
              <FileImage size={20}/>
              <span>
                <strong>{file.name}</strong>
                <small>
                  {formatBytes(file.size)}
                  {result ? ` -> ${formatBytes(result.blob.size)} · ${result.width}×${result.height}px · ${Math.round(result.durationMs)} ms` : ` · ${naturalWidth}×${naturalHeight}px`}
                </small>
              </span>
            </div>
          </div>
          <div className="options-panel">
            <div className="panel-label">
              <span>Settings</span>
              <button type="button" className="text-button" onClick={resetSettings}><RefreshCcw size={14}/> Reset</button>
            </div>
            <p className="option-help">Conversion stays in this browser. The SVG is never uploaded.</p>
            <label className="check-row">
              <input type="checkbox" checked={lockAspectRatio} onChange={(event) => setLockAspectRatio(event.target.checked)}/>
              Lock aspect ratio
            </label>
            <div className="field-grid">
              <Field label="Width" value="px">
                <input aria-label="Output width" type="number" min="1" max="16384" value={width} onChange={(event) => updateWidth(Number(event.target.value))}/>
              </Field>
              <Field label="Height" value="px">
                <input aria-label="Output height" type="number" min="1" max="16384" value={height} onChange={(event) => updateHeight(Number(event.target.value))}/>
              </Field>
            </div>
            <Field label="Scale" value={`${scale}×`}>
              <input aria-label="Scale multiplier" type="number" min="0.1" max="16" step="0.1" value={scale} onChange={(event) => updateScale(Number(event.target.value))}/>
            </Field>
            <label className="check-row">
              <input type="checkbox" checked={transparent} onChange={(event) => setTransparent(event.target.checked)}/>
              Transparent background
            </label>
            {!transparent && (
              <Field label="Background">
                <input aria-label="Background color" type="color" value={background} onChange={(event) => setBackground(event.target.value)}/>
              </Field>
            )}
            {warnings.map((warning) => <p className="option-help" key={warning} role="status">{warning}</p>)}
            {status === 'processing' && <ProcessingProgressPanel stage={processStage} title="Processing..." />}
            {status === 'failed' && <ProcessingProgressPanel stage="failed" title="Processing failed" detail={error || 'Processing failed'} />}
            <button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={status === 'processing'} onClick={() => void run()}>
              {status === 'processing' ? 'Processing...' : status === 'completed' ? 'Convert again' : status === 'failed' ? 'Try again' : 'Convert to PNG'}
            </button>
            {error && status !== 'failed' && <p className="field-error" role="alert">{error}</p>}

          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}

import { CheckCircle2, LoaderCircle, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '@/components/file/FileDropzone'
import { useT } from '@/i18n'
import { resolveApiUrl } from '@/lib/api/client'
import { completeUpload, createUpload, uploadFile } from '@/lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '@/lib/api/jobs'
import type { Job } from '@/lib/api/types'
import { ImageResultPreview } from '@/features/image/ImageResultPreview'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '@/lib/media/workflow-error'
import type { ToolDefinition } from '../tools/tool-registry'

type RemovalMode = 'fast' | 'quality'
type Background = 'transparent' | 'white' | 'black' | 'custom'

interface ResultPayload {
  downloadUrl: string
  filename: string
  size: number
  originalSize?: number
  width?: number
  height?: number
  mode?: RemovalMode
  processingTimeMs?: number
}

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

export function RemoveBackgroundWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [mode, setMode] = useState<RemovalMode>('quality')
  const [background, setBackground] = useState<Background>('transparent')
  const [customColor, setCustomColor] = useState('#7c3aed')
  const [job, setJob] = useState<Job | null>(null)
  const [result, setResult] = useState<(ResultPayload & { url: string }) | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)
  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const phase = phaseFor(transfer.status, job, errorCode)
  const phaseLabel = labelForPhase(phase, job, copy.jobs)
  const backgroundColor = background === 'transparent' ? undefined : background === 'custom' ? customColor : background

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])

  function choose(next: File) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl(URL.createObjectURL(next))
    setFile(next)
    setResult(null)
    setJob(null)
    setError('')
    setErrorCode(null)
    setTransfer(idleTransfer)
  }

  function reset() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl('')
    setFile(null)
    setResult(null)
    setJob(null)
    setError('')
    setErrorCode(null)
    setTransfer(idleTransfer)
  }

  async function run() {
    if (!file) return
    setError('')
    setErrorCode(null)
    setResult(null)
    try {
      setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: 0, label: copy.jobs.uploading } })
      const upload = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, toolId: tool.id })
      await uploadFile(upload, file, {
        onProgress: (percent) => setTransfer({ status: 'uploading', progress: { fileName: file.name, percent, label: copy.jobs.uploading } }),
      })
      const completed = await completeUpload({ fileKey: upload.fileKey })
      setTransfer({ status: 'processing', progress: { fileName: file.name, percent: null, label: 'Queued' } })
      let current = await createJob({ toolId: tool.id, input: { fileKey: completed.fileKey }, options: { mode } })
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({ status: 'processing', progress: { fileName: file.name, percent: current.progress, label: phaseLabelForStage(current.stage) } })
      }
      if (current.status !== 'completed') {
        setTransfer(idleTransfer)
        return
      }
      const payload = await getJobResult<ResultPayload>(current.jobId)
      const url = resolveApiUrl(payload.result.downloadUrl)
      setResult({ ...payload.result, url })
      setTransfer({ status: 'success', progress: { fileName: file.name, percent: 100, label: copy.jobs.completed } })
    } catch (reason) {
      const failed = reason instanceof Error ? reason : errorFromJob(job?.error)
      setErrorCode(workflowErrorCode(failed))
      setError(workflowMessage(failed, copy.errors))
      setTransfer(idleTransfer)
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  return (
    <section className="workspace remove-bg-workspace">
      <div className="options-panel remove-bg-controls">
        {!file ? (
          <FileDropzone accept={tool.acceptedFormats ?? ['image/jpeg', 'image/png', 'image/webp']} maxFileSize={100 * 1024 * 1024} status={transfer.status} progress={transfer.progress} disabled={busy} onFileSelected={choose} />
        ) : (
          <div className="selected-file-card">
            <strong>{file.name}</strong>
            <small>{formatBytes(file.size)}</small>
            <button type="button" className="text-button" disabled={busy} onClick={reset}><Trash2 size={15}/> Process another image</button>
          </div>
        )}
        <div className="field">
          <span>Removal quality</span>
          <div className="segmented" role="radiogroup" aria-label="Removal quality">
            <button type="button" role="radio" aria-checked={mode === 'fast'} className={mode === 'fast' ? 'active' : ''} disabled={busy} onClick={() => setMode('fast')}>Fast</button>
            <button type="button" role="radio" aria-checked={mode === 'quality'} className={mode === 'quality' ? 'active' : ''} disabled={busy} onClick={() => setMode('quality')}>Quality</button>
          </div>
          <small>{mode === 'fast' ? 'Faster processing for simple images.' : 'Better hair, edges, and fine details.'}</small>
        </div>
        {result && (
          <div className="field">
            <span>Background</span>
            <div className="segmented" role="radiogroup" aria-label="Preview background">
              {(['transparent', 'white', 'black', 'custom'] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={background === value} className={background === value ? 'active' : ''} onClick={() => setBackground(value)}>{labelBackground(value)}</button>)}
            </div>
            {background === 'custom' && <input type="color" aria-label="Custom background color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} />}
          </div>
        )}
        <div className="button-row">
          <button className="button primary" type="button" disabled={!file || busy} onClick={run}>{busy && <LoaderCircle size={17}/>} Remove background</button>
          {busy && <button className="button secondary" type="button" onClick={stop}><Square size={15}/> {copy.workspace.cancel}</button>}
        </div>
        <p className="option-help">Your image is processed on the Kits server. It is not sent to third-party AI services.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card remove-bg-result">
        <div className="panel-label"><span>{result ? 'Before / after' : copy.workspace.jobStatus}</span><span className={`badge badge-${phase}`}>{phaseLabel}</span></div>
        {file && sourceUrl ? (
          <ImageResultPreview
            originalSrc={sourceUrl}
            resultSrc={result?.url}
            checkerboard
            processing={busy}
            failed={phase === 'failed'}
            originalAlt="Original preview"
            resultAlt="Transparent PNG result"
            downloadId={result ? `remove-background:${result.downloadUrl}` : undefined}
            downloadSource={result?.url}
            downloadFilename={result?.filename}
            {...(backgroundColor ? { resultBackground: backgroundColor } : {})}
            meta={result ? { filename: result.filename, mime: 'image/png', width: result.width, height: result.height, size: result.size, originalSize: result.originalSize ?? file.size, durationMs: result.processingTimeMs } : undefined}
          />
        ) : <p className="empty-result">Upload an image to remove its background.</p>}
        {busy && <progress max="100" value={job?.progress ?? undefined} />}
        {result && file && (
          <div className="remove-bg-done">
            <p><CheckCircle2 size={18}/> Background removed</p>
            <dl className="result-stats">
              <div><dt>Resolution</dt><dd>{result.width ?? 'Unknown'} × {result.height ?? 'Unknown'}</dd></div>
              <div><dt>Original file size</dt><dd>{formatBytes(result.originalSize ?? file.size)}</dd></div>
              <div><dt>Result size</dt><dd>{formatBytes(result.size)}</dd></div>
              <div><dt>Mode used</dt><dd>{result.mode === 'fast' ? 'Fast' : 'Quality'}</dd></div>
              <div><dt>Processing time</dt><dd>{typeof result.processingTimeMs === 'number' ? `${Math.round(result.processingTimeMs)} ms` : 'Unknown'}</dd></div>
            </dl>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={reset}>Process another image</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function labelBackground(value: Background): string {
  if (value === 'transparent') return 'Transparent'
  if (value === 'white') return 'White'
  if (value === 'black') return 'Black'
  return 'Custom'
}

function phaseFor(status: DropzoneStatus, job: Job | null, errorCode: WorkflowErrorCode | null): string {
  if (errorCode || job?.status === 'failed') return 'failed'
  if (status === 'uploading') return 'uploading'
  if (job?.status === 'queued') return 'queued'
  if (job?.status === 'processing' || status === 'processing') return 'processing'
  if (job?.status === 'completed' || status === 'success') return 'completed'
  if (job?.status === 'cancelled') return 'cancelled'
  return 'ready'
}

function labelForPhase(phase: string, job: Job | null, jobs: { uploading: string; queued: string; processing: string; completed: string; failed: string; cancelled: string }): string {
  if (job?.stage) return phaseLabelForStage(job.stage)
  return phase === 'uploading' ? jobs.uploading : phase === 'queued' ? jobs.queued : phase === 'processing' ? 'Removing background' : phase === 'completed' ? jobs.completed : phase === 'failed' ? jobs.failed : phase === 'cancelled' ? jobs.cancelled : 'Ready'
}

function phaseLabelForStage(stage?: string): string {
  if (stage === 'removing-background') return 'Removing background'
  if (stage === 'refining-edges') return 'Refining edges'
  if (stage === 'finalizing') return 'Finalizing'
  if (stage === 'downloading') return 'Uploading'
  if (stage === 'queued') return 'Queued'
  return stage ?? 'Processing'
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

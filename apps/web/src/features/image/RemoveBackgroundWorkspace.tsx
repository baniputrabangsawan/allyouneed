import { CheckCircle2, LoaderCircle, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '@/components/file/FileDropzone'
import { ProcessingProgressPanel } from '@/features/workspaces/processing-progress'
import { useT, type Messages } from '@/i18n'
import { resolveApiUrl } from '@/lib/api/client'
import { completeUpload, createUpload, uploadFile } from '@/lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '@/lib/api/jobs'
import type { Job } from '@/lib/api/types'
import { ImageResultPreview } from '@/features/image/ImageResultPreview'
import { resolveJobProgress, useSmoothedJobProgress } from '@/lib/media/job-progress'
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
  const [progressKey, setProgressKey] = useState(0)
  const runToken = useRef(0)
  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const flow = resolveJobProgress({
    transferStatus: transfer.status,
    uploadPercent: transfer.progress.percent ?? null,
    job,
    failed: Boolean(errorCode) || job?.status === 'failed',
  })
  const percent = useSmoothedJobProgress(flow, progressKey)
  const phase = phaseFor(transfer.status, job, errorCode)
  const phaseLabel = labelForPhase(phase, job, copy.jobs)
  const backgroundColor = background === 'transparent' ? undefined : background === 'custom' ? customColor : background

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])

  function choose(next: File) {
    runToken.current += 1
    setProgressKey((value) => value + 1)
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
    runToken.current += 1
    setProgressKey((value) => value + 1)
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
    if (!file || busy) return
    const token = runToken.current + 1
    runToken.current = token
    setProgressKey((value) => value + 1)
    setError('')
    setErrorCode(null)
    setResult(null)
    try {
      setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: 0, label: copy.jobs.uploading } })
      const upload = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, toolId: tool.id })
      if (runToken.current !== token) return
      await uploadFile(upload, file, {
        onProgress: (uploaded) => {
          if (runToken.current !== token) return
          setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: uploaded, label: copy.jobs.uploading } })
        },
      })
      if (runToken.current !== token) return
      const completed = await completeUpload({ fileKey: upload.fileKey })
      if (runToken.current !== token) return
      setTransfer({ status: 'processing', progress: { fileName: file.name, percent: 20, label: 'Preparing' } })
      let current = await createJob({ toolId: tool.id, input: { fileKey: completed.fileKey }, options: { mode } })
      if (runToken.current !== token) return
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
        if (runToken.current !== token) return
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({ status: 'processing', progress: { fileName: file.name, percent: current.progress, label: phaseLabelForStage(current.stage) } })
      }
      if (runToken.current !== token) return
      if (current.status !== 'completed') {
        setTransfer(idleTransfer)
        if (current.status === 'failed') {
          const failed = errorFromJob(current.error)
          setErrorCode(workflowErrorCode(failed))
          setError(backgroundRemovalMessage(failed, copy.errors))
        }
        return
      }
      const payload = await getJobResult<ResultPayload>(current.jobId)
      if (runToken.current !== token) return
      const url = resolveApiUrl(payload.result.downloadUrl)
      setResult({ ...payload.result, url })
      setTransfer({ status: 'success', progress: { fileName: file.name, percent: 100, label: copy.jobs.completed } })
    } catch (reason) {
      if (runToken.current !== token) return
      const failed = reason instanceof Error ? reason : errorFromJob(job?.error)
      setErrorCode(workflowErrorCode(failed))
      setError(backgroundRemovalMessage(failed, copy.errors))
      setTransfer(idleTransfer)
    }
  }

  async function stop() {
    runToken.current += 1
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  return (
    <section className="workspace remove-bg-workspace" aria-busy={busy}>
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
        <div className="button-row remove-bg-actions">
          <button className="button primary" type="button" disabled={!file || busy} aria-busy={busy} onClick={() => void run()}>
            {busy && <LoaderCircle size={17} aria-hidden="true" className="animate-spin" />}
            {busy ? flow.label : 'Remove background'}
          </button>
          {busy && (
            <button className="button secondary" type="button" onClick={() => void stop()}>
              <Square size={15} aria-hidden="true" /> {copy.workspace.cancel}
            </button>
          )}
        </div>
        {busy && (
          <ProcessingProgressPanel
            stage="preparing"
            active
            title={flow.label}
            percent={percent}
          />
        )}
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
        {result && file && (
          <div className="remove-bg-done">
            <p><CheckCircle2 size={18}/> Background removed</p>
            <p className="option-help">{result.mode === 'fast' ? 'Fast' : 'Quality'} mode</p>
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

function backgroundRemovalMessage(reason: unknown, errors: Messages['errors']): string {
  const code = workflowErrorCode(reason)
  if (code === 'MODEL_UNAVAILABLE') return errors.backgroundModelUnavailable
  if (code === 'AI_PROCESSING_FAILED') return errors.backgroundRemovalFailed
  return workflowMessage(reason, {
    ...errors,
    modelUnavailable: errors.backgroundModelUnavailable,
    aiProcessingFailed: errors.backgroundRemovalFailed,
  })
}

import { Download, LoaderCircle, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '@/components/file/FileDropzone'
import { useT } from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import { completeUpload, createUpload, uploadFile } from '@/lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '@/lib/api/jobs'
import type { Job } from '@/lib/api/types'
import { formatBytes, outputFilename } from '@/lib/format'
import { remoteJobPhase } from '@/lib/media/job-phase'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '@/lib/media/workflow-error'
import type { ToolDefinition } from '../tools/tool-registry'

const accept = ['image/jpeg', 'image/png', 'image/webp'] as const

interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

function defaultBounds(width: number, height: number): Bounds {
  const left = Math.max(1, Math.round(width * 0.1))
  const top = Math.max(1, Math.round(height * 0.1))
  return { left, top, width: Math.max(1, width - left * 2), height: Math.max(1, height - top * 2) }
}

export function BasicBackgroundWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const sourceUrlRef = useRef('')
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [bounds, setBounds] = useState<Bounds>({ left: 0, top: 0, width: 0, height: 0 })
  const [job, setJob] = useState<Job | null>(null)
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
  }, [])

  async function chooseFile(next: File) {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    const nextUrl = URL.createObjectURL(next)
    sourceUrlRef.current = nextUrl
    setFile(next)
    setSourceUrl(nextUrl)
    setJob(null)
    setDownload(null)
    setError('')
    setErrorCode(null)
    setTransfer(idleTransfer)
    try {
      const bitmap = await createImageBitmap(next)
      setNaturalWidth(bitmap.width)
      setNaturalHeight(bitmap.height)
      setBounds(defaultBounds(bitmap.width, bitmap.height))
      bitmap.close()
    } catch {
      setError('This image could not be read.')
      setNaturalWidth(0)
      setNaturalHeight(0)
    }
  }

  function updateBound(key: keyof Bounds, value: number) {
    setBounds((current) => ({ ...current, [key]: value }))
  }

  async function run() {
    if (!file) return
    setError('')
    setErrorCode(null)
    setDownload(null)
    try {
      setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: 0, label: 'Uploading...' } })
      const target = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, toolId: tool.id })
      await uploadFile(target, file, {
        onProgress: (percent) => setTransfer({ status: 'uploading', progress: { fileName: file.name, percent, label: 'Uploading...' } }),
      })
      const fileKey = (await completeUpload({ fileKey: target.fileKey })).fileKey
      setTransfer({ status: 'processing', progress: { fileName: file.name, percent: null, label: 'Processing...' } })
      let current = await createJob({
        toolId: tool.id,
        input: { fileKey },
        options: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      })
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({
          status: 'processing',
          progress: { fileName: file.name, percent: current.progress, label: current.stage ?? 'Processing...' },
        })
      }
      if (current.status === 'completed') {
        const result = await getJobResult<{ downloadUrl: string; filename: string }>(current.jobId)
        setDownload({ url: `${API_BASE_URL}${result.result.downloadUrl}`, filename: result.result.filename || outputFilename(file.name, 'cutout', 'png') })
        setTransfer({ status: 'success', progress: { fileName: file.name, percent: 100, label: 'Completed' } })
      } else if (current.status === 'failed') {
        const failed = errorFromJob(current.error)
        const message = workflowMessage(failed, copy.errors)
        setErrorCode(workflowErrorCode(failed))
        setError(message)
        setTransfer({ status: 'error', progress: { fileName: file.name, label: message } })
      } else {
        setTransfer(idleTransfer)
      }
    } catch (reason) {
      const message = workflowMessage(reason, copy.errors)
      setErrorCode(workflowErrorCode(reason))
      setError(message)
      setTransfer({ status: 'error', progress: { fileName: file.name, label: message } })
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const phase = remoteJobPhase(transfer.status, job, errorCode)
  const phaseLabel = {
    ready: copy.workspace.ready,
    uploading: copy.jobs.uploading,
    queued: copy.jobs.queued,
    processing: copy.jobs.processing,
    completed: copy.jobs.completed,
    failed: copy.jobs.failed,
    cancelled: copy.jobs.cancelled,
    unavailable: copy.jobs.unavailable,
  }[phase]
  const maxLeft = Math.max(0, naturalWidth - 2)
  const maxTop = Math.max(0, naturalHeight - 2)
  const overlay = naturalWidth > 0 ? {
    left: `${(bounds.left / naturalWidth) * 100}%`,
    top: `${(bounds.top / naturalHeight) * 100}%`,
    width: `${(bounds.width / naturalWidth) * 100}%`,
    height: `${(bounds.height / naturalHeight) * 100}%`,
  } : undefined

  return <section className="workspace split-workspace">
    <div className="options-panel">
      <FileDropzone accept={accept} maxFileSize={100 * 1024 * 1024} status={transfer.status} progress={transfer.progress} disabled={busy} onFileSelected={chooseFile}/>
      <p role="note">Basic OpenCV GrabCut cutout, not AI segmentation. Draw a box around the subject. Hair, glass, and busy backgrounds often leave leftovers or holes.</p>
      {file && <p className="option-help">{file.name} · {formatBytes(file.size)}{naturalWidth ? ` · ${naturalWidth}×${naturalHeight}` : ''}</p>}
      {naturalWidth > 0 && <>
        <p className="option-help">Foreground bounds are in original image pixels. Everything outside this box starts as background.</p>
        <div className="field-grid">
          <label className="field"><span>Left <small>px</small></span><input aria-label="Foreground left" type="number" min="0" max={maxLeft} value={bounds.left} onChange={(event) => updateBound('left', Number(event.target.value))}/></label>
          <label className="field"><span>Top <small>px</small></span><input aria-label="Foreground top" type="number" min="0" max={maxTop} value={bounds.top} onChange={(event) => updateBound('top', Number(event.target.value))}/></label>
          <label className="field"><span>Width <small>px</small></span><input aria-label="Foreground width" type="number" min="2" max={naturalWidth} value={bounds.width} onChange={(event) => updateBound('width', Number(event.target.value))}/></label>
          <label className="field"><span>Height <small>px</small></span><input aria-label="Foreground height" type="number" min="2" max={naturalHeight} value={bounds.height} onChange={(event) => updateBound('height', Number(event.target.value))}/></label>
        </div>
      </>}
      <div className="button-row">
        <button className="button primary" type="button" disabled={!file || busy} onClick={() => void run()}>{busy && <LoaderCircle size={17}/>} Cut out background</button>
        {busy && <button className="button secondary" type="button" onClick={() => void stop()}><Square size={15}/> Cancel</button>}
      </div>
      {error && transfer.status !== 'error' && <p className="field-error" role="alert">{error}</p>}
    </div>
    <div className="result-card">
      <div className="panel-label"><span>Foreground box</span><span className={`badge badge-${phase}`}>{phaseLabel}</span></div>
      {phase === 'unavailable' && <p className="field-error" role="alert">{copy.errors.apiUnreachable}</p>}
      {sourceUrl ? <div className="image-stage" style={{ position: 'relative' }}>
        <img src={download?.url ?? sourceUrl} alt={download ? 'Transparent PNG result' : 'Selected input'}/>
        {!download && overlay && <span aria-hidden="true" style={{ position: 'absolute', border: '2px dashed color-mix(in srgb, var(--foreground) 70%, transparent)', boxShadow: '0 0 0 9999px color-mix(in srgb, #111114 35%, transparent)', ...overlay }}/>}
      </div> : <p className="option-help">Upload a PNG, JPEG, or WebP to preview the starting box.</p>}
      {job && <><p>{job.stage ?? job.status}</p><progress max="100" value={job.progress ?? undefined}/></>}
      {download && <a className="button primary" href={download.url} download={download.filename}><Download size={18}/> Download PNG</a>}
    </div>
  </section>
}

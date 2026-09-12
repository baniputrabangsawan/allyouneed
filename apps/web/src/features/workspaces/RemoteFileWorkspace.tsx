import { Download, LoaderCircle, Square } from 'lucide-react'
import { useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '../../components/file/FileDropzone'
import { useT } from '../../i18n'
import { resolveApiUrl } from '../../lib/api/client'
import { completeUpload, createUpload, uploadFile } from '../../lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import { previewKind, resultMediaKind } from '../../lib/media/kind'
import { useObjectUrls } from '../../lib/media/object-url'
import { remoteJobPhase } from '../../lib/media/job-phase'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '../../lib/media/workflow-error'
import type { ToolDefinition } from '../tools/tool-registry'
import { ExtractedText } from './ExtractedText'
import { MediaPreview } from './MediaPreview'
import { textFromJsonPayload } from './json-text'
import { defaultRemoteOptions } from './remote-tool-options'
import { RemoteToolFields } from './RemoteToolFields'
import { SelectedFiles } from './SelectedFiles'

const multipleTools = new Set(['merge-pdf', 'jpg-to-pdf', 'png-to-pdf', 'audio-merger', 'video-merger', 'add-audio', 'add-subtitle'])

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

async function loadExtractedText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return textFromJsonPayload(await response.json())
  } catch {
    return null
  }
}

export function RemoteFileWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState(() => defaultRemoteOptions(tool.id))
  const [job, setJob] = useState<Job | null>(null)
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)
  const inputUrls = useObjectUrls(files)
  const resultKind = resultMediaKind(tool)
  const showInputPreview = tool.category === 'audio' || tool.category === 'video'
  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const requiredFiles = tool.id === 'add-subtitle' ? 2 : 1
  const maxFiles = tool.id === 'add-subtitle' ? 2 : 20
  const accept = tool.acceptedFormats ?? []
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
  const showDropzone = files.length === 0 || busy

  function chooseFiles(next: File[]) {
    setFiles(next)
    setTransfer(idleTransfer)
    setError('')
    setErrorCode(null)
    setDownload(null)
    setExtractedText('')
    setJob(null)
  }

  async function run() {
    if (files.length === 0) return
    const activeName = files[0]?.name ?? 'file'
    setError('')
    setErrorCode(null)
    setDownload(null)
    setExtractedText('')
    try {
      const keys: string[] = []
      setTransfer({ status: 'uploading', progress: { fileName: activeName, percent: 0, label: copy.dropzone.uploading } })
      for (const [index, file] of files.entries()) {
        setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: Math.round((index / files.length) * 100), label: copy.dropzone.uploading } })
        const target = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, toolId: tool.id })
        await uploadFile(target, file, {
          onProgress: (percent) => {
            const overall = Math.round(((index + percent / 100) / files.length) * 100)
            setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: overall, label: copy.dropzone.uploading } })
          },
        })
        keys.push((await completeUpload({ fileKey: target.fileKey })).fileKey)
      }
      setTransfer({ status: 'processing', progress: { fileName: activeName, percent: null, label: copy.dropzone.processing } })
      let current = await createJob({ toolId: tool.id, input: keys.length === 1 ? { fileKey: keys[0] } : { files: keys }, options })
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        const wait = new Promise<void>((resolve) => {
          window.setTimeout(resolve, 500)
        })
        await wait
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({
          status: 'processing',
          progress: {
            fileName: activeName,
            percent: current.progress,
            label: current.stage ?? copy.dropzone.processing,
          },
        })
      }
      if (current.status === 'completed') {
        const payload = await getJobResult<{ downloadUrl: string; filename: string }>(current.jobId)
        const url = resolveApiUrl(payload.result.downloadUrl)
        setDownload({ url, filename: payload.result.filename })
        if (!resultKind) setExtractedText((await loadExtractedText(url)) ?? '')
        setTransfer({ status: 'success', progress: { fileName: activeName, percent: 100, label: copy.dropzone.completed } })
      } else if (current.status === 'failed') {
        const failed = errorFromJob(current.error)
        setErrorCode(workflowErrorCode(failed))
        setError(workflowMessage(failed, copy.errors))
        setTransfer(idleTransfer)
      } else {
        setTransfer(idleTransfer)
      }
    } catch (reason) {
      setErrorCode(workflowErrorCode(reason))
      setError(workflowMessage(reason, copy.errors))
      setTransfer(idleTransfer)
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        {showDropzone && (
          <FileDropzone
            accept={accept}
            multiple={multipleTools.has(tool.id)}
            maxFiles={maxFiles}
            maxFileSize={100 * 1024 * 1024}
            status={transfer.status}
            progress={transfer.progress}
            disabled={busy}
            onFilesSelected={chooseFiles}
          />
        )}
        {files.length > 0 && !busy && (
          <SelectedFiles
            files={files}
            accept={accept}
            multiple={multipleTools.has(tool.id)}
            maxFiles={maxFiles}
            disabled={busy}
            onReplace={chooseFiles}
            onRemove={() => chooseFiles([])}
          />
        )}
        {showInputPreview && files.length > 0 && (
          <ul className="media-file-list">
            {files.map((file, index) => {
              const url = inputUrls[index]
              return (
                <li key={`${file.name}-${file.size}-${index}`}>
                  {url ? (
                    <MediaPreview
                      src={url}
                      kind={previewKind(file, tool.category)}
                      label={`Input preview ${index + 1}`}
                      title={`${file.name}`}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <RemoteToolFields toolId={tool.id} options={options} onChange={(patch) => setOptions((current) => ({ ...current, ...patch }))} />
        <div className="button-row">
          <button className="button primary" type="button" disabled={files.length < requiredFiles || busy} onClick={run}>
            {busy && <LoaderCircle size={17}/>} {copy.workspace.process}
          </button>
          {busy && <button className="button secondary" type="button" onClick={stop}><Square size={15}/> {copy.workspace.cancel}</button>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.workspace.jobStatus}</span><span className={`badge badge-${phase}`}>{phaseLabel}</span></div>
        {phase === 'uploading' && (
          <>
            <p>{copy.jobs.uploading}{transfer.progress.percent != null ? ` ${transfer.progress.percent}%` : ''}</p>
            <progress max="100" value={transfer.progress.percent ?? undefined} />
          </>
        )}
        {phase === 'queued' && <p>{copy.jobs.queued}</p>}
        {phase === 'unavailable' && <p className="field-error" role="alert">{copy.errors.apiUnreachable}</p>}
        {job && (phase === 'processing' || phase === 'completed') && (
          <>
            <p>{job.stage ?? phaseLabel}</p>
            <progress max="100" value={job.progress ?? (phase === 'completed' ? 100 : undefined)} />
          </>
        )}
        {(phase === 'failed' || phase === 'cancelled') && error && <p className="field-error" role="alert">{error}</p>}
        {extractedText && <ExtractedText text={extractedText} filename={files[0]?.name ?? download?.filename ?? 'extracted.txt'} />}
        {!extractedText && download && resultKind && <MediaPreview src={download.url} kind={resultKind} label="Result preview" />}
        {!extractedText && download && (
          <a className="button primary" href={download.url} download={download.filename}>
            <Download size={18}/> {copy.workspace.downloadResult}
          </a>
        )}
      </div>
    </section>
  )
}

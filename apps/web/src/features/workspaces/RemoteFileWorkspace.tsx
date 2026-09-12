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
import { workflowMessage } from '../../lib/media/workflow-error'
import type { ToolDefinition } from '../tools/tool-registry'
import { MediaPreview } from './MediaPreview'
import { formatBytes } from './workspace-utils'

const multipleTools = new Set(['merge-pdf', 'jpg-to-pdf', 'png-to-pdf', 'audio-merger', 'video-merger', 'add-audio', 'add-subtitle'])

const defaultOptions: Record<string, string> = {
  'split-pdf': '{"pages":[1]}',
  'delete-pdf-pages': '{"pages":[1]}',
  'extract-pdf-pages': '{"pages":[1]}',
  'reorder-pdf-pages': '{"pages":[1]}',
  'protect-pdf': '{"password":""}',
  'unlock-pdf': '{"password":""}',
  'watermark-pdf': '{"text":"Watermark"}',
  'rotate-pdf': '{"rotation":90}',
  'resize-video': '{"width":640,"height":360}',
  'crop-video': '{"width":320,"height":180}',
  'change-volume': '{"volume":1}',
  'change-audio-speed': '{"speed":1}',
  'change-video-speed': '{"speed":1}',
  'add-watermark': '{"text":"Watermark"}',
  'blur-face': '{"mode":"blur","strength":8}',
  'noise-reduction': '{"strength":"medium"}',
  'add-subtitle': '{"mode":"burn","format":"mp4"}',
}

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

function noiseStrength(raw: string): 'light' | 'medium' | 'strong' {
  try {
    const parsed = JSON.parse(raw) as { strength?: string }
    if (parsed.strength === 'light' || parsed.strength === 'strong') return parsed.strength
  } catch { /* keep medium */ }
  return 'medium'
}
export function RemoteFileWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState(defaultOptions[tool.id] ?? '{}')
  const [job, setJob] = useState<Job | null>(null)
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  const [error, setError] = useState('')
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)
  const inputUrls = useObjectUrls(files)
  const resultKind = resultMediaKind(tool)
  const showInputPreview = tool.category === 'audio' || tool.category === 'video'

  function chooseFiles(next: File[]) {
    setFiles(next)
    setTransfer(idleTransfer)
    setError('')
    setDownload(null)
    setJob(null)
  }

  async function run() {
    if (files.length === 0) return
    const activeName = files[0]?.name ?? 'file'
    setError('')
    setDownload(null)
    try {
      const parsed = JSON.parse(options) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Options must be a JSON object.')
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
      let current = await createJob({ toolId: tool.id, input: keys.length === 1 ? { fileKey: keys[0] } : { files: keys }, options: parsed })
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
        setDownload({ url: resolveApiUrl(payload.result.downloadUrl), filename: payload.result.filename })
        setTransfer({ status: 'success', progress: { fileName: activeName, percent: 100, label: copy.dropzone.completed } })
      } else if (current.status === 'failed') {
        setError(current.error?.message ?? copy.errors.processingFailed)
        setTransfer(idleTransfer)
      } else {
        setTransfer(idleTransfer)
      }
    } catch (reason) {
      setError(workflowMessage(reason, copy.errors))
      setTransfer(idleTransfer)
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const requiredFiles = tool.id === 'add-subtitle' ? 2 : 1
  const maxFiles = tool.id === 'add-subtitle' ? 2 : 20

  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        <FileDropzone
          accept={tool.acceptedFormats ?? []}
          multiple={multipleTools.has(tool.id)}
          maxFiles={maxFiles}
          maxFileSize={100 * 1024 * 1024}
          status={transfer.status}
          progress={transfer.progress}
          disabled={busy}
          onFilesSelected={chooseFiles}
        />
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
                      title={`${file.name} · ${formatBytes(file.size)}`}
                    />
                  ) : (
                    <span>{file.name} · {formatBytes(file.size)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!showInputPreview && files.length > 0 && (
          <ul>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>
        )}
        {tool.slug === 'blur-face' && <p role="note">Basic Haar frontal-face detection, not high-accuracy AI. Profile, side, or busy photos may miss. Zero detections fail with “No faces detected.”</p>}
        {tool.slug === 'noise-reduction' && (
          <>
            <p role="note">{copy.workspace.noiseReductionNote}</p>
            <label className="field">
              <span>{copy.workspace.noiseStrength}</span>
              <select
                value={noiseStrength(options)}
                onChange={(event) => setOptions(JSON.stringify({ strength: event.target.value }))}
                aria-label={copy.workspace.noiseStrength}
              >
                <option value="light">{copy.workspace.strengthLight}</option>
                <option value="medium">{copy.workspace.strengthMedium}</option>
                <option value="strong">{copy.workspace.strengthStrong}</option>
              </select>
            </label>
          </>
        )}
        {tool.slug === 'add-subtitle' && <p role="note">Burns or muxes an existing .srt, .vtt, or .ass file into a video. This tool does not generate subtitles. Audio is kept unless keepAudio is false.</p>}
        {tool.slug !== 'noise-reduction' && (
          <label className="field">
            <span>{copy.workspace.advancedOptions}</span>
            <textarea rows={5} value={options} onChange={(event) => setOptions(event.target.value)} spellCheck={false}/>
          </label>
        )}
        <div className="button-row">
          <button className="button primary" type="button" disabled={files.length < requiredFiles || busy} onClick={run}>
            {busy && <LoaderCircle size={17}/>} {copy.workspace.process}
          </button>
          {busy && <button className="button secondary" type="button" onClick={stop}><Square size={15}/> {copy.workspace.cancel}</button>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.workspace.jobStatus}</span><span className="badge">{job?.status ?? copy.workspace.ready}</span></div>
        {job && <><p>{job.stage ?? job.status}</p><progress max="100" value={job.progress ?? undefined}/></>}
        {download && resultKind && <MediaPreview src={download.url} kind={resultKind} label="Result preview" />}
        {download && (
          <a className="button primary" href={download.url} download={download.filename}>
            <Download size={18}/> {copy.workspace.downloadResult}
          </a>
        )}
      </div>
    </section>
  )
}

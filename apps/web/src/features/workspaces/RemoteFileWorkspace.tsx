import { Download, LoaderCircle, Square } from 'lucide-react'
import { useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '../../components/file/FileDropzone'
import { API_BASE_URL } from '../../lib/api/client'
import { completeUpload, createUpload, uploadFile } from '../../lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import type { ToolDefinition } from '../tools/tool-registry'

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

export function RemoteFileWorkspace({ tool }: { tool: ToolDefinition }) {
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState(defaultOptions[tool.id] ?? '{}')
  const [job, setJob] = useState<Job | null>(null)
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  const [error, setError] = useState('')
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)

  function chooseFiles(next: File[]) {
    setFiles(next)
    setTransfer(idleTransfer)
    setError('')
    setDownload(null)
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
      setTransfer({ status: 'uploading', progress: { fileName: activeName, percent: 0, label: 'Uploading...' } })
      for (const [index, file] of files.entries()) {
        setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: Math.round((index / files.length) * 100), label: 'Uploading...' } })
        const target = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, toolId: tool.id })
        await uploadFile(target, file, {
          onProgress: (percent) => {
            const overall = Math.round(((index + percent / 100) / files.length) * 100)
            setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: overall, label: 'Uploading...' } })
          },
        })
        keys.push((await completeUpload({ fileKey: target.fileKey })).fileKey)
      }
      setTransfer({ status: 'processing', progress: { fileName: activeName, percent: null, label: 'Processing...' } })
      let current = await createJob({ toolId: tool.id, input: keys.length === 1 ? { fileKey: keys[0] } : { files: keys }, options: parsed })
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({
          status: 'processing',
          progress: {
            fileName: activeName,
            percent: current.progress,
            label: current.stage ?? 'Processing...',
          },
        })
      }
      if (current.status === 'completed') {
        const result = await getJobResult<{ downloadUrl: string; filename: string }>(current.jobId)
        setDownload({ url: `${API_BASE_URL}${result.result.downloadUrl}`, filename: result.result.filename })
        setTransfer({ status: 'success', progress: { fileName: activeName, percent: 100, label: 'Completed' } })
      } else if (current.status === 'failed') {
        const message = current.error?.message ?? 'Processing failed.'
        setError(message)
        setTransfer({ status: 'error', progress: { fileName: activeName, label: message } })
      } else {
        setTransfer(idleTransfer)
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Processing failed.'
      setError(message)
      setTransfer({ status: 'error', progress: { fileName: activeName, label: message } })
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setTransfer(idleTransfer)
  }

  const busy = transfer.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'
  const requiredFiles = tool.id === 'add-subtitle' ? 2 : 1
  const maxFiles = tool.id === 'add-subtitle' ? 2 : 20
  return <section className="workspace split-workspace"><div className="options-panel"><FileDropzone accept={tool.acceptedFormats ?? []} multiple={multipleTools.has(tool.id)} maxFiles={maxFiles} maxFileSize={100 * 1024 * 1024} status={transfer.status} progress={transfer.progress} disabled={busy} onFilesSelected={chooseFiles}/>{files.length > 0 && <ul>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}{tool.slug === 'blur-face' && <p role="note">Basic Haar frontal-face detection, not high-accuracy AI. Profile, side, or busy photos may miss. Zero detections fail with “No faces detected.”</p>}{tool.slug === 'noise-reduction' && <p role="note">FFT denoise with FFmpeg afftdn. Strength is light, medium, or strong. This reduces broadband hiss; it is not vocal isolation.</p>}{tool.slug === 'add-subtitle' && <p role="note">Burns or muxes an existing .srt, .vtt, or .ass file into a video. This tool does not generate subtitles. Audio is kept unless keepAudio is false.</p>}<label className="field"><span>Advanced options (JSON)</span><textarea rows={5} value={options} onChange={(event) => setOptions(event.target.value)} spellCheck={false}/></label><div className="button-row"><button className="button primary" type="button" disabled={files.length < requiredFiles || busy} onClick={run}>{busy && <LoaderCircle size={17}/>} Process</button>{busy && <button className="button secondary" type="button" onClick={stop}><Square size={15}/> Cancel</button>}</div>{error && transfer.status !== 'error' && <p className="field-error" role="alert">{error}</p>}</div><div className="result-card"><div className="panel-label"><span>Job status</span><span className="badge">{job?.status ?? 'Ready'}</span></div>{job && <><p>{job.stage ?? job.status}</p><progress max="100" value={job.progress ?? undefined}/></>}{download && <a className="button primary" href={download.url} download={download.filename}><Download size={18}/> Download result</a>}</div></section>
}

import { Download, LoaderCircle, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '../../components/file/FileDropzone'
import { useT } from '../../i18n'
import { resolveApiUrl } from '../../lib/api/client'
import { completeUpload, createUpload, uploadFile } from '../../lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import { previewKind } from '../../lib/media/kind'
import { useObjectUrl } from '../../lib/media/object-url'
import { errorFromJob, workflowMessage } from '../../lib/media/workflow-error'
import type { ToolDefinition } from '../tools/tool-registry'
import { MediaPreview } from './MediaPreview'
import { SelectedFiles } from './SelectedFiles'
import {
  AUDIO_CONVERT_BITRATES,
  AUDIO_CONVERT_FORMATS,
  AUDIO_CONVERT_RATES,
  buildAudioConvertOptions,
  defaultAudioBitrate,
  formatBytes,
  formatDuration,
  isLosslessAudioFormat,
  type AudioConvertFormat,
} from './audio-converter-utils'

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

interface ConvertResult {
  downloadUrl: string
  filename: string
  sourceFormat?: string
  outputFormat?: string
  sourceSize?: number
  outputSize?: number
  duration?: number
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

export function AudioConverterWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<AudioConvertFormat>('mp3')
  const [bitrate, setBitrate] = useState(defaultAudioBitrate('mp3'))
  const [sampleRate, setSampleRate] = useState<'original' | number>('original')
  const [channels, setChannels] = useState<'original' | 1 | 2>('original')
  const [job, setJob] = useState<Job | null>(null)
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [error, setError] = useState('')
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)
  const inputPreviewUrl = useObjectUrl(file)
  const lossless = isLosslessAudioFormat(format)
  const options = useMemo(
    () => buildAudioConvertOptions({ format, bitrate, sampleRate, channels }),
    [format, bitrate, sampleRate, channels],
  )

  function chooseFiles(next: File[]) {
    setFile(next[0] ?? null)
    setError('')
    setResult(null)
    setJob(null)
    setTransfer(idleTransfer)
  }

  async function run() {
    if (!file) return
    setError('')
    setResult(null)
    try {
      setTransfer({ status: 'uploading', progress: { fileName: file.name, percent: 0, label: copy.dropzone.uploading } })
      const target = await createUpload({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        toolId: tool.id,
      })
      await uploadFile(target, file, {
        onProgress: (percent) => {
          setTransfer({ status: 'uploading', progress: { fileName: file.name, percent, label: copy.dropzone.uploading } })
        },
      })
      const uploaded = await completeUpload({ fileKey: target.fileKey })
      setTransfer({ status: 'processing', progress: { fileName: file.name, percent: null, label: copy.dropzone.processing } })
      let current = await createJob({ toolId: tool.id, input: { fileKey: uploaded.fileKey }, options })
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
          progress: { fileName: file.name, percent: current.progress, label: current.stage ?? copy.dropzone.processing },
        })
      }
      if (current.status === 'completed') {
        const payload = await getJobResult<ConvertResult>(current.jobId)
        setResult({ ...payload.result, downloadUrl: resolveApiUrl(payload.result.downloadUrl) })
        setTransfer({ status: 'success', progress: { fileName: file.name, percent: 100, label: copy.dropzone.completed } })
      } else if (current.status === 'failed') {
        setError(workflowMessage(errorFromJob(current.error), copy.errors))
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

  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        {(file == null || busy) && (
          <FileDropzone
            accept={tool.acceptedFormats ?? []}
            maxFiles={1}
            maxFileSize={100 * 1024 * 1024}
            status={transfer.status}
            progress={transfer.progress}
            disabled={busy}
            onFilesSelected={chooseFiles}
          />
        )}
        {file && !busy && (
          <SelectedFiles
            files={[file]}
            accept={tool.acceptedFormats ?? []}
            maxFileSize={100 * 1024 * 1024}
            disabled={busy}
            onReplace={(next) => chooseFiles(next)}
            onRemove={() => chooseFiles([])}
          />
        )}
        {file && inputPreviewUrl && (
          <MediaPreview
            src={inputPreviewUrl}
            kind={previewKind(file, tool.category)}
            label="Input preview"
          />
        )}
        <label className="field">
          <span>Output format</span>
          <select value={format} onChange={(event) => {
            const next = event.target.value as AudioConvertFormat
            setFormat(next)
            setBitrate(defaultAudioBitrate(next))
          }}>
            {AUDIO_CONVERT_FORMATS.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>
        {!lossless && (
          <label className="field">
            <span>Bitrate</span>
            <select value={bitrate} onChange={(event) => setBitrate(event.target.value)}>
              {AUDIO_CONVERT_BITRATES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span>Sample rate</span>
          <select value={sampleRate === 'original' ? 'original' : String(sampleRate)} onChange={(event) => {
            const value = event.target.value
            setSampleRate(value === 'original' ? 'original' : Number(value))
          }}>
            <option value="original">Original</option>
            {AUDIO_CONVERT_RATES.map((rate) => <option key={rate} value={rate}>{rate} Hz</option>)}
          </select>
        </label>
        <label className="field">
          <span>Channels</span>
          <select value={channels === 'original' ? 'original' : String(channels)} onChange={(event) => {
            const value = event.target.value
            setChannels(value === 'original' ? 'original' : value === '1' ? 1 : 2)
          }}>
            <option value="original">Original</option>
            <option value="1">Mono</option>
            <option value="2">Stereo</option>
          </select>
        </label>
        <div className="button-row">
          <button className="button primary" type="button" disabled={!file || busy} onClick={run}>
            {busy && <LoaderCircle size={17}/>} Convert
          </button>
          {busy && <button className="button secondary" type="button" onClick={stop}><Square size={15}/> Cancel</button>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label"><span>Result</span><span className="badge">{job?.status ?? 'Ready'}</span></div>
        {job && <><p>{job.stage ?? job.status}</p><progress max="100" value={job.progress ?? undefined}/></>}
        {result && (
          <dl className="result-stats">
            <div><dt>Source</dt><dd>{result.sourceFormat ?? file?.type ?? '—'} · {formatBytes(result.sourceSize ?? file?.size ?? 0)}</dd></div>
            <div><dt>Output</dt><dd>{(result.outputFormat ?? format).toUpperCase()} · {formatBytes(result.outputSize ?? 0)}</dd></div>
            {result.duration != null && <div><dt>Duration</dt><dd>{formatDuration(result.duration)}</dd></div>}
          </dl>
        )}
        {result && <MediaPreview src={result.downloadUrl} kind="audio" label="Result preview" />}
        {result && <a className="button primary" href={result.downloadUrl} download={result.filename}><Download size={18}/> Download result</a>}
      </div>
    </section>
  )
}

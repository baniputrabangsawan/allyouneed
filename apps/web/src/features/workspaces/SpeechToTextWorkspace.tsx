import { LoaderCircle, Square } from 'lucide-react'
import { useCallback, useState } from 'react'
import { FileDropzone, type DropzoneProgress, type DropzoneStatus } from '../../components/file/FileDropzone'
import { useT } from '../../i18n'
import { completeUpload, createUpload, uploadFile } from '../../lib/api/files'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import { remoteJobPhase } from '../../lib/media/job-phase'
import { previewKind } from '../../lib/media/kind'
import { useObjectUrl } from '../../lib/media/object-url'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '../../lib/media/workflow-error'
import { restoreNoticeMessage, useToolFileSession } from '../../lib/storage/use-tool-file-session'
import type { ToolDefinition } from '../tools/tool-registry'
import { MediaPreview } from './MediaPreview'
import { SelectedFiles } from './SelectedFiles'
import { CopyButton, DownloadButton } from './workspace-ui'
import {
  STT_FORMATS,
  STT_LANGUAGES,
  defaultSpeechToTextOptions,
  formatSeconds,
  languageLabel,
  wordCount,
  type SttFormat,
} from './speech-options'

interface Transfer {
  status: DropzoneStatus
  progress: DropzoneProgress
}

interface TranscriptionResult {
  text: string
  srt: string
  vtt: string
  language?: string
  duration?: number
  processingTime?: number
  wordCount?: number
  characterCount?: number
  filename?: string
}

const idleTransfer: Transfer = { status: 'idle', progress: {} }

function isSttFormat(value: unknown): value is SttFormat {
  return value === 'txt' || value === 'srt' || value === 'vtt'
}

function transcriptionFromResult(payload: unknown): TranscriptionResult | null {
  if (!payload || typeof payload !== 'object') return null
  const next = payload as TranscriptionResult
  const text = typeof next.text === 'string' ? next.text.replace(/\r\n/g, '\n') : ''
  return {
    text,
    srt: typeof next.srt === 'string' ? next.srt : '',
    vtt: typeof next.vtt === 'string' ? next.vtt : '',
    ...(typeof next.language === 'string' ? { language: next.language } : {}),
    ...(typeof next.duration === 'number' ? { duration: next.duration } : {}),
    ...(typeof next.processingTime === 'number' ? { processingTime: next.processingTime } : {}),
    ...(typeof next.wordCount === 'number' ? { wordCount: next.wordCount } : {}),
    ...(typeof next.characterCount === 'number' ? { characterCount: next.characterCount } : {}),
    ...(typeof next.filename === 'string' ? { filename: next.filename } : {}),
  }
}

export function SpeechToTextWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const defaults = defaultSpeechToTextOptions()
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState(defaults.language)
  const [format, setFormat] = useState<SttFormat>(defaults.format as SttFormat)
  const [timestamps, setTimestamps] = useState(defaults.timestamps)
  const [job, setJob] = useState<Job | null>(null)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [transfer, setTransfer] = useState<Transfer>(idleTransfer)
  const inputPreviewUrl = useObjectUrl(file)
  const accept = tool.acceptedFormats ?? []
  const options = { language, format, timestamps }

  const applyFiles = useCallback((next: File[]) => {
    setFile(next[0] ?? null)
    setError('')
    setErrorCode(null)
    setResult(null)
    setJob(null)
    setTransfer(idleTransfer)
  }, [])

  const session = useToolFileSession({
    slug: tool.id,
    applyFiles,
    applyOptions: (next) => {
      if (typeof next.language === 'string') setLanguage(next.language)
      if (isSttFormat(next.format)) setFormat(next.format)
      if (typeof next.timestamps === 'boolean') setTimestamps(next.timestamps)
    },
    applyJob: (next) => {
      setJob(next)
      if (!next) {
        setTransfer(idleTransfer)
        return
      }
      if (next.status === 'queued' || next.status === 'processing') {
        setTransfer({
          status: 'processing',
          progress: { ...(file?.name ? { fileName: file.name } : {}), percent: next.progress, label: next.stage ?? copy.dropzone.processing },
        })
      } else if (next.status === 'completed') {
        setTransfer({ status: 'success', progress: { ...(file?.name ? { fileName: file.name } : {}), percent: 100, label: copy.dropzone.completed } })
      } else if (next.status === 'failed') {
        const failed = errorFromJob(next.error)
        setErrorCode(workflowErrorCode(failed))
        setError(workflowMessage(failed, copy.errors))
        setTransfer(idleTransfer)
      } else {
        setTransfer(idleTransfer)
      }
    },
    applyResult: (payload) => {
      const restored = transcriptionFromResult(payload)
      if (restored) setResult(restored)
    },
  })
  const restoreError = restoreNoticeMessage(session.notice, copy.errors)

  function chooseFiles(next: File[]) {
    session.setNotice(null)
    setFile(next[0] ?? null)
    setError('')
    setErrorCode(null)
    setResult(null)
    setJob(null)
    setTransfer(idleTransfer)
    if (next.length === 0) void session.clear()
    else void session.persist({ files: next, options })
  }

  async function run() {
    if (!file) return
    setError('')
    setErrorCode(null)
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
      void session.persistUploads([file], [uploaded.fileKey], options)
      setTransfer({ status: 'processing', progress: { fileName: file.name, percent: null, label: copy.dropzone.processing } })
      let current = await createJob({
        toolId: tool.id,
        input: { fileKey: uploaded.fileKey },
        options,
      })
      setJob(current)
      void session.persistJob(current.jobId)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 500)
        })
        current = await getJob(current.jobId)
        setJob(current)
        setTransfer({
          status: 'processing',
          progress: { fileName: file.name, percent: current.progress, label: current.stage ?? copy.dropzone.processing },
        })
      }
      if (current.status === 'completed') {
        const payload = await getJobResult<TranscriptionResult>(current.jobId)
        const restored = transcriptionFromResult(payload.result)
        if (restored) setResult(restored)
        setTransfer({ status: 'success', progress: { fileName: file.name, percent: 100, label: copy.dropzone.completed } })
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
  const labels = { auto: copy.workspace.languageAuto, en: copy.workspace.languageEnglish, id: copy.workspace.languageIndonesian }
  const words = result ? (result.wordCount ?? wordCount(result.text)) : 0
  const characters = result ? (result.characterCount ?? result.text.length) : 0
  const baseName = (file?.name ?? 'transcription').replace(/\.[^.]+$/, '') || 'transcription'

  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        {(file == null || busy) && (
          <FileDropzone
            accept={accept}
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
            accept={accept}
            maxFileSize={100 * 1024 * 1024}
            disabled={busy}
            onReplace={(next) => chooseFiles(next)}
            onRemove={() => chooseFiles([])}
          />
        )}
        {file && inputPreviewUrl && (
          <MediaPreview src={inputPreviewUrl} kind={previewKind(file, tool.category)} label="Input preview" />
        )}
        <p className="option-help" role="note">{copy.workspace.speechPrivacyNote}</p>
        <label className="field">
          <span>{copy.workspace.language}</span>
          <select aria-label={copy.workspace.language} value={language} onChange={(event) => {
            setLanguage(event.target.value)
            void session.persistOptions({ language: event.target.value, format, timestamps })
          }}>
            {STT_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>{copy.workspace[item.labelKey]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.outputFormat}</span>
          <select aria-label={copy.workspace.outputFormat} value={format} onChange={(event) => {
            const next = event.target.value as SttFormat
            setFormat(next)
            void session.persistOptions({ language, format: next, timestamps })
          }}>
            {STT_FORMATS.map((item) => (
              <option key={item.value} value={item.value}>{copy.workspace[item.labelKey]}</option>
            ))}
          </select>
        </label>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={timestamps}
            onChange={(event) => {
              setTimestamps(event.target.checked)
              void session.persistOptions({ language, format, timestamps: event.target.checked })
            }}
          />
          <span>{copy.workspace.includeTimestamps}</span>
        </label>
        <div className="button-row">
          <button className="button primary" type="button" disabled={!file || busy} onClick={() => void run()}>
            {busy && <LoaderCircle size={17} />} {copy.workspace.process}
          </button>
          {busy && (
            <button className="button secondary" type="button" onClick={() => void stop()}>
              <Square size={15} /> {copy.workspace.cancel}
            </button>
          )}
        </div>
        {restoreError && <p className="option-help" role="status">{restoreError}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label">
          <span>{copy.workspace.transcription}</span>
          <span className={`badge badge-${phase}`}>{phaseLabel}</span>
        </div>
        {phase === 'unavailable' && <p className="field-error" role="alert">{copy.errors.apiUnreachable}</p>}
        {job && (phase === 'processing' || phase === 'queued' || phase === 'completed') && (
          <>
            <p>{job.stage ?? phaseLabel}</p>
            <progress max="100" value={job.progress ?? (phase === 'completed' ? 100 : undefined)} />
          </>
        )}
        {result && (
          <>
            <dl className="result-stats">
              <div><dt>{copy.workspace.detectedLanguage}</dt><dd>{languageLabel(result.language, labels)}</dd></div>
              <div><dt>{copy.workspace.duration}</dt><dd>{formatSeconds(result.duration)}</dd></div>
              <div><dt>{copy.workspace.processingTime}</dt><dd>{formatSeconds(result.processingTime)}</dd></div>
              <div><dt>{copy.workspace.counts}</dt><dd>{copy.workspace.wordCount(words)} · {copy.workspace.characterCount(characters)}</dd></div>
            </dl>
            <div className="button-row">
              <CopyButton value={result.text} />
              <DownloadButton value={result.text} filename={`${baseName}.txt`} label={copy.workspace.downloadTxt} />
              <DownloadButton value={result.srt} filename={`${baseName}.srt`} type="application/x-subrip" label={copy.workspace.downloadSrt} />
              <DownloadButton value={result.vtt} filename={`${baseName}.vtt`} type="text/vtt" label={copy.workspace.downloadVtt} />
            </div>
            <pre className="extracted-text">{result.text}</pre>
          </>
        )}
      </div>
    </section>
  )
}

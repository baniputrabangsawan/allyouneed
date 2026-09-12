import { Download, LoaderCircle, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { resolveApiUrl } from '../../lib/api/client'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import { formatBytes } from '../../lib/format'
import { remoteJobPhase } from '../../lib/media/job-phase'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '../../lib/media/workflow-error'
import { useToolFileSession } from '../../lib/storage/use-tool-file-session'
import type { ToolDefinition } from '../tools/tool-registry'
import { MediaPreview } from './MediaPreview'
import {
  TTS_FORMATS,
  TTS_MAX_CHARS,
  TTS_SPEEDS,
  TTS_VOICES,
  defaultTextToSpeechOptions,
  formatSeconds,
  languageLabel,
  type TtsFormat,
} from './speech-options'

interface SpeechResult {
  downloadUrl: string
  filename: string
  voiceName?: string
  language?: string
  duration?: number
  size?: number
  format?: string
}

function isTtsFormat(value: unknown): value is TtsFormat {
  return value === 'mp3' || value === 'wav'
}

export function TextToSpeechWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const defaults = defaultTextToSpeechOptions()
  const [text, setText] = useState(defaults.text)
  const [voice, setVoice] = useState(defaults.voice)
  const [speed, setSpeed] = useState(defaults.speed)
  const [format, setFormat] = useState<TtsFormat>(defaults.format as TtsFormat)
  const [job, setJob] = useState<Job | null>(null)
  const [result, setResult] = useState<SpeechResult | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const selected = useMemo(() => TTS_VOICES.find((item) => item.value === voice) ?? TTS_VOICES[0], [voice])
  const options = { text, voice, language: selected.language, speed, format }

  const session = useToolFileSession({
    slug: tool.id,
    applyFiles: () => undefined,
    applyOptions: (next) => {
      if (typeof next.text === 'string') setText(next.text.slice(0, TTS_MAX_CHARS))
      if (typeof next.voice === 'string' && TTS_VOICES.some((item) => item.value === next.voice)) setVoice(next.voice)
      if (typeof next.speed === 'number') setSpeed(next.speed)
      if (isTtsFormat(next.format)) setFormat(next.format)
    },
    applyJob: (next) => setJob(next),
    applyResult: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const next = payload as SpeechResult
      if (typeof next.downloadUrl !== 'string') return
      setResult({
        ...next,
        downloadUrl: resolveApiUrl(next.downloadUrl),
        filename: next.filename,
      })
    },
  })

  function persistSpeechOptions(next: { text: string; voice: string; speed: number; format: TtsFormat }) {
    const language = TTS_VOICES.find((item) => item.value === next.voice)?.language ?? selected.language
    void session.persistOptions({ ...next, language })
  }

  async function run() {
    const value = text.trim()
    if (!value || busy) return
    if (value.length > TTS_MAX_CHARS) {
      setError(copy.errors.textTooLong)
      setErrorCode('TEXT_TOO_LONG')
      return
    }
    setError('')
    setErrorCode(null)
    setResult(null)
    setBusy(true)
    try {
      const submitted = { ...options, text: value }
      void session.persistOptions(submitted)
      let current = await createJob({
        toolId: tool.id,
        input: {},
        options: submitted,
      })
      setJob(current)
      void session.persistJob(current.jobId)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 500)
        })
        current = await getJob(current.jobId)
        setJob(current)
      }
      if (current.status === 'completed') {
        const payload = await getJobResult<SpeechResult>(current.jobId)
        setResult({
          ...payload.result,
          downloadUrl: resolveApiUrl(payload.result.downloadUrl),
          filename: payload.result.filename,
        })
      } else if (current.status === 'failed') {
        const failed = errorFromJob(current.error)
        setErrorCode(workflowErrorCode(failed))
        setError(workflowMessage(failed, copy.errors))
      }
    } catch (reason) {
      setErrorCode(workflowErrorCode(reason))
      setError(workflowMessage(reason, copy.errors))
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setBusy(false)
  }

  const processing = busy || job?.status === 'queued' || job?.status === 'processing'
  const phase = remoteJobPhase(busy ? 'processing' : 'idle', job, errorCode)
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
  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        <label className="field">
          <span>{copy.workspace.textToSpeak}</span>
          <textarea
            aria-label={copy.workspace.textToSpeak}
            rows={8}
            value={text}
            maxLength={TTS_MAX_CHARS}
            onChange={(event) => {
              const next = event.target.value.slice(0, TTS_MAX_CHARS)
              setText(next)
              persistSpeechOptions({ text: next, voice, speed, format })
            }}
          />
          <small>{copy.workspace.characterCount(text.length)} / {TTS_MAX_CHARS}</small>
        </label>
        <p className="option-help" role="note">{copy.workspace.speechPrivacyNote}</p>
        <label className="field">
          <span>{copy.workspace.voice}</span>
          <select aria-label={copy.workspace.voice} value={voice} onChange={(event) => {
            setVoice(event.target.value)
            persistSpeechOptions({ text, voice: event.target.value, speed, format })
          }}>
            {TTS_VOICES.map((item) => (
              <option key={item.value} value={item.value}>{copy.workspace[item.nameKey]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.language}</span>
          <select
            aria-label={copy.workspace.language}
            value={selected.language}
            onChange={(event) => {
              const next = TTS_VOICES.find((item) => item.language === event.target.value)
              if (next) {
                setVoice(next.value)
                persistSpeechOptions({ text, voice: next.value, speed, format })
              }
            }}
          >
            <option value="en">{copy.workspace.languageEnglish}</option>
            <option value="id">{copy.workspace.languageIndonesian}</option>
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.playbackSpeed}</span>
          <select aria-label={copy.workspace.playbackSpeed} value={speed} onChange={(event) => {
            const next = Number(event.target.value)
            setSpeed(next)
            persistSpeechOptions({ text, voice, speed: next, format })
          }}>
            {TTS_SPEEDS.map((item) => (
              <option key={item} value={item}>{item}x</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.outputFormat}</span>
          <select aria-label={copy.workspace.outputFormat} value={format} onChange={(event) => {
            const next = event.target.value as TtsFormat
            setFormat(next)
            persistSpeechOptions({ text, voice, speed, format: next })
          }}>
            {TTS_FORMATS.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button className="button primary" type="button" disabled={!text.trim() || processing} onClick={() => void run()}>
            {processing && <LoaderCircle size={17} />} {copy.workspace.process}
          </button>
          {processing && (
            <button className="button secondary" type="button" onClick={() => void stop()}>
              <Square size={15} /> {copy.workspace.cancel}
            </button>
          )}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label">
          <span>{copy.workspace.audioReady}</span>
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
              <div><dt>{copy.workspace.voice}</dt><dd>{result.voiceName ?? copy.workspace.voiceSarah}</dd></div>
              <div><dt>{copy.workspace.language}</dt><dd>{languageLabel(result.language, labels)}</dd></div>
              <div><dt>{copy.workspace.duration}</dt><dd>{formatSeconds(result.duration)}</dd></div>
              <div><dt>{copy.workspace.fileSize}</dt><dd>{formatBytes(result.size ?? 0)}</dd></div>
            </dl>
            <MediaPreview src={result.downloadUrl} kind="audio" label={copy.workspace.audioReady} />
            <a className="button primary" href={result.downloadUrl} download={result.filename}>
              <Download size={18} /> {copy.workspace.downloadResult}
            </a>
          </>
        )}
      </div>
    </section>
  )
}

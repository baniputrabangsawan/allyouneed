import { Download, LoaderCircle, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '../../i18n'
import { resolveApiUrl } from '../../lib/api/client'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import { getTtsCapabilities } from '../../lib/api/tts'
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
  shortLanguage,
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
  speed?: number
  style?: string
}

function isTtsFormat(value: unknown): value is TtsFormat {
  return value === 'mp3' || value === 'wav'
}

export function TextToSpeechWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const defaults = defaultTextToSpeechOptions()
  const [text, setText] = useState(defaults.text)
  const [language, setLanguage] = useState(defaults.language)
  const [voice, setVoice] = useState(defaults.voice)
  const [mode, setMode] = useState<'fast' | 'expressive'>('fast')
  const [style, setStyle] = useState('neutral')
  const [speed, setSpeed] = useState(defaults.speed)
  const [format, setFormat] = useState<TtsFormat>(defaults.format as TtsFormat)
  const [job, setJob] = useState<Job | null>(null)
  const [result, setResult] = useState<SpeechResult | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const capabilities = useQuery({ queryKey: ['tts-capabilities'], queryFn: () => getTtsCapabilities(), staleTime: 60_000, retry: false })
  const fallbackVoices = TTS_VOICES.map((item) => ({ id: item.value, name: item.label, language: item.language, provider: 'piper', model: item.value, styles: ['neutral'], available: true }))
  const voices = capabilities.data?.voices.filter((item) => item.available) ?? fallbackVoices
  const expressiveAvailable = voices.some((item) => item.provider === 'qwen3-tts' || item.provider === 'cosyvoice3')
  const languages = capabilities.data?.languages ?? Array.from(new Set(voices.map((item) => item.language)))
  const filteredVoices = useMemo(() => voices.filter((item) => item.language === language), [language, voices])
  const selected = filteredVoices.find((item) => item.id === voice) ?? filteredVoices[0] ?? voices[0]
  const styles = selected?.styles.length ? selected.styles : ['neutral']
  const activeStyle = styles.includes(style) ? style : styles[0] ?? 'neutral'
  const options = { text, voice: selected?.id ?? voice, language: selected?.language ?? language, mode, style: activeStyle, speed, format }

  useEffect(() => {
    const nextLanguage = languages.includes(language) ? language : languages[0]
    if (nextLanguage && nextLanguage !== language) {
      setLanguage(nextLanguage)
      return
    }
    const compatible = voices.filter((item) => item.language === (nextLanguage ?? language))
    if (compatible.length > 0 && !compatible.some((item) => item.id === voice)) {
      setVoice(compatible[0]!.id)
    }
  }, [language, languages, voice, voices])

  const session = useToolFileSession({
    slug: tool.id,
    applyFiles: () => undefined,
    applyOptions: (next) => {
      if (typeof next.text === 'string') setText(next.text.slice(0, TTS_MAX_CHARS))
      if (typeof next.language === 'string') setLanguage(next.language)
      if (typeof next.voice === 'string') setVoice(next.voice)
      if (next.mode === 'fast' || next.mode === 'expressive') setMode(next.mode)
      if (typeof next.style === 'string') setStyle(next.style)
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

  function persistSpeechOptions(next: { text: string; language: string; voice: string; mode: 'fast' | 'expressive'; style: string; speed: number; format: TtsFormat }) {
    void session.persistOptions(next)
  }

  async function run() {
    await processText(text.trim())
  }

  async function preview() {
    await processText((text.trim().match(/^(.{1,220}?[.!?…]+)(\s|$)/)?.[1] ?? text.trim().slice(0, 220)).trim())
  }

  async function processText(value: string) {
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
  const voiceUnavailable = voices.length === 0
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
              persistSpeechOptions({ text: next, language, voice, mode, style: activeStyle, speed, format })
            }}
          />
          <small>{copy.workspace.characterCount(text.length)} / {TTS_MAX_CHARS}</small>
        </label>
        <p className="option-help" role="note">{copy.workspace.speechPrivacyNote}</p>
        <label className="field">
          <span>TTS mode</span>
          <div className="segmented" role="radiogroup" aria-label="TTS mode">
            <button type="button" role="radio" aria-checked={mode === 'fast'} className={mode === 'fast' ? 'active' : ''} onClick={() => setMode('fast')}>Fast</button>
            <button type="button" role="radio" aria-checked={mode === 'expressive'} className={mode === 'expressive' ? 'active' : ''} disabled={!expressiveAvailable} onClick={() => setMode('expressive')}>Expressive</button>
          </div>
          {!expressiveAvailable && <small>Expressive TTS requires a verified local Qwen3-TTS or CosyVoice 3 model.</small>}
        </label>
        <label className="field">
          <span>{copy.workspace.voice}</span>
          <select aria-label={copy.workspace.voice} value={voice} onChange={(event) => {
            setVoice(event.target.value)
            persistSpeechOptions({ text, language, voice: event.target.value, mode, style: activeStyle, speed, format })
          }} disabled={voiceUnavailable}>
            {filteredVoices.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.language}</span>
          <select
            aria-label={copy.workspace.language}
            value={language}
            onChange={(event) => {
              const nextLanguage = event.target.value
              const nextVoice = voices.find((item) => item.language === nextLanguage)
              setLanguage(nextLanguage)
              if (nextVoice) setVoice(nextVoice.id)
              persistSpeechOptions({ text, language: nextLanguage, voice: nextVoice?.id ?? '', mode, style: nextVoice?.styles[0] ?? 'neutral', speed, format })
            }}
            disabled={languages.length === 0}
          >
            {languages.map((item) => (
              <option key={item} value={item}>{languageLabel(item, labels)}</option>
            ))}
          </select>
          {!languages.some((item) => shortLanguage(item) === 'id') && <small>Bahasa Indonesia is unavailable until an Indonesian TTS model is installed.</small>}
        </label>
        <label className="field">
          <span>Emotion / Speaking style</span>
          <select aria-label="Emotion / Speaking style" value={activeStyle} onChange={(event) => {
            setStyle(event.target.value)
            persistSpeechOptions({ text, language, voice, mode, style: event.target.value, speed, format })
          }}>
            {styles.map((item) => <option key={item} value={item}>{styleLabel(item)}</option>)}
          </select>
          {styles.length === 1 && styles[0] === 'neutral' && <small>This installed voice only supports neutral style.</small>}
        </label>
        <label className="field">
          <span>{copy.workspace.playbackSpeed}</span>
          <select aria-label={copy.workspace.playbackSpeed} value={speed} onChange={(event) => {
            const next = Number(event.target.value)
            setSpeed(next)
            persistSpeechOptions({ text, language, voice, mode, style: activeStyle, speed: next, format })
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
            persistSpeechOptions({ text, language, voice, mode, style: activeStyle, speed, format: next })
          }}>
            {TTS_FORMATS.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button className="button primary" type="button" disabled={!text.trim() || processing || voiceUnavailable} onClick={() => void run()}>
            {processing && <LoaderCircle size={17} />} {copy.workspace.process}
          </button>
          <button className="button secondary" type="button" disabled={!text.trim() || processing || voiceUnavailable} onClick={() => void preview()}>Preview voice</button>
          {processing && (
            <button className="button secondary" type="button" onClick={() => void stop()}>
              <Square size={15} /> {copy.workspace.cancel}
            </button>
          )}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {voiceUnavailable && <p className="field-error" role="alert">{copy.errors.modelUnavailable}</p>}
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
              <div><dt>{copy.workspace.playbackSpeed}</dt><dd>{result.speed ?? speed}x</dd></div>
              <div><dt>{copy.workspace.outputFormat}</dt><dd>{(result.format ?? format).toUpperCase()}</dd></div>
              <div><dt>Style</dt><dd>{styleLabel(result.style ?? activeStyle)}</dd></div>
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

function styleLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

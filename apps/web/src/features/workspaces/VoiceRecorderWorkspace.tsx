import { useEffect, useRef, useState } from 'react'
import { formatBytes } from './workspace-utils'
import {
  audioFormatLabel,
  elapsedRecordingMs,
  formatRecordingDuration,
  queryMicrophonePermission,
  recorderErrorMessage,
  recordingFilename,
  reduceVoiceRecorderPhase,
  resolveRecordingMime,
  selectRecorderMimeType,
  stopMediaTracks,
  supportsAudioRecording,
  supportsRecorderPause,
  type VoiceRecorderPhase,
} from './voice-recorder'

const phaseLabel: Record<VoiceRecorderPhase, string> = {
  idle: 'Idle',
  'requesting-permission': 'Requesting permission',
  recording: 'Recording',
  paused: 'Paused',
  completed: 'Completed',
  error: 'Error',
}

interface Preview {
  url: string
  mime: string
  filename: string
  size: number
}

export function VoiceRecorderWorkspace() {
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [tick, setTick] = useState(0)
  const [completedMs, setCompletedMs] = useState(0)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pauseSupported, setPauseSupported] = useState(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef = useRef('')
  const generationRef = useRef(0)
  const selectedMimeRef = useRef<string | undefined>(undefined)
  const clockRef = useRef({ startedAt: null as number | null, pausedTotalMs: 0, pauseStartedAt: null as number | null })

  function revokePreview() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ''
    setPreview(null)
  }

  function releaseStream() {
    stopMediaTracks(streamRef.current)
    streamRef.current = null
  }

  function stopRecorder() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() }
      catch { /* already stopped */ }
    }
  }

  function apply(event: Parameters<typeof reduceVoiceRecorderPhase>[1]) {
    setPhase((current) => reduceVoiceRecorderPhase(current, event))
  }

  useEffect(() => {
    if (!supportsAudioRecording()) {
      setError('Audio recording is not supported in this browser or insecure context.')
      apply('unsupported')
      return
    }
    const permissions = navigator.permissions
    void queryMicrophonePermission(permissions).then((permission) => {
      if (permission === 'denied') {
        setNote('Microphone permission is blocked. Enable it in the browser site settings, then start recording.')
      }
    })
  }, [])

  useEffect(() => () => {
    generationRef.current += 1
    stopRecorder()
    releaseStream()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => setTick(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [phase])

  const elapsed = phase === 'completed'
    ? completedMs
    : elapsedRecordingMs({ ...clockRef.current, now: tick || Date.now() })

  async function start() {
    if (!supportsAudioRecording()) {
      setError('Audio recording is not supported in this browser or insecure context.')
      apply('unsupported')
      return
    }
    const generation = generationRef.current + 1
    generationRef.current = generation
    stopRecorder()
    releaseStream()
    revokePreview()
    chunksRef.current = []
    clockRef.current = { startedAt: null, pausedTotalMs: 0, pauseStartedAt: null }
    setCompletedMs(0)
    setError('')
    setNote('')
    apply('start')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (generation !== generationRef.current) {
        stopMediaTracks(stream)
        return
      }
      streamRef.current = stream
      const selected = selectRecorderMimeType((type) => {
        try { return MediaRecorder.isTypeSupported(type) }
        catch { return false }
      })
      selectedMimeRef.current = selected
      const recorder = selected ? new MediaRecorder(stream, { mimeType: selected }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      setPauseSupported(supportsRecorderPause(recorder))
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        if (generation !== generationRef.current) return
        releaseStream()
        setError('Recording failed before a file could be created.')
        apply('empty')
      }
      recorder.onstop = () => {
        const mime = resolveRecordingMime(recorder.mimeType, chunksRef.current[0]?.type ?? '', selectedMimeRef.current ?? '')
        releaseStream()
        recorderRef.current = null
        if (generation !== generationRef.current) return
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        if (blob.size === 0) {
          setError('Recording produced no audio.')
          apply('empty')
          return
        }
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setPreview({ url, mime, filename: recordingFilename(mime), size: blob.size })
        setCompletedMs(elapsedRecordingMs({ ...clockRef.current, pauseStartedAt: null, now: Date.now() }))
        apply('stop')
      }
      recorder.start()
      clockRef.current = { startedAt: Date.now(), pausedTotalMs: 0, pauseStartedAt: null }
      setTick(Date.now())
      apply('permission-ok')
    } catch (reason) {
      if (generation !== generationRef.current) return
      releaseStream()
      setError(recorderErrorMessage(reason))
      apply('permission-fail')
    }
  }

  function pause() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording' || !supportsRecorderPause(recorder)) return
    recorder.pause()
    clockRef.current.pauseStartedAt = Date.now()
    apply('pause')
  }

  function resume() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    const pauseStartedAt = clockRef.current.pauseStartedAt
    if (pauseStartedAt !== null) clockRef.current.pausedTotalMs += Date.now() - pauseStartedAt
    clockRef.current.pauseStartedAt = null
    recorder.resume()
    setTick(Date.now())
    apply('resume')
  }
  function reset() {
    generationRef.current += 1
    stopRecorder()
    releaseStream()
    revokePreview()
    chunksRef.current = []
    clockRef.current = { startedAt: null, pausedTotalMs: 0, pauseStartedAt: null }
    setCompletedMs(0)
    setError('')
    setNote('')
    apply('reset')
  }

  return (
    <section className="workspace compact-workspace">
      <div className="result-card">
        <p>Recording stays in this browser. Microphone access is requested only when you start.</p>
        <div className="counter-stats" aria-live="polite">
          <div><strong>{formatRecordingDuration(elapsed)}</strong><span>Duration</span></div>
          <div><strong>{phaseLabel[phase]}</strong><span>Status</span></div>
        </div>
        {note && <p role="status">{note}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {preview && (
          <>
            <p>{audioFormatLabel(preview.mime)} · {formatBytes(preview.size)} · {preview.filename}</p>
            <audio className="recorder-preview" controls src={preview.url} aria-label="Recording preview" style={{ width: '100%' }}/>
          </>
        )}
        <div className="button-row">
          {(phase === 'idle' || phase === 'error') && (
            <button className="button primary" type="button" onClick={() => void start()}>
              Start recording
            </button>
          )}
          {phase === 'requesting-permission' && (
            <button className="button primary" type="button" disabled>Requesting permission</button>
          )}
          {phase === 'recording' && (
            <>
              {pauseSupported && <button className="button secondary" type="button" onClick={pause}>Pause</button>}
              <button className="button primary" type="button" onClick={stopRecorder}>Stop</button>
            </>
          )}
          {phase === 'paused' && (
            <>
              <button className="button primary" type="button" onClick={resume}>Resume</button>
              <button className="button secondary" type="button" onClick={stopRecorder}>Stop</button>
            </>
          )}
          {phase === 'completed' && preview && (
            <a className="button secondary" href={preview.url} download={preview.filename}>Download</a>
          )}
          {phase !== 'idle' && phase !== 'requesting-permission' && (
            <button className="button secondary" type="button" onClick={reset}>Reset</button>
          )}
        </div>
      </div>
    </section>
  )
}

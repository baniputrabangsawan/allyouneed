import { supportsMediaRecorder } from '@/lib/browser-capabilities'

export type VoiceRecorderPhase =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'paused'
  | 'completed'
  | 'error'

export type VoiceRecorderEvent =
  | 'start'
  | 'permission-ok'
  | 'permission-fail'
  | 'unsupported'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'empty'
  | 'reset'

export type MicrophonePermission = 'granted' | 'denied' | 'prompt' | 'unknown'

export const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
] as const

export function selectRecorderMimeType(isTypeSupported?: (type: string) => boolean): string | undefined {
  if (typeof isTypeSupported !== 'function') return undefined
  return RECORDER_MIME_CANDIDATES.find((type) => {
    try { return isTypeSupported(type) }
    catch { return false }
  })
}

export function audioExtensionForMime(mime: string): string {
  const type = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'mp3'
  if (type === 'audio/mp4' || type === 'audio/aac' || type === 'audio/x-m4a') return 'm4a'
  if (type === 'audio/ogg' || type === 'audio/opus') return 'ogg'
  if (type === 'audio/wav' || type === 'audio/wave' || type === 'audio/x-wav') return 'wav'
  return 'webm'
}

export function audioFormatLabel(mime: string): string {
  const extension = audioExtensionForMime(mime)
  if (extension === 'mp3') return 'MP3'
  if (extension === 'm4a') return 'M4A'
  if (extension === 'ogg') return 'Ogg'
  if (extension === 'wav') return 'WAV'
  return 'WebM'
}

export function recordingFilename(mime: string, at: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  return `recording-${stamp}.${audioExtensionForMime(mime)}`
}

export function formatRecordingDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function elapsedRecordingMs(input: {
  startedAt: number | null
  pausedTotalMs: number
  pauseStartedAt: number | null
  now: number
}): number {
  if (input.startedAt === null) return 0
  const currentPause = input.pauseStartedAt === null ? 0 : Math.max(0, input.now - input.pauseStartedAt)
  return Math.max(0, input.now - input.startedAt - input.pausedTotalMs - currentPause)
}

export function reduceVoiceRecorderPhase(phase: VoiceRecorderPhase, event: VoiceRecorderEvent): VoiceRecorderPhase {
  switch (event) {
    case 'start':
      return phase === 'idle' || phase === 'error' || phase === 'completed' ? 'requesting-permission' : phase
    case 'permission-ok':
      return phase === 'requesting-permission' ? 'recording' : phase
    case 'permission-fail':
    case 'unsupported':
      return phase === 'idle' || phase === 'requesting-permission' ? 'error' : phase
    case 'pause':
      return phase === 'recording' ? 'paused' : phase
    case 'resume':
      return phase === 'paused' ? 'recording' : phase
    case 'stop':
      return phase === 'recording' || phase === 'paused' ? 'completed' : phase
    case 'empty':
      return phase === 'recording' || phase === 'paused' || phase === 'completed' ? 'error' : phase
    case 'reset':
      return 'idle'
  }
}

export function recorderErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow microphone access to record.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect a microphone and try again.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is in use by another application.'
  }
  if (name === 'SecurityError') {
    return 'Audio recording is not allowed in this context. Use a secure (HTTPS) page.'
  }
  if (name === 'AbortError') {
    return 'Microphone access was interrupted.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Could not start recording.'
}

export function supportsAudioRecording(scope: object = globalThis): boolean {
  if (!supportsMediaRecorder(scope)) return false
  const navigatorValue: unknown = Reflect.get(scope, 'navigator')
  if (typeof navigatorValue !== 'object' || navigatorValue === null) return false
  const mediaDevices: unknown = Reflect.get(navigatorValue, 'mediaDevices')
  if (typeof mediaDevices !== 'object' || mediaDevices === null) return false
  return typeof Reflect.get(mediaDevices, 'getUserMedia') === 'function'
}

export function supportsRecorderPause(recorder: { pause?: unknown } | null | undefined): boolean {
  return typeof recorder?.pause === 'function'
}

export function stopMediaTracks(stream: { getTracks(): Array<{ stop(): void }> } | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function resolveRecordingMime(recorderMime: string, blobType: string, selectedMime?: string): string {
  return recorderMime || blobType || selectedMime || 'audio/webm'
}

export async function queryMicrophonePermission(
  permissions?: { query(descriptor: { name: string }): Promise<{ state: string }> } | null,
): Promise<MicrophonePermission> {
  if (!permissions?.query) return 'unknown'
  try {
    const status = await permissions.query({ name: 'microphone' })
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') return status.state
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

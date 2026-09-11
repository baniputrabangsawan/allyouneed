import { describe, expect, it } from 'vitest'
import {
  audioExtensionForMime,
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

describe('recorder MIME selection', () => {
  it('picks the first browser-supported candidate and never defaults to MP3', () => {
    expect(selectRecorderMimeType((type) => type === 'audio/webm' || type === 'audio/mpeg')).toBe('audio/webm')
    expect(selectRecorderMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4')
    expect(selectRecorderMimeType((type) => type === 'audio/mpeg')).toBe('audio/mpeg')
    expect(selectRecorderMimeType(() => false)).toBeUndefined()
    expect(selectRecorderMimeType()).toBeUndefined()
  })

  it('maps extensions and labels from the actual container, claiming MP3 only for MPEG', () => {
    expect(audioExtensionForMime('audio/webm;codecs=opus')).toBe('webm')
    expect(audioFormatLabel('audio/webm;codecs=opus')).toBe('WebM')
    expect(audioExtensionForMime('audio/ogg;codecs=opus')).toBe('ogg')
    expect(audioExtensionForMime('audio/mp4')).toBe('m4a')
    expect(audioFormatLabel('audio/mp4')).toBe('M4A')
    expect(audioExtensionForMime('audio/mpeg')).toBe('mp3')
    expect(audioFormatLabel('audio/mpeg')).toBe('MP3')
    expect(audioExtensionForMime('')).toBe('webm')
    expect(audioFormatLabel('application/octet-stream')).toBe('WebM')
  })

  it('builds a timestamped filename from the real MIME type', () => {
    expect(recordingFilename('audio/webm;codecs=opus', new Date(2026, 8, 11, 15, 4, 5))).toBe('recording-20260911-150405.webm')
    expect(recordingFilename('audio/mpeg', new Date(2026, 0, 2, 3, 4, 5))).toBe('recording-20260102-030405.mp3')
  })

  it('resolves the recorded MIME without inventing MP3', () => {
    expect(resolveRecordingMime('audio/webm;codecs=opus', '', 'audio/mpeg')).toBe('audio/webm;codecs=opus')
    expect(resolveRecordingMime('', 'audio/mp4', undefined)).toBe('audio/mp4')
    expect(resolveRecordingMime('', '', undefined)).toBe('audio/webm')
  })
})

describe('recorder state helpers', () => {
  it('advances through the recording session and resets to idle', () => {
    const play = (phase: VoiceRecorderPhase, events: Parameters<typeof reduceVoiceRecorderPhase>[1][]) =>
      events.reduce(reduceVoiceRecorderPhase, phase)
    expect(play('idle', ['start', 'permission-ok', 'pause', 'resume', 'stop'])).toBe('completed')
    expect(play('idle', ['start', 'permission-fail'])).toBe('error')
    expect(play('idle', ['unsupported'])).toBe('error')
    expect(play('recording', ['empty'])).toBe('error')
    expect(play('completed', ['reset'])).toBe('idle')
    expect(play('recording', ['start'])).toBe('recording')
    expect(play('paused', ['pause'])).toBe('paused')
  })

  it('formats duration and excludes paused time from elapsed recording', () => {
    expect(formatRecordingDuration(0)).toBe('0:00')
    expect(formatRecordingDuration(65_400)).toBe('1:05')
    expect(formatRecordingDuration(3_661_000)).toBe('1:01:01')
    expect(elapsedRecordingMs({ startedAt: null, pausedTotalMs: 0, pauseStartedAt: null, now: 9_000 })).toBe(0)
    expect(elapsedRecordingMs({ startedAt: 1_000, pausedTotalMs: 200, pauseStartedAt: null, now: 2_000 })).toBe(800)
    expect(elapsedRecordingMs({ startedAt: 1_000, pausedTotalMs: 200, pauseStartedAt: 1_800, now: 2_000 })).toBe(600)
  })

  it('maps permission and device failures without exposing a stack', () => {
    expect(recorderErrorMessage(Object.assign(new Error('denied'), { name: 'NotAllowedError' })))
      .toContain('permission was denied')
    expect(recorderErrorMessage(Object.assign(new Error('missing'), { name: 'NotFoundError' })))
      .toContain('No microphone')
    expect(recorderErrorMessage(Object.assign(new Error('blocked'), { name: 'SecurityError' })))
      .toContain('secure')
    expect(recorderErrorMessage('nope')).toBe('Could not start recording.')
  })

  it('detects recording capability, pause support, and stops tracks', () => {
    expect(supportsAudioRecording({
      MediaRecorder: class {},
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    })).toBe(true)
    expect(supportsAudioRecording({ MediaRecorder: class {}, navigator: {} })).toBe(false)
    expect(supportsRecorderPause({ pause: () => undefined })).toBe(true)
    expect(supportsRecorderPause({})).toBe(false)
    const stops: string[] = []
    stopMediaTracks({ getTracks: () => [{ stop: () => stops.push('a') }, { stop: () => stops.push('b') }] })
    expect(stops).toEqual(['a', 'b'])
    expect(() => stopMediaTracks(null)).not.toThrow()
  })

  it('queries microphone permission without requesting it', async () => {
    expect(await queryMicrophonePermission(null)).toBe('unknown')
    expect(await queryMicrophonePermission({ query: async () => ({ state: 'denied' }) })).toBe('denied')
    expect(await queryMicrophonePermission({ query: async () => { throw new Error('unsupported') } })).toBe('unknown')
  })
})

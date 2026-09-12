import { describe, expect, it } from 'vitest'
import { fileMatchesMediaAccept } from './accept'
import { AUDIO_ACCEPT } from './formats'
import { normalizeMimeType } from './mime'

function file(name: string, type: string) {
  return { name, type, size: 1024 }
}

describe('normalizeMimeType', () => {
  it('strips codec parameters', () => {
    expect(normalizeMimeType('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(normalizeMimeType('video/webm;codecs=vp8,opus')).toBe('video/webm')
  })
})

describe('audio container accept', () => {
  it('accepts audio/webm', () => {
    expect(fileMatchesMediaAccept(file('recording.webm', 'audio/webm'), AUDIO_ACCEPT)).toBe(true)
  })

  it('accepts audio/webm with codecs', () => {
    expect(fileMatchesMediaAccept(file('recording.webm', 'audio/webm;codecs=opus'), AUDIO_ACCEPT)).toBe(true)
  })

  it('accepts video/webm for server audio probe', () => {
    expect(fileMatchesMediaAccept(file('recording.webm', 'video/webm'), AUDIO_ACCEPT)).toBe(true)
  })

  it('accepts empty MIME when extension is webm', () => {
    expect(fileMatchesMediaAccept(file('recording.webm', ''), AUDIO_ACCEPT)).toBe(true)
  })

  it('accepts application/octet-stream when extension is webm', () => {
    expect(fileMatchesMediaAccept(file('recording.webm', 'application/octet-stream'), AUDIO_ACCEPT)).toBe(true)
  })

  it('rejects octet-stream with an unsupported extension', () => {
    expect(fileMatchesMediaAccept(file('malware.exe', 'application/octet-stream'), AUDIO_ACCEPT)).toBe(false)
  })
})

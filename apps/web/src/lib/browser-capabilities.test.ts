import { describe, expect, it } from 'vitest'
import { getBrowserCapabilities, supportsWebSpeech } from './browser-capabilities'

describe('browser capabilities', () => {
  it('detects supported APIs without requiring a browser global', () => {
    const scope = {
      OffscreenCanvas: class {},
      Worker: class {},
      MediaRecorder: class {},
      navigator: { clipboard: { writeText: () => undefined } },
    }

    expect(getBrowserCapabilities(scope)).toEqual({
      offscreenCanvas: true,
      webWorkers: true,
      webSpeech: false,
      mediaRecorder: true,
      clipboard: true,
    })
  })

  it('supports the prefixed speech recognition API', () => {
    expect(supportsWebSpeech({ webkitSpeechRecognition: class {} })).toBe(true)
  })
})

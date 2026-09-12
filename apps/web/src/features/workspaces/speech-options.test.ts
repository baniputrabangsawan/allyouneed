import { describe, expect, it } from 'vitest'
import {
  defaultSpeechToTextOptions,
  defaultTextToSpeechOptions,
  formatSeconds,
  languageLabel,
  TTS_MAX_CHARS,
  TTS_SPEEDS,
  TTS_VOICES,
  wordCount,
} from './speech-options'

const labels = { auto: 'Auto detect', en: 'English', id: 'Bahasa Indonesia' }

describe('speech options', () => {
  it('defaults to auto language, plain text, installed Piper voice, and MP3', () => {
    expect(defaultSpeechToTextOptions()).toEqual({ language: 'auto', format: 'txt', timestamps: false })
    expect(defaultTextToSpeechOptions()).toEqual({
      text: '',
      voice: 'en_US-lessac-medium',
      language: 'en-US',
      speed: 1,
      format: 'mp3',
    })
    expect(TTS_MAX_CHARS).toBe(5000)
    expect(TTS_SPEEDS).toEqual([0.75, 1, 1.25, 1.5])
    expect(TTS_VOICES.map((voice) => voice.value)).toEqual(['en_US-lessac-medium'])
  })

  it('counts words and formats durations without exposing model ids', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('  Hello from Kits.  ')).toBe(3)
    expect(formatSeconds(undefined)).toBe('—')
    expect(formatSeconds(1.5)).toBe('1.5s')
    expect(formatSeconds(75.2)).toBe('1m 15.2s')
    expect(languageLabel('auto', labels)).toBe(labels.auto)
    expect(languageLabel('en-US', labels)).toBe(labels.en)
    expect(languageLabel('id', labels)).toBe(labels.id)
    expect(TTS_VOICES.every((voice) => voice.value.includes('_'))).toBe(true)
  })
})

export const STT_LANGUAGES = [
  { value: 'auto', labelKey: 'languageAuto' },
  { value: 'en', labelKey: 'languageEnglish' },
  { value: 'id', labelKey: 'languageIndonesian' },
] as const

export const STT_FORMATS = [
  { value: 'txt', labelKey: 'plainText' },
  { value: 'srt', labelKey: 'srt' },
  { value: 'vtt', labelKey: 'vtt' },
] as const

export const TTS_VOICES = [
  { value: 'en_US-lessac-medium', label: 'Lessac Medium', language: 'en-US' },
] as const

export const TTS_SPEEDS = [0.75, 1, 1.25, 1.5] as const
export const TTS_FORMATS = ['mp3', 'wav'] as const
export const TTS_MAX_CHARS = 5000

export type SttFormat = (typeof STT_FORMATS)[number]['value']
export type TtsFormat = (typeof TTS_FORMATS)[number]

export function defaultSpeechToTextOptions() {
  return { language: 'auto', format: 'txt', timestamps: false }
}

export function defaultTextToSpeechOptions() {
  return { text: '', voice: 'en_US-lessac-medium', language: 'en-US', speed: 1, format: 'mp3' }
}

export function languageLabel(code: string | undefined, labels: { auto: string; en: string; id: string }): string {
  if (!code || code === 'und' || code === 'auto') return labels.auto
  if (code === 'en' || code.startsWith('en')) return labels.en
  if (code === 'id' || code.startsWith('id')) return labels.id
  return code
}

export function shortLanguage(code: string | undefined): string {
  if (!code) return ''
  if (code.startsWith('en')) return 'en'
  if (code.startsWith('id')) return 'id'
  return code
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

export function formatSeconds(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}m ${secs}s`
}

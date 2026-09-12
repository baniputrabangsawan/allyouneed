export const AUDIO_CONVERT_FORMATS = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus'] as const
export type AudioConvertFormat = (typeof AUDIO_CONVERT_FORMATS)[number]

export const AUDIO_CONVERT_BITRATES = ['64k', '96k', '128k', '192k', '256k', '320k'] as const
export const AUDIO_CONVERT_RATES = [22050, 44100, 48000] as const

const LOSSLESS = new Set<AudioConvertFormat>(['wav', 'flac'])

export function isLosslessAudioFormat(format: AudioConvertFormat) {
  return LOSSLESS.has(format)
}

export function defaultAudioBitrate(format: AudioConvertFormat) {
  if (format === 'ogg' || format === 'opus') return '128k'
  return '192k'
}

export function buildAudioConvertOptions(input: {
  format: AudioConvertFormat
  bitrate: string
  sampleRate: 'original' | number
  channels: 'original' | 1 | 2
}) {
  const options: Record<string, string | number> = { format: input.format }
  if (!isLosslessAudioFormat(input.format)) options.bitrate = input.bitrate
  if (input.sampleRate !== 'original') options.sampleRate = input.sampleRate
  if (input.channels !== 'original') options.channels = input.channels
  return options
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDuration(seconds: number) {
  const value = Math.max(0, seconds)
  const mins = Math.floor(value / 60)
  const secs = (value % 60).toFixed(1)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

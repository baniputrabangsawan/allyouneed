export interface MediaFormat {
  extensions: readonly string[]
  mimeTypes: readonly string[]
}

export const MEDIA_FORMATS = {
  mp3: { extensions: ['.mp3'], mimeTypes: ['audio/mpeg', 'audio/mp3'] },
  wav: { extensions: ['.wav'], mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave'] },
  m4a: { extensions: ['.m4a'], mimeTypes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'] },
  aac: { extensions: ['.aac'], mimeTypes: ['audio/aac'] },
  ogg: { extensions: ['.ogg', '.oga'], mimeTypes: ['audio/ogg'] },
  opus: { extensions: ['.opus'], mimeTypes: ['audio/opus', 'audio/ogg'] },
  flac: { extensions: ['.flac'], mimeTypes: ['audio/flac', 'audio/x-flac'] },
  webm: { extensions: ['.webm'], mimeTypes: ['audio/webm', 'video/webm'] },
  mp4: { extensions: ['.mp4', '.m4v'], mimeTypes: ['video/mp4'] },
  mov: { extensions: ['.mov', '.qt'], mimeTypes: ['video/quicktime'] },
  gif: { extensions: ['.gif'], mimeTypes: ['image/gif'] },
  jpeg: { extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg', 'image/jpg'] },
  png: { extensions: ['.png'], mimeTypes: ['image/png'] },
  webp: { extensions: ['.webp'], mimeTypes: ['image/webp'] },
  avif: { extensions: ['.avif'], mimeTypes: ['image/avif'] },
  svg: { extensions: ['.svg'], mimeTypes: ['image/svg+xml'] },
  pdf: { extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
} as const satisfies Record<string, MediaFormat>

export type MediaFormatId = keyof typeof MEDIA_FORMATS

export const AUDIO_FORMAT_IDS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'webm'] as const
export const VIDEO_FORMAT_IDS = ['mp4', 'webm', 'mov', 'gif'] as const

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function formatTokens(ids: readonly MediaFormatId[]): string[] {
  const tokens: string[] = []
  for (const id of ids) {
    const format = MEDIA_FORMATS[id]
    tokens.push(...format.mimeTypes, ...format.extensions)
  }
  return unique(tokens)
}

export const AUDIO_ACCEPT = formatTokens(AUDIO_FORMAT_IDS)
export const VIDEO_ACCEPT = formatTokens(VIDEO_FORMAT_IDS)

export function formatsMatchingToken(token: string): MediaFormat[] {
  const key = token.trim().toLowerCase()
  if (!key) return []
  return (Object.values(MEDIA_FORMATS) as MediaFormat[]).filter((format) =>
    (format.extensions as readonly string[]).includes(key) || (format.mimeTypes as readonly string[]).includes(key),
  )
}

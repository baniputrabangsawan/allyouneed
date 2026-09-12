export type MediaKind = 'audio' | 'video'

const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv)$/i

export function mediaKindFromFile(file: File): MediaKind | null {
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  const name = file.name
  if (AUDIO_EXT.test(name)) return 'audio'
  if (VIDEO_EXT.test(name)) return 'video'
  if (name.toLowerCase().endsWith('.webm')) return 'audio'
  return null
}

const SUBTITLE_EXT = /\.(srt|vtt|ass|ssa)$/i

export function isSubtitleFile(file: File): boolean {
  if (SUBTITLE_EXT.test(file.name)) return true
  const type = file.type.trim().toLowerCase()
  return type === 'text/vtt'
    || type === 'application/x-subrip'
    || type === 'text/x-subrip'
    || type === 'application/x-ass'
    || type === 'text/x-ass'
    || type === 'text/x-ssa'
}

export function previewKind(file: File, category?: string): MediaKind {
  if (category === 'audio') return 'audio'
  return mediaKindFromFile(file) ?? (category === 'video' ? 'video' : 'audio')
}

export function resultMediaKind(tool: { category: string; slug: string }): MediaKind | null {
  if (tool.slug === 'generate-thumbnail' || tool.slug === 'video-screenshot' || tool.slug === 'video-metadata-viewer') {
    return null
  }
  if (tool.slug === 'extract-audio' || tool.slug === 'extract-audio-from-video') return 'audio'
  if (tool.slug === 'speech-to-text') return null
  if (tool.category === 'audio') return 'audio'
  if (tool.category === 'video') return 'video'
  return null
}

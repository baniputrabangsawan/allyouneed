const LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/mp3': 'MP3',
  '.mp3': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/wave': 'WAV',
  '.wav': 'WAV',
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
  'audio/m4a': 'M4A',
  '.m4a': 'M4A',
  'audio/aac': 'AAC',
  '.aac': 'AAC',
  'audio/ogg': 'OGG',
  '.ogg': 'OGG',
  '.oga': 'OGG',
  'audio/webm': 'WebM',
  'video/webm': 'WebM',
  '.webm': 'WebM',
  'audio/flac': 'FLAC',
  'audio/x-flac': 'FLAC',
  '.flac': 'FLAC',
  'audio/opus': 'Opus',
  '.opus': 'Opus',
  'video/mp4': 'MP4',
  '.mp4': 'MP4',
  '.m4v': 'MP4',
  'video/quicktime': 'MOV',
  '.mov': 'MOV',
  '.qt': 'MOV',
  'video/x-matroska': 'MKV',
  'video/mkv': 'MKV',
  '.mkv': 'MKV',
  'text/vtt': 'VTT',
  '.vtt': 'VTT',
  'application/x-subrip': 'SRT',
  'text/x-subrip': 'SRT',
  '.srt': 'SRT',
  'application/x-ass': 'ASS',
  'text/x-ass': 'ASS',
  '.ass': 'ASS',
  'text/x-ssa': 'SSA',
  '.ssa': 'SSA',
  'image/gif': 'GIF',
  '.gif': 'GIF',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/svg+xml': 'SVG',
  'application/pdf': 'PDF',
  'text/html': 'HTML',
  'text/plain': 'TXT',
}

export function formatAcceptLabel(type: string): string {
  const key = type.trim().toLowerCase()
  if (LABELS[key]) return LABELS[key]
  if (key.startsWith('.')) return key.slice(1).toUpperCase()
  const subtype = key.split('/')[1]
  if (!subtype) return type.toUpperCase()
  return subtype.replace(/^x-/, '').toUpperCase()
}

export function formatAcceptLabels(accept: readonly string[]): string[] {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const type of accept) {
    const label = formatAcceptLabel(type)
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  return labels
}

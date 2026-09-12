export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const VOLUME_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const
export const ROTATIONS = [90, 180, 270] as const
export const AUDIO_BITRATES = ['64k', '96k', '128k', '192k', '256k'] as const
export const VIDEO_CRFS = [18, 23, 28, 32] as const

const defaultOptions: Record<string, Record<string, unknown>> = {
  'split-pdf': { pages: [1] },
  'delete-pdf-pages': { pages: [1] },
  'extract-pdf-pages': { pages: [1] },
  'reorder-pdf-pages': { pages: [1] },
  'protect-pdf': { password: '' },
  'unlock-pdf': { password: '' },
  'watermark-pdf': { text: 'Watermark' },
  'rotate-pdf': { rotation: 90 },
  'resize-video': { width: 640, height: 360 },
  'crop-video': { width: 320, height: 180 },
  'change-volume': { volume: 1 },
  'change-audio-speed': { speed: 1 },
  'change-video-speed': { speed: 1 },
  'add-watermark': { text: 'Watermark' },
  'blur-face': { mode: 'blur', strength: 8 },
  'noise-reduction': { strength: 'medium' },
  'add-subtitle': { mode: 'burn', format: 'mp4' },
  'audio-cutter': { start: 0, duration: 10 },
  'audio-trimmer': { start: 0, duration: 10 },
  'video-cutter': { start: 0, duration: 10 },
  'video-trimmer': { start: 0, duration: 10 },
  'audio-compressor': { bitrate: '128k' },
  'video-compressor': { crf: 28 },
}

export function defaultRemoteOptions(toolId: string): Record<string, unknown> {
  return { ...(defaultOptions[toolId] ?? {}) }
}

export function parsePageList(raw: string): number[] {
  const pages = new Set<number>()
  for (const part of raw.split(',')) {
    const token = part.trim()
    if (!token) continue
    const range = token.split('-').map((item) => item.trim())
    if (range.length === 2) {
      const start = Number(range[0])
      const end = Number(range[1])
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue
      for (let page = start; page <= end; page += 1) pages.add(page)
    } else {
      const page = Number(token)
      if (Number.isInteger(page) && page >= 1) pages.add(page)
    }
  }
  return [...pages].sort((left, right) => left - right)
}

export function formatPageList(pages: unknown): string {
  if (!Array.isArray(pages)) return ''
  return pages.filter((page): page is number => typeof page === 'number' && Number.isInteger(page) && page >= 1).join(', ')
}


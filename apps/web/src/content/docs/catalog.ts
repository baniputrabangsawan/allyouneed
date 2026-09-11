import Fuse from 'fuse.js'
import {
  getRelatedTools,
  tools,
  type ToolCategory,
  type ToolDefinition,
} from '@/features/tools/tool-registry'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n'
import { toolGuidesId } from '@/i18n/guides-id'
import { toolsId } from '@/i18n/tools-id'
import { docsArticles } from './articles'
import { toolGuides } from './tool-guides'
import { docsCategoryCopy, type ToolGuide } from './types'


export const toolGuideToc = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-to', label: 'How to use' },
  { id: 'inputs', label: 'Accepted inputs' },
  { id: 'options', label: 'Options' },
  { id: 'output', label: 'Output' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'limits', label: 'Limits' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
] as const
const mimeLabels: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'application/pdf': 'PDF',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/mp4': 'M4A',
  'audio/ogg': 'Ogg',
  'audio/webm': 'WebM',
  'video/mp4': 'MP4',
  'video/webm': 'WebM',
  'video/quicktime': 'QuickTime',
}

export function formatMimeList(values: readonly string[] | undefined) {
  if (!values?.length) return []
  return values.map((value) => mimeLabels[value] ?? value)
}

function fallbackSteps(tool: ToolDefinition, locale: Locale): string[] {
  const copy = getMessages(locale)
  const name = locale === 'id' ? (toolsId[tool.slug]?.name ?? tool.name) : tool.name
  if (tool.implementation === 'qr-code') {
    return [copy.docs.fallbackOpen, copy.docs.fallbackQrFields, copy.docs.fallbackQrGenerate, copy.docs.fallbackQrDownload]
  }
  if (tool.implementation === 'remote-api') {
    return [copy.docs.fallbackOpen, copy.docs.fallbackAddFiles, copy.docs.fallbackJson, copy.docs.fallbackWait, copy.docs.fallbackDownload]
  }
  if (tool.implementation === 'browser-media') {
    return [copy.docs.fallbackOpen, copy.docs.fallbackMedia, copy.docs.fallbackPreview, copy.docs.fallbackCapture]
  }
  if (tool.implementation === 'image-canvas') {
    return [copy.docs.fallbackOpen, copy.docs.fallbackAddImage, copy.docs.fallbackAdjust, copy.docs.fallbackProcess]
  }
  return [copy.docs.fallbackOpen, copy.docs.fallbackAddText, copy.docs.fallbackRun(name), copy.docs.fallbackCopy]
}

export function resolveToolGuide(tool: ToolDefinition, locale: Locale = 'en'): ToolGuide | null {
  if (!tool.available) return null
  const idGuide = toolGuidesId[tool.slug]
  const enGuide = toolGuides[tool.slug]
  if (locale === 'id' && idGuide) return idGuide
  if (locale === 'en' && enGuide) return enGuide
  const copy = getMessages(locale)
  const overview = locale === 'id' ? (toolsId[tool.slug]?.shortDescription ?? tool.description) : tool.description
  return {
    slug: tool.slug,
    overview,
    steps: fallbackSteps(tool, locale),
    ...(tool.outputFormats?.length
      ? { output: copy.docs.outputFormats(formatMimeList(tool.outputFormats).join(', ')) }
      : {}),
    keywords: tool.tags,
  }
}

export function processingLabel(tool: ToolDefinition) {
  if (tool.processingMode === 'client') return 'Client-side'
  if (tool.processingMode === 'hybrid') return 'Hybrid'
  return 'Server processing'
}

export function planLabel(tool: ToolDefinition) {
  return tool.accessTier === 'pro' || tool.premium ? 'Pro' : 'Free'
}

export const docsCategoryOrder: ToolCategory[] = [
  'image', 'pdf', 'audio', 'video', 'qr', 'developer', 'text', 'generator', 'converter',
]

export function docsCategoryStats() {
  return docsCategoryOrder.map((category) => {
    const items = tools.filter((tool) => tool.category === category)
    return {
      category,
      description: docsCategoryCopy[category] ?? '',
      total: items.length,
      documented: items.filter((tool) => tool.available).length,
    }
  })
}

export function docsSidebarGroups() {
  return docsCategoryOrder.map((category) => ({
    category,
    tools: tools.filter((tool) => tool.category === category),
  }))
}

export function docsNeighbors(slug: string) {
  const list = tools
  const index = list.findIndex((tool) => tool.slug === slug)
  if (index < 0) return { previous: undefined, next: undefined }
  return {
    previous: index > 0 ? list[index - 1] : undefined,
    next: index < list.length - 1 ? list[index + 1] : undefined,
  }
}

export function docsRelated(tool: ToolDefinition) {
  const related = getRelatedTools(tool)
  if (related.length >= 3) return related
  return tools.filter((item) => item.available && item.id !== tool.id && item.category === tool.category).slice(0, 6)
}

export type DocsSearchHit =
  | { kind: 'tool'; slug: string; title: string; subtitle: string; keywords: string; nameId?: string }
  | { kind: 'article'; slug: string; title: string; subtitle: string; keywords: string; nameId?: string }

export function docsArticlePath(slug: string) {
  if (slug === 'getting-started') return '/docs/getting-started' as const
  if (slug === 'troubleshooting') return '/docs/troubleshooting' as const
  return '/docs/privacy-and-processing' as const
}

const searchRecords: DocsSearchHit[] = [
  ...docsArticles.map((article) => ({
    kind: 'article' as const,
    slug: article.slug,
    title: article.title,
    subtitle: 'Guide',
    keywords: article.keywords.join(' '),
  })),
  ...tools.map((tool) => {
    const idCopy = toolsId[tool.slug]
    return {
      kind: 'tool' as const,
      slug: tool.slug,
      title: tool.name,
      subtitle: `${tool.category} • Guide`,
      ...(idCopy?.name ? { nameId: idCopy.name } : {}),
      keywords: [tool.description, tool.tags.join(' '), toolGuides[tool.slug]?.keywords?.join(' '), idCopy?.name, idCopy?.shortDescription, idCopy?.aliases?.join(' '), toolGuidesId[tool.slug]?.keywords?.join(' ')].filter(Boolean).join(' '),
    }
  }),
]

const fuse = new Fuse(searchRecords, {
  keys: ['title', 'subtitle', 'slug', 'keywords', 'nameId'],
  threshold: 0.34,
})

export function searchDocs(query: string): DocsSearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return searchRecords.slice(0, 12)
  return fuse.search(trimmed).map(({ item }) => item)
}

export const popularDocSlugs = ['compress-image', 'resize-image', 'merge-pdf', 'json-formatter', 'qr-code-generator', 'voice-recorder'] as const

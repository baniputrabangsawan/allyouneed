import { redirect } from '@tanstack/react-router'

export const LEGACY_TOOL_REDIRECTS = {
  'qr-generator': 'qr-code-generator',
  'palette-generator': 'color-palette-generator',
  'character-counter': 'word-counter',
  'audio-trimmer': 'audio-cutter',
  'video-trimmer': 'video-cutter',
  'extract-audio': 'extract-audio-from-video',
  'markdown-preview': 'markdown-to-html',
  'hex-rgb-hsl-converter': 'color-picker',
  calculator: 'standard-calculator',
  'universal-calculator': 'standard-calculator',
  'loan-calculator': 'finance-calculator',
  'aspect-ratio-calculator': 'screen-calculator',
  'px-to-rem': 'unit-converter',
} as const

export type LegacyToolSlug = keyof typeof LEGACY_TOOL_REDIRECTS

export function canonicalToolSlug(slug: string): string {
  return LEGACY_TOOL_REDIRECTS[slug as LegacyToolSlug] ?? slug
}

export function isLegacyToolSlug(slug: string): slug is LegacyToolSlug {
  return Object.hasOwn(LEGACY_TOOL_REDIRECTS, slug)
}

export function migrateToolIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => canonicalToolSlug(id)))]
}

export function legacyToolHref(slug: string, path: 'bare' | 'tools' | 'docs', locale: 'en' | 'id' = 'en'): string | undefined {
  if (!isLegacyToolSlug(slug)) return undefined
  const canonical = LEGACY_TOOL_REDIRECTS[slug]
  const targetPath = path === 'bare' ? `/${canonical}` : path === 'tools' ? `/tools/${canonical}` : `/docs/tools/${canonical}`
  const english = targetPath
  return locale === 'id' ? `/id${english}` : english
}

export function throwIfLegacyTool(slug: string, path: 'bare' | 'tools' | 'docs', locale: 'en' | 'id' = 'en'): void {
  const href = legacyToolHref(slug, path, locale)
  if (href) throw redirect({ href })
}

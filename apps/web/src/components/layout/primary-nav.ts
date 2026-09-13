import { getToolBySlug, type ToolCategory } from '@/features/tools/tool-registry'
import type { EnglishTo } from '@/i18n/path'

export const explorerSearch = { q: '', category: 'all', group: 'all' } as const

export const toolCategoryNav = [
  { key: 'imageTools' as const, category: 'image' satisfies ToolCategory },
  { key: 'pdfTools' as const, category: 'pdf' satisfies ToolCategory },
  { key: 'audioTools' as const, category: 'audio' satisfies ToolCategory },
  { key: 'videoTools' as const, category: 'video' satisfies ToolCategory },
  { key: 'textTools' as const, category: 'text' satisfies ToolCategory },
  { key: 'developerTools' as const, category: 'developer' satisfies ToolCategory },
  { key: 'generatorTools' as const, category: 'generator' satisfies ToolCategory },
  { key: 'converterTools' as const, category: 'converter' satisfies ToolCategory },
] as const

export const footerToolNav = toolCategoryNav.filter((item) => item.category !== 'generator' && item.category !== 'converter')

export const primaryNavigation = [
  { key: 'home', to: '/' satisfies EnglishTo },
  { key: 'tools', to: '/tools' satisfies EnglishTo },
  { key: 'guides', to: '/guides' satisfies EnglishTo },
  { key: 'about', to: '/about' satisfies EnglishTo },
  { key: 'pricing', to: '/pricing' satisfies EnglishTo },
  { key: 'support', to: '/support' satisfies EnglishTo },
] as const

export type PrimaryNavHref = (typeof primaryNavigation)[number]['to']
export type PrimaryNavKey = (typeof primaryNavigation)[number]['key']

export function isToolsPath(path: string) {
  if (path === '/tools' || path.startsWith('/tools/')) return true
  const slug = path.replace(/^\//, '')
  return Boolean(slug) && Boolean(getToolBySlug(slug))
}

export function isPrimaryNavActive(href: PrimaryNavHref, path: string) {
  if (href === '/') return path === '/' || path === ''
  if (href === '/tools') return isToolsPath(path)
  if (href === '/guides') {
    return path === '/guides' || path.startsWith('/guides/') || path === '/docs' || path.startsWith('/docs/')
  }
  return path === href || path.startsWith(`${href}/`)
}

export function navItemActive(path: string, key: PrimaryNavKey) {
  const item = primaryNavigation.find((entry) => entry.key === key)
  return item ? isPrimaryNavActive(item.to, path) : false
}

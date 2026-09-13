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

export const primaryPageNav = [
  { key: 'home', to: '/' satisfies EnglishTo },
  { key: 'tools', to: '/tools' satisfies EnglishTo },
  { key: 'guides', to: '/guides' satisfies EnglishTo },
  { key: 'about', to: '/about' satisfies EnglishTo },
  { key: 'pricing', to: '/pricing' satisfies EnglishTo },
  { key: 'support', to: '/support' satisfies EnglishTo },
] as const

export function isToolsPath(path: string) {
  if (path === '/tools' || path.startsWith('/tools/')) return true
  const slug = path.replace(/^\//, '')
  return Boolean(slug) && Boolean(getToolBySlug(slug))
}

export function navItemActive(path: string, key: (typeof primaryPageNav)[number]['key']) {
  if (key === 'home') return path === '/' || path === ''
  if (key === 'tools') return isToolsPath(path)
  if (key === 'guides') return path === '/guides' || path.startsWith('/guides/')
  if (key === 'about') return path === '/about'
  if (key === 'pricing') return path === '/pricing'
  if (key === 'support') return path === '/support'
  return false
}

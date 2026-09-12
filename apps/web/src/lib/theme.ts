import { isThemePreference, type ThemePreference } from '@/lib/storage/preferences'

export function themeIsDark(theme: ThemePreference) {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function applyThemePreference(theme: ThemePreference) {
  if (!isThemePreference(theme)) return
  const html = document.documentElement
  const x = window.scrollX
  const y = window.scrollY
  const hashId = window.location.hash.replace(/^#/, '')
  const hashEl = hashId ? document.getElementById(hashId) : null
  const previousBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  if (hashEl) hashEl.id = ''
  html.setAttribute('data-theme', theme)
  html.classList.toggle('dark', themeIsDark(theme))
  window.scrollTo({ left: x, top: y, behavior: 'auto' })
  if (hashEl) hashEl.id = hashId
  window.scrollTo({ left: x, top: y, behavior: 'auto' })
  html.style.scrollBehavior = previousBehavior
}

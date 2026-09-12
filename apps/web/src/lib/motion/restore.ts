export const KEEP_SCROLL_KEY = 'kits:keep-scroll'

let keepScroll: { x: number; y: number } | null = null

export function isRestoringNavigation() {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-kits-restore')
}

export function saveKeepScroll() {
  keepScroll = { x: window.scrollX, y: window.scrollY }
  try {
    sessionStorage.setItem(KEEP_SCROLL_KEY, JSON.stringify(keepScroll))
  } catch {
    /* private mode */
  }
}

export function peekKeepScroll(): { x: number; y: number } | null {
  if (keepScroll && Number.isFinite(keepScroll.y)) return keepScroll
  try {
    const raw = sessionStorage.getItem(KEEP_SCROLL_KEY)
    if (!raw) return null
    const kept = JSON.parse(raw) as { x?: number; y?: number }
    if (!Number.isFinite(kept.y)) return null
    keepScroll = { x: kept.x || 0, y: kept.y as number }
    return keepScroll
  } catch {
    return null
  }
}

export function clearKeepScroll() {
  keepScroll = null
  try {
    sessionStorage.removeItem(KEEP_SCROLL_KEY)
  } catch {
    /* private mode */
  }
}

export function restoreKeepScroll() {
  const kept = peekKeepScroll()
  if (!kept) return false
  const html = document.documentElement
  const previous = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo({ left: kept.x, top: kept.y, behavior: 'auto' })
  html.style.scrollBehavior = previous
  return true
}

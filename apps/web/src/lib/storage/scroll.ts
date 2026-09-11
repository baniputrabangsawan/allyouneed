const HOME_SCROLL_KEY = 'kits:scroll:home'

export function readHomeScroll() {
  try {
    const raw = sessionStorage.getItem(HOME_SCROLL_KEY)
    if (raw == null) return null
    const y = Number(raw)
    return Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

export function writeHomeScroll(y: number) {
  try {
    sessionStorage.setItem(HOME_SCROLL_KEY, String(Math.max(0, Math.round(y))))
  } catch {
    /* private mode */
  }
}

export function restoreHomeScroll() {
  const y = readHomeScroll()
  if (y == null) return false
  window.scrollTo({ top: y, left: 0, behavior: 'auto' })
  return true
}

export function viewportTopDelta(previousTop: number, nextTop: number) {
  return nextTop - previousTop
}

export function holdElementViewportTop(element: Element | null, previousTop: number | null) {
  if (!element || previousTop == null) return
  const delta = viewportTopDelta(previousTop, element.getBoundingClientRect().top)
  if (Math.abs(delta) < 1) return
  window.scrollBy(0, delta)
}

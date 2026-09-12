const HOME_TOP_FLAG = 'kits:home-top'

export function markGoHomeTop() {
  try {
    sessionStorage.setItem(HOME_TOP_FLAG, '1')
  } catch {
    /* private mode */
  }
}

export function peekGoHomeTop() {
  try {
    return sessionStorage.getItem(HOME_TOP_FLAG) === '1'
  } catch {
    return false
  }
}

export function consumeGoHomeTop() {
  if (!peekGoHomeTop()) return false
  try {
    sessionStorage.removeItem(HOME_TOP_FLAG)
  } catch {
    /* private mode */
  }
  return true
}

export function scrollWindowTop() {
  const html = document.documentElement
  const previous = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  html.style.scrollBehavior = previous
}

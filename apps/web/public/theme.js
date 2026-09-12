(function () {
  var html = globalThis.document.documentElement
  var dark = false
  try {
    var theme = globalThis.localStorage.getItem('utility:theme')
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') theme = 'system'
    html.setAttribute('data-theme', theme)
    dark = theme === 'dark' || (theme === 'system' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches)
    html.classList.toggle('dark', dark)
  } catch {
    /* private mode */
  }
  try {
    globalThis.history.scrollRestoration = 'manual'
    var nav = globalThis.performance && globalThis.performance.getEntriesByType('navigation')[0]
    var keep = false
    try { keep = !!globalThis.sessionStorage.getItem('kits:keep-scroll') } catch {}
    if (keep || globalThis.location.hash || (nav && (nav.type === 'reload' || nav.type === 'back_forward'))) {
      html.setAttribute('data-kits-restore', '1')
      html.style.visibility = 'hidden'
      html.style.background = dark ? '#111114' : '#f5f5fa'
    }
  } catch {
    /* ignore */
  }
  document.addEventListener('pointerdown', function (event) {
    var target = event.target
    if (!target || !target.closest || !target.closest('.language-switcher-button, .language-choices a')) return
    try {
      sessionStorage.setItem('kits:keep-scroll', JSON.stringify({ x: scrollX, y: scrollY }))
    } catch {
      /* private mode */
    }
  }, true)
})()

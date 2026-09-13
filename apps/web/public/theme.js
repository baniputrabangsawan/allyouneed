(function () {
  var html = globalThis.document.documentElement
  var dark = false
  var DARK_BG = '#111114'
  var LIGHT_BG = '#f5f5fa'
  try {
    var theme = globalThis.localStorage.getItem('utility:theme')
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') theme = 'system'
    html.setAttribute('data-theme', theme)
    dark = theme === 'dark' || (theme === 'system' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches)
    html.classList.toggle('dark', dark)
  } catch {
    /* private mode */
  }
  var background = dark ? DARK_BG : LIGHT_BG
  html.style.background = background
  try {
    var themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor) themeColor.setAttribute('content', background)
  } catch {
    /* ignore */
  }
  try {
    globalThis.history.scrollRestoration = 'manual'
    var nav = globalThis.performance && globalThis.performance.getEntriesByType('navigation')[0]
    var keep = false
    try { keep = !!globalThis.sessionStorage.getItem('kits:keep-scroll') } catch { /* private mode */ }
    if (keep || globalThis.location.hash || (nav && (nav.type === 'reload' || nav.type === 'back_forward'))) {
      html.setAttribute('data-kits-restore', '1')
      html.style.visibility = 'hidden'
      html.style.background = background
    }
  } catch {
    /* ignore */
  }
  try {
    var standalone = false
    try {
      standalone = globalThis.matchMedia('(display-mode: standalone)').matches
        || globalThis.matchMedia('(display-mode: fullscreen)').matches
        || globalThis.matchMedia('(display-mode: window-controls-overlay)').matches
        || globalThis.navigator.standalone === true
    } catch {
      standalone = false
    }
    var navEntry = globalThis.performance && globalThis.performance.getEntriesByType('navigation')[0]
    var alreadyShown = false
    try { alreadyShown = !!globalThis.sessionStorage.getItem('kits:splash-shown') } catch { /* private mode */ }
    if (standalone && !alreadyShown && !(navEntry && navEntry.type === 'back_forward')) {
      html.classList.add('kits-splash')
      html.style.background = DARK_BG
      if (!document.getElementById('kits-splash-css')) {
        var css = document.createElement('style')
        css.id = 'kits-splash-css'
        css.textContent = 'html.kits-splash,html.kits-splash body{background:#111114!important;color-scheme:dark}html.kits-splash .kits-splash-screen,html.kits-splash .kits-splash-screen[hidden]{position:fixed;inset:0;z-index:10000;display:grid!important;place-items:center;padding:24px;background:#111114;color:#f3f3f5}html.kits-splash .kits-splash-inner{display:grid;justify-items:center;text-align:center}html.kits-splash .kits-splash-icon{width:112px;height:112px;border-radius:28px}html.kits-splash-out .kits-splash-screen{opacity:0;pointer-events:none;transition:opacity .22s cubic-bezier(.4,0,1,1)}'
        document.head.appendChild(css)
      }
      try { globalThis.sessionStorage.setItem('kits:splash-shown', '1') } catch { /* private mode */ }
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

(function () {
  var html = document.documentElement
  if (!html.hasAttribute('data-kits-restore')) return
  var previous = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  var hash = location.hash.slice(1)
  var kept = null
  try {
    kept = JSON.parse(sessionStorage.getItem('kits:keep-scroll') || 'null')
    if (!kept || !Number.isFinite(kept.y)) kept = null
  } catch {
    kept = null
  }
  if (kept) {
    scrollTo(kept.x || 0, kept.y)
    html.style.scrollBehavior = previous
    html.classList.toggle('kits-scrolled', window.scrollY > 16)
    return
  }
  if (hash) {
    var el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
  } else {
    try {
      var cache = JSON.parse(sessionStorage.getItem('tsr-scroll-restoration-v1_3') || '{}')
      var key = location.pathname + location.search
      var entry = cache[key]
      if (!entry && history.state && history.state.__TSR_key) entry = cache[history.state.__TSR_key]
      var win = entry && entry.window
      if (win && Number.isFinite(win.scrollY)) scrollTo(win.scrollX || 0, win.scrollY)
    } catch {
      /* private mode */
    }
  }
  html.style.scrollBehavior = previous
  html.classList.toggle('kits-scrolled', window.scrollY > 16)
  html.style.visibility = ''
  html.style.background = ''
})()

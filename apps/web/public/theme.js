(function () {
  try {
    var theme = globalThis.localStorage.getItem('utility:theme')
    var dark = theme === 'dark' || ((theme === 'system' || !theme) && globalThis.matchMedia('(prefers-color-scheme: dark)').matches)
    globalThis.document.documentElement.classList.toggle('dark', dark)
  } catch {
    return
  }
})()

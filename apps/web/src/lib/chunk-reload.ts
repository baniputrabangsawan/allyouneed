const STORAGE_KEY = 'kits:chunk-reload'
const RELOAD_COOLDOWN_MS = 15_000

const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Expected a JavaScript-or-Wasm module script/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_LOAD_ERROR.test(message)
}

let lastReloadAt = 0

export function recoverFromChunkLoadError(
  error: unknown,
  options: { reload?: () => void; now?: number } = {},
): boolean {
  if (!isChunkLoadError(error)) return false
  const reload = options.reload ?? (typeof window === 'undefined' ? undefined : () => window.location.reload())
  if (!reload) return false
  const now = options.now ?? Date.now()
  let last = lastReloadAt
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    last = stored === null ? 0 : Number(stored)
  } catch {
    /* private mode */
  }
  if (Number.isFinite(last) && last > 0 && now - last < RELOAD_COOLDOWN_MS) return false
  lastReloadAt = now
  try {
    sessionStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    /* private mode */
  }
  reload()
  return true
}

let installed = false

export function installChunkLoadRecovery() {
  if (typeof window === 'undefined' || installed) return
  installed = true
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recoverFromChunkLoadError(event.payload)
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return
    event.preventDefault()
    recoverFromChunkLoadError(event.reason)
  })
}

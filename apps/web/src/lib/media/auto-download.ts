import { downloadBlob, triggerDownload } from './download'

const STORAGE_KEY = 'kits:auto-download'
const remembered = new Set<string>()

export function forgetAutoDownloads(): void {
  remembered.clear()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage is unavailable in some test and SSR environments.
  }
}

export function autoDownloadOnce(id: string, source: Blob | string, filename: string): boolean {
  if (!id || knownIds().has(id)) return false
  remember(id)
  if (typeof source === 'string') triggerDownload(source, filename)
  else downloadBlob(source, filename)
  return true
}

function knownIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        for (const value of parsed) if (typeof value === 'string' && value) remembered.add(value)
      }
    }
  } catch {
    return remembered
  }
  return remembered
}

function remember(id: string): void {
  remembered.add(id)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...remembered].slice(-200)))
  } catch {
    // Ignore quota or missing sessionStorage.
  }
}

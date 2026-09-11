import { useSyncExternalStore } from 'react'
import { FAVORITES_STORAGE_KEY } from './tools'

export const DISCOVERY_STORAGE_EVENT = 'utility:discovery-storage'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(DISCOVERY_STORAGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(DISCOVERY_STORAGE_EVENT, callback)
  }
}

function getFavoritesSnapshot(fallback: string) {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (stored && stored !== '[]') return stored
  } catch { /* private mode */ }
  return fallback
}

export function useFavoriteIds(ssrIds: readonly string[] = []) {
  const fallback = JSON.stringify(ssrIds)
  const snapshot = useSyncExternalStore(subscribe, () => getFavoritesSnapshot(fallback), () => fallback)
  try {
    const parsed = JSON.parse(snapshot) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

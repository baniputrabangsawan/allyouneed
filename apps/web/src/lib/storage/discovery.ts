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

function getFavoritesSnapshot() {
  try { return localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]' } catch { return '[]' }
}

export function useFavoriteIds() {
  const snapshot = useSyncExternalStore(subscribe, getFavoritesSnapshot, () => '[]')
  try {
    const parsed = JSON.parse(snapshot) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

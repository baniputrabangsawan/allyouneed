import { getLocalStorage, type StorageLike } from './preferences'

export const FAVORITES_STORAGE_KEY = 'utility:favorites'
export const RECENT_TOOLS_STORAGE_KEY = 'utility:recent-tools'
export const MAX_RECENT_TOOLS = 10

const normalizeToolIds = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    return undefined
  }
  return [...new Set(value)]
}

const readToolIds = (key: string, storage: StorageLike | undefined): string[] => {
  try {
    const stored = storage?.getItem(key)
    if (stored === null || stored === undefined) return []
    return normalizeToolIds(JSON.parse(stored) as unknown) ?? []
  } catch {
    return []
  }
}

const saveToolIds = (key: string, toolIds: readonly string[], limit: number, storage: StorageLike | undefined) => {
  try {
    const normalized = normalizeToolIds(toolIds)
    if (!storage || !normalized) return false
    storage.setItem(key, JSON.stringify(normalized.slice(0, limit)))
    return true
  } catch {
    return false
  }
}

export const getFavoriteTools = (storage: StorageLike | undefined = getLocalStorage()) =>
  readToolIds(FAVORITES_STORAGE_KEY, storage)

export const saveFavoriteTools = (
  toolIds: readonly string[],
  storage: StorageLike | undefined = getLocalStorage(),
) => saveToolIds(FAVORITES_STORAGE_KEY, toolIds, Number.POSITIVE_INFINITY, storage)

export const getRecentTools = (storage: StorageLike | undefined = getLocalStorage()) =>
  readToolIds(RECENT_TOOLS_STORAGE_KEY, storage).slice(0, MAX_RECENT_TOOLS)

export const saveRecentTools = (
  toolIds: readonly string[],
  storage: StorageLike | undefined = getLocalStorage(),
) => saveToolIds(RECENT_TOOLS_STORAGE_KEY, toolIds, MAX_RECENT_TOOLS, storage)

export const addRecentTool = (toolId: string, storage: StorageLike | undefined = getLocalStorage()) => {
  if (!toolId.trim()) return false
  return saveRecentTools([toolId, ...getRecentTools(storage).filter((id) => id !== toolId)], storage)
}

import { getLocalStorage, type StorageLike } from './preferences'

export const FAVORITES_STORAGE_KEY = 'utility:favorites'
export const RECENT_TOOLS_STORAGE_KEY = 'utility:recent-tools'
export const RECENT_COOKIE_NAME = 'kits_recent'
export const FAVORITES_COOKIE_NAME = 'kits_favorites'
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
    const next = normalized.slice(0, limit)
    storage.setItem(key, JSON.stringify(next))
    if (key === RECENT_TOOLS_STORAGE_KEY) writeIdCookie(RECENT_COOKIE_NAME, next)
    if (key === FAVORITES_STORAGE_KEY) writeIdCookie(FAVORITES_COOKIE_NAME, next)
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

export function parseIdCookie(header: string, name: string): string[] {
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${name}=`)) continue
    const value = decodeURIComponent(trimmed.slice(name.length + 1))
    const ids = value.split('|').filter((id) => /^[a-z0-9-]+$/i.test(id))
    return [...new Set(ids)].slice(0, name === RECENT_COOKIE_NAME ? MAX_RECENT_TOOLS : ids.length)
  }
  return []
}

export function parseRecentCookie(header: string): string[] {
  return parseIdCookie(header, RECENT_COOKIE_NAME)
}

export function parseFavoritesCookie(header: string): string[] {
  return parseIdCookie(header, FAVORITES_COOKIE_NAME)
}

export function writeRecentCookie(ids: readonly string[]) {
  writeIdCookie(RECENT_COOKIE_NAME, ids)
}

function writeIdCookie(name: string, ids: readonly string[]) {
  if (typeof document === 'undefined') return
  const limit = name === RECENT_COOKIE_NAME ? MAX_RECENT_TOOLS : ids.length
  const value = encodeURIComponent([...new Set(ids)].filter((id) => /^[a-z0-9-]+$/i.test(id)).slice(0, limit).join('|'))
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

import { getLocalStorage, type StorageLike } from './preferences'
import {
  LICENSE_PLANS,
  LICENSE_STATUSES,
  type Entitlement,
} from '@/features/licensing/types'

export const ENTITLEMENT_TOKEN_KEY = 'utility:entitlement-token'
export const ENTITLEMENT_CACHE_KEY = 'utility:entitlement-cache'
export const ENTITLEMENT_STORAGE_EVENT = 'utility:entitlement-storage'

export type EntitlementCache = Entitlement

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getStoredEntitlementToken = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  try {
    const value = storage?.getItem(ENTITLEMENT_TOKEN_KEY)
    return typeof value === 'string' && value.includes('.') ? value : undefined
  } catch {
    return undefined
  }
}

export const getStoredEntitlementCache = (
  storage: StorageLike | undefined = getLocalStorage(),
): EntitlementCache | undefined => {
  try {
    const raw = storage?.getItem(ENTITLEMENT_CACHE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return undefined
    const plan = LICENSE_PLANS.find((candidate) => parsed.plan === candidate)
    const status = LICENSE_STATUSES.find((candidate) => parsed.status === candidate)
    if (!plan || !status) return undefined
    return {
      plan,
      status,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      capabilities: Array.isArray(parsed.capabilities)
        ? parsed.capabilities.filter((item): item is string => typeof item === 'string')
        : [],
    }
  } catch {
    return undefined
  }
}

export const saveEntitlement = (
  token: string,
  cache: EntitlementCache,
  storage: StorageLike | undefined = getLocalStorage(),
): boolean => {
  if (!storage || !token.includes('.')) return false
  try {
    storage.setItem(ENTITLEMENT_TOKEN_KEY, token)
    storage.setItem(ENTITLEMENT_CACHE_KEY, JSON.stringify(cache))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(ENTITLEMENT_STORAGE_EVENT))
    return true
  } catch {
    return false
  }
}

export const clearEntitlement = (storage: StorageLike | undefined = getLocalStorage()): boolean => {
  try {
    if (!storage) return false
    if ('removeItem' in storage && typeof storage.removeItem === 'function') {
      storage.removeItem(ENTITLEMENT_TOKEN_KEY)
      storage.removeItem(ENTITLEMENT_CACHE_KEY)
    } else {
      storage.setItem(ENTITLEMENT_TOKEN_KEY, '')
      storage.setItem(ENTITLEMENT_CACHE_KEY, '')
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(ENTITLEMENT_STORAGE_EVENT))
    return true
  } catch {
    return false
  }
}

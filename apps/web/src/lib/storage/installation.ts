import { getLocalStorage, type StorageLike } from './preferences'

export const INSTALLATION_STORAGE_KEY = 'utility:installation-id'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export const isInstallationId = (value: unknown): value is string =>
  typeof value === 'string' && uuidPattern.test(value)

export const getInstallationId = (storage: StorageLike | undefined = getLocalStorage()): string | undefined => {
  try {
    const value = storage?.getItem(INSTALLATION_STORAGE_KEY)
    return isInstallationId(value) ? value : undefined
  } catch {
    return undefined
  }
}

export const getOrCreateInstallationId = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  const existing = getInstallationId(storage)
  if (existing) return existing
  if (!storage) return undefined
  const created = createId()
  try {
    storage.setItem(INSTALLATION_STORAGE_KEY, created)
    return created
  } catch {
    return undefined
  }
}

export const ensureInstallationId = getOrCreateInstallationId

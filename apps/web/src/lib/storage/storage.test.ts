import { describe, expect, it } from 'vitest'
import { getThemePreference, saveThemePreference, type StorageLike } from './preferences'
import { addRecentTool, getFavoriteTools, getRecentTools, parseRecentCookie, saveFavoriteTools, saveRecentTools } from './tools'
import { getOrCreateInstallationId, getInstallationId, INSTALLATION_STORAGE_KEY } from './installation'
import { isLicenseKey, normalizeLicenseKey } from './license'
import { clearEntitlement, getStoredEntitlementToken, saveEntitlement } from './entitlement'

const memoryStorage = (): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => { values.delete(key) },
  }
}

describe('storage helpers', () => {
  it('validates stored themes and survives unavailable storage', () => {
    const storage = memoryStorage()
    storage.setItem('utility:theme', 'sepia')
    expect(getThemePreference(storage)).toBe('system')
    expect(saveThemePreference('dark', storage)).toBe(true)
    expect(getThemePreference(storage)).toBe('dark')
    expect(getThemePreference({ getItem: () => { throw new Error('blocked') }, setItem: () => undefined })).toBe('system')
  })

  it('rejects malformed favorite data and deduplicates valid values', () => {
    const storage = memoryStorage()
    storage.setItem('utility:favorites', '["one", 2]')
    expect(getFavoriteTools(storage)).toEqual([])
    expect(saveFavoriteTools(['one', 'one', 'two'], storage)).toBe(true)
    expect(getFavoriteTools(storage)).toEqual(['one', 'two'])
  })

  it('keeps at most ten unique recent tools with the newest first', () => {
    const storage = memoryStorage()
    expect(saveRecentTools(Array.from({ length: 12 }, (_, index) => `tool-${index}`), storage)).toBe(true)
    expect(getRecentTools(storage)).toHaveLength(10)
    expect(addRecentTool('tool-5', storage)).toBe(true)
    expect(getRecentTools(storage)).toEqual(['tool-5', 'tool-0', 'tool-1', 'tool-2', 'tool-3', 'tool-4', 'tool-6', 'tool-7', 'tool-8', 'tool-9'])
  })

  it('parses recent tool ids from the SSR cookie header', () => {
    expect(parseRecentCookie('kits_recent=json-formatter%7Ccompress-image; theme=dark')).toEqual(['json-formatter', 'compress-image'])
    expect(parseRecentCookie('')).toEqual([])
    expect(parseRecentCookie('kits_recent=bad id|ok-tool')).toEqual(['ok-tool'])
  })

  it('creates and reuses an installation id', () => {
    const storage = memoryStorage()
    const first = getOrCreateInstallationId(storage)
    const second = getOrCreateInstallationId(storage)
    expect(first).toMatch(/^[0-9a-f-]{36}$/i)
    expect(second).toBe(first)
    expect(getInstallationId(storage)).toBe(first)
    storage.setItem(INSTALLATION_STORAGE_KEY, 'not-a-uuid')
    expect(getInstallationId(storage)).toBeUndefined()
  })

  it('normalizes license keys and stores entitlement tokens instead of raw keys', () => {
    const storage = memoryStorage()
    const key = 'UTL-PRO-7KQ9-A28M-JX4P'
    expect(isLicenseKey(key)).toBe(true)
    expect(normalizeLicenseKey(' utlpro7kq9a28mjx4p ')).toBe(key)
    expect(saveEntitlement('body.sig', {
      plan: 'pro_1_month',
      status: 'active',
      expiresAt: '2027-09-10T00:00:00Z',
      capabilities: ['image.ai.upscale'],
    }, storage)).toBe(true)
    expect(getStoredEntitlementToken(storage)).toBe('body.sig')
    expect(clearEntitlement(storage)).toBe(true)
    expect(getStoredEntitlementToken(storage)).toBeUndefined()
  })
})

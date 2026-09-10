export type ThemePreference = 'light' | 'dark' | 'system'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export const THEME_STORAGE_KEY = 'utility:theme'

export const getLocalStorage = (): StorageLike | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

export const getThemePreference = (storage: StorageLike | undefined = getLocalStorage()): ThemePreference => {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export const saveThemePreference = (
  theme: ThemePreference,
  storage: StorageLike | undefined = getLocalStorage(),
): boolean => {
  try {
    if (!storage || !isThemePreference(theme)) return false
    storage.setItem(THEME_STORAGE_KEY, theme)
    return true
  } catch {
    return false
  }
}

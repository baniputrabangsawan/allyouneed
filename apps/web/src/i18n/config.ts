export const locales = ['en', 'id'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'
export const localePrefix = 'id'
export const localeStorageKey = 'kits:locale'

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

export const localeHtml: Record<Locale, string> = {
  en: 'en',
  id: 'id',
}

export const localeOg: Record<Locale, string> = {
  en: 'en_US',
  id: 'id_ID',
}

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'id'
}

import { useRouterState } from '@tanstack/react-router'
import { en, type Messages } from './en'
import { id } from './id'
import { defaultLocale, type Locale } from './config'
import { localeFromPathname } from './path'

export const messages: Record<Locale, Messages> = { en, id }

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[defaultLocale]
}

export function useLocale(): Locale {
  return useRouterState({ select: (state) => localeFromPathname(state.location.pathname) })
}

export function useT(): Messages {
  return getMessages(useLocale())
}

export { en, id }
export type { Messages }
export type { Locale } from './config'
export {
  defaultLocale,
  localeHtml,
  localeLabels,
  localeOg,
  localeStorageKey,
  locales,
} from './config'
export {
  englishToIdTo,
  localeFromPathname,
  localizedPath,
  localizeTo,
  stripLocalePrefix,
  switchLocaleLocation,
  type EnglishTo,
} from './path'

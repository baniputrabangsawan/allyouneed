import { defaultLocale, localePrefix, type Locale } from './config'

export function localeFromPathname(pathname: string): Locale {
  const trimmed = pathname.replace(/\/+$/, '') || '/'
  if (trimmed === `/${localePrefix}` || trimmed.startsWith(`/${localePrefix}/`)) return 'id'
  return defaultLocale
}

export function stripLocalePrefix(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/'
  if (trimmed === `/${localePrefix}`) return '/'
  if (trimmed.startsWith(`/${localePrefix}/`)) return trimmed.slice(localePrefix.length + 1) || '/'
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

export function localizedPath(locale: Locale, path: string): string {
  const bare = stripLocalePrefix(path)
  const normalized = bare === '' ? '/' : bare.startsWith('/') ? bare : `/${bare}`
  if (locale === 'en') return normalized
  if (normalized === '/') return '/id'
  return `/id${normalized}`
}

export function switchLocaleLocation(
  next: Locale,
  location: { pathname: string; searchStr?: string; hash?: string },
): string {
  const path = localizedPath(next, location.pathname)
  const search = location.searchStr ?? ''
  const hash = location.hash
    ? (location.hash.startsWith('#') ? location.hash : `#${location.hash}`)
    : ''
  return `${path}${search}${hash}`
}

export const englishToIdTo = {
  '/': '/id',
  '/$tool': '/id/$tool',
  '/about': '/id/about',
  '/contact': '/id/contact',
  '/docs': '/id/docs',
  '/docs/getting-started': '/id/docs/getting-started',
  '/docs/privacy-and-processing': '/id/docs/privacy-and-processing',
  '/docs/troubleshooting': '/id/docs/troubleshooting',
  '/docs/tools/$slug': '/id/docs/tools/$slug',
  '/guides': '/id/guides',
  '/guides/$slug': '/id/guides/$slug',
  '/license': '/id/license',
  '/pricing': '/id/pricing',
  '/privacy': '/id/privacy',
  '/support': '/id/support',
  '/terms': '/id/terms',
  '/tools': '/id/tools',
  '/tools/$category': '/id/tools/$category',
} as const

export type EnglishTo = keyof typeof englishToIdTo

export function localizeTo(locale: Locale, to: EnglishTo) {
  return locale === 'en' ? to : englishToIdTo[to]
}

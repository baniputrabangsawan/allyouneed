import { useRouter } from '@tanstack/react-router'
import { localeStorageKey, type Locale } from './config'
import { localizedPath, type EnglishTo, useLocale } from './index'

export function useLocaleNavigate() {
  const locale = useLocale()
  const router = useRouter()
  return (opts: { to: EnglishTo; params?: Record<string, string>; search?: Record<string, unknown>; hash?: string; replace?: boolean; resetScroll?: boolean }) => {
    let path = localizedPath(locale, opts.to)
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        path = path.replace(`$${key}`, value)
      }
    }
    const search = opts.search
      ? `?${new URLSearchParams(
        Object.entries(opts.search).map(([key, value]) => [key, String(value ?? '')]),
      ).toString()}`
      : ''
    const hash = opts.hash ? (opts.hash.startsWith('#') ? opts.hash : `#${opts.hash}`) : ''
    return router.navigate({ href: `${path}${search}${hash}`, replace: opts.replace, resetScroll: opts.resetScroll } as never)
  }
}

export function useSwitchLocale() {
  const router = useRouter()
  return (next: Locale, href: string) => {
    try {
      window.localStorage.setItem(localeStorageKey, next)
    } catch { /* ignore quota / private mode */ }
    void router.navigate({ href, resetScroll: false } as never)
  }
}

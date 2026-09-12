import { useRouter } from '@tanstack/react-router'
import { localeStorageKey, type Locale } from './config'
import { localizedPath, type EnglishTo, useLocale } from './index'
import { restoreKeepScroll, saveKeepScroll } from '@/lib/motion/restore'
import { markGoHomeTop, scrollWindowTop } from '@/lib/navigation/home-top'

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

export function useGoHomeTop() {
  const navigate = useLocaleNavigate()
  return (event?: { preventDefault: () => void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.button ?? 0) !== 0)) return
    event?.preventDefault()
    markGoHomeTop()
    void navigate({ to: '/', resetScroll: true })
    scrollWindowTop()
    requestAnimationFrame(scrollWindowTop)
  }
}

export function useSwitchLocale() {
  const router = useRouter()
  return (next: Locale, href: string) => {
    saveKeepScroll()
    try {
      window.localStorage.setItem(localeStorageKey, next)
    } catch { /* ignore quota / private mode */ }
    const nextHref = href.replace(/#.*$/, '')
    const stop = router.subscribe('onResolved', () => {
      restoreKeepScroll()
      requestAnimationFrame(() => restoreKeepScroll())
      stop()
    })
    void router.navigate({ href: nextHref, resetScroll: false } as never)
  }
}

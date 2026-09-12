import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { AppHeader } from '@/components/layout/AppShell'
import { AppFooter } from '@/components/layout/AppFooter'
import { getPopularTools } from '@/features/tools/tool-registry'
import { documentLang } from '@/i18n/seo'
import { LocaleLink } from '@/i18n/link'
import { localeFromPathname, useLocale, useT } from '@/i18n'
import { localizeTool } from '@/i18n/tools'
import { refreshScroll } from '@/lib/motion/scroll'
import { restoreKeepScroll, clearKeepScroll } from '@/lib/motion/restore'
import { consumeGoHomeTop, scrollWindowTop } from '@/lib/navigation/home-top'
import { cleanupExpiredFiles } from '@/lib/storage/file-persistence'
import { ensureInstallationId } from '@/lib/storage/installation'
import '@/styles/app.css'
import '@/styles/docs.css'

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: ({ matches }) => {
    const pathname = matches.at(-1)?.pathname ?? '/'
    const locale = localeFromPathname(pathname)
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: locale === 'id'
          ? 'Tools browser cepat dan privat untuk gambar, kode, QR, dan lainnya.'
          : 'Fast, private browser tools for images, code, QR codes, and more.' },
        { title: locale === 'id' ? 'Kits — Semua tool yang Anda butuhkan' : 'Kits — Every tool you need' },
      ],
      links: [{ rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%23292934%22/><path d=%22M9 9h6v6H9zm8 0h6v6h-6zM9 17h6v6H9zm8 0h6v6h-6z%22 fill=%22white%22/></svg>' }],
    }
  },
  notFoundComponent: NotFound,
  component: Root,
})

function NotFound() {
  const copy = useT()
  const locale = useLocale()
  const popular = getPopularTools().slice(0, 4)
  return <main className="empty-page"><p className="eyebrow">404</p><h1>{copy.notFound.toolTitle}</h1><p>{copy.notFound.body}</p><div className="empty-page-actions"><LocaleLink className="button primary" to="/" hash="search" search={{ category: 'all' }}>{copy.notFound.search}</LocaleLink><LocaleLink className="button" to="/" search={{ category: 'all' }}>{copy.notFound.backHome}</LocaleLink></div><div className="not-found-popular" aria-label={copy.notFound.popular}>{popular.map((tool) => { const item = localizeTool(tool, locale); return <LocaleLink key={tool.id} to="/tools/$category" params={{ category: tool.slug }}>{item.name}</LocaleLink> })}</div></main>
}

function Root() {
  const { queryClient } = Route.useRouteContext()
  const copy = useT()
  const hash = useRouterState({ select: (state) => state.location.hash })
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const locale = localeFromPathname(pathname)
  useLayoutEffect(() => {
    const html = document.documentElement
    const reveal = () => {
      html.style.visibility = ''
      html.style.background = ''
    }
    if (restoreKeepScroll()) {
      reveal()
      refreshScroll()
      const raf = window.requestAnimationFrame(() => restoreKeepScroll())
      return () => window.cancelAnimationFrame(raf)
    }
    if (consumeGoHomeTop()) {
      scrollWindowTop()
      reveal()
      const raf = window.requestAnimationFrame(scrollWindowTop)
      return () => window.cancelAnimationFrame(raf)
    }
    const id = String(hash ?? '').replace(/^#/, '')
    const snap = () => {
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      const previous = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
      html.style.scrollBehavior = previous
      refreshScroll()
    }
    snap()
    reveal()
    const raf = window.requestAnimationFrame(snap)
    return () => window.cancelAnimationFrame(raf)
  }, [hash, pathname])
  useEffect(() => {
    delete document.documentElement.dataset.kitsRestore
    const id = window.setTimeout(() => clearKeepScroll(), 400)
    return () => window.clearTimeout(id)
  }, [pathname, hash])

  useEffect(() => { ensureInstallationId() }, [])
  useEffect(() => { void cleanupExpiredFiles() }, [])
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')
  return <Document lang={documentLang(locale)}><QueryClientProvider client={queryClient}><a className="skip-link" href="#main-content">{copy.nav.skip}</a>{!admin && <AppHeader />}<div id="main-content" tabIndex={-1}><Outlet /></div>{!admin && <AppFooter />}</QueryClientProvider></Document>
}

function Document({ children, lang }: Readonly<{ children: ReactNode; lang: string }>) {
  return <html lang={lang} suppressHydrationWarning><head><HeadContent /><script src="/theme.js" /></head><body suppressHydrationWarning>{children}<script src="/restore-scroll.js" /><Scripts /></body></html>
}

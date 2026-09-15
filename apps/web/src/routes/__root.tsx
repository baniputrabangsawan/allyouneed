import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { AppHeader } from '@/components/layout/AppShell'
import { AppFooter } from '@/components/layout/AppFooter'
import { WebMcp } from '@/features/agents/WebMcp'
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
        { name: 'theme-color', content: '#111114' },
        { name: 'color-scheme', content: 'dark light' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Kits' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'msapplication-TileColor', content: '#111114' },
        { name: 'description', content: locale === 'id'
          ? 'Tools browser cepat dan privat untuk gambar, kode, QR, dan lainnya.'
          : 'Fast, private browser tools for images, code, QR codes, and more.' },
        { title: locale === 'id' ? 'Kits — Semua tool yang Anda butuhkan' : 'Kits — Every tool you need' },
      ],
      links: [
        { rel: 'icon', href: '/favicon.ico?v=2', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png?v=2' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png?v=2' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=2' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'api-catalog', href: '/.well-known/api-catalog' },
        { rel: 'service-desc', type: 'application/json', href: '/openapi.json' },
        { rel: 'service-doc', type: 'text/html', href: '/docs' },
        { rel: 'describedby', type: 'application/json', href: '/.well-known/ai-catalog.json' },
        { rel: 'ai-catalog', href: '/.well-known/ai-catalog.json' },
        { rel: 'alternate', type: 'text/markdown', href: pathname },
      ],
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
      if (!html.classList.contains('kits-splash')) html.style.background = ''
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
  useEffect(() => {
    const html = document.documentElement
    if (!html.classList.contains('kits-splash')) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      html.classList.remove('kits-splash', 'kits-splash-out')
      html.style.background = ''
      document.getElementById('kits-splash')?.setAttribute('hidden', '')
      document.getElementById('kits-splash-css')?.remove()
    }
    if (reduced) {
      finish()
      return
    }
    const hold = window.setTimeout(() => html.classList.add('kits-splash-out'), 380)
    const done = window.setTimeout(finish, 600)
    return () => {
      window.clearTimeout(hold)
      window.clearTimeout(done)
    }
  }, [])
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')
  return <Document lang={documentLang(locale)}><QueryClientProvider client={queryClient}><WebMcp /><a className="skip-link" href="#main-content">{copy.nav.skip}</a>{!admin && <AppHeader />}<div id="main-content" tabIndex={-1}><Outlet /></div>{!admin && <AppFooter />}</QueryClientProvider></Document>
}

function Document({ children, lang }: Readonly<{ children: ReactNode; lang: string }>) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <head><HeadContent /><script src="/theme.js" /></head>
      <body suppressHydrationWarning>
        <div id="kits-splash" className="kits-splash-screen" hidden aria-hidden="true">
          <div className="kits-splash-inner">
            <div className="kits-splash-mark">
              <img className="kits-splash-icon" src="/icon-192.png" width={112} height={112} alt="" />
            </div>
            <p className="kits-splash-wordmark">Kits</p>
            <p className="kits-splash-tagline">Every tool you need.<br />In one place.</p>
            <div className="kits-splash-dots" aria-hidden="true"><span /><span /><span /></div>
          </div>
        </div>
        {children}
        <script src="/restore-scroll.js" />
        <script src="/webmcp.js" />
        <Scripts />
      </body>
    </html>
  )
}

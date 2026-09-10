import { useEffect, type ReactNode } from 'react'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { AppFooter, AppHeader } from '@/components/layout/AppShell'
import { getPopularTools } from '@/features/tools/tool-registry'
import { ensureInstallationId } from '@/lib/storage/installation'
import '@/styles/app.css'

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'description', content: 'Fast, private browser tools for images, code, QR codes, and more.' },
      { title: 'Kits — Every tool you need' },
    ],
    links: [{ rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%23292934%22/><path d=%22M9 9h6v6H9zm8 0h6v6h-6zM9 17h6v6H9zm8 0h6v6h-6z%22 fill=%22white%22/></svg>' }],
  }),
  notFoundComponent: NotFound,
  component: Root,
})

function NotFound() {
  const popular = getPopularTools().slice(0, 4)
  return <main className="empty-page"><p className="eyebrow">404</p><h1>Tool not found</h1><p>The tool may have moved. Search the full library or open a popular tool.</p><div className="empty-page-actions"><Link className="button primary" to="/" hash="search" search={{ category: 'all' }}>Search all tools</Link><Link className="button" to="/" search={{ category: 'all' }}>Back home</Link></div><div className="not-found-popular" aria-label="Popular tools">{popular.map((tool) => <Link key={tool.id} to="/$tool" params={{ tool: tool.slug }}>{tool.name}</Link>)}</div></main>
}

function Root() {
  const { queryClient } = Route.useRouteContext()
  useEffect(() => { ensureInstallationId() }, [])
  return <Document><QueryClientProvider client={queryClient}><a className="skip-link" href="#main-content">Skip to main content</a><AppHeader /><div id="main-content" tabIndex={-1}><Outlet /></div><AppFooter /></QueryClientProvider></Document>
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><HeadContent /><script src="/theme.js" /></head><body>{children}<Scripts /></body></html>
}

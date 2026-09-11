import { useRouterState } from '@tanstack/react-router'
import { BookOpen, Menu, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { docsArticlePath, docsSidebarGroups, searchDocs, type DocsSearchHit } from '@/content/docs/catalog'
import { localizeTo, stripLocalePrefix, useLocale, useT } from '@/i18n'
import { LocaleLink } from '@/i18n/link'
import { useLocaleNavigate } from '@/i18n/navigate'
import { localizeTool } from '@/i18n/tools'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { revealPage } from '@/lib/motion/reveal'
import { useGSAP } from '@/lib/motion/gsap'

const articles = [
  { to: '/docs/getting-started' as const, labelKey: 'gettingStarted' },
  { to: '/docs/privacy-and-processing' as const, labelKey: 'privacy' },
  { to: '/docs/troubleshooting' as const, labelKey: 'issues' },
] as const

export function DocsShell({
  children,
  toc,
}: {
  children: ReactNode
  toc?: ReadonlyArray<{ id: string; label: string }>
}) {
  const copy = useT()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [menuOpen, setMenuOpen] = useState(false)
  const introRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    revealPage(introRef.current)
  }, { scope: introRef, dependencies: [pathname] })

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="docs-shell">
      <button className="docs-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="docs-navigation" onClick={() => setMenuOpen((open) => !open)}>
        {menuOpen ? <X size={16} /> : <Menu size={16} />}
        {copy.docs.menu}
      </button>
      {menuOpen && <button className="docs-drawer-backdrop" type="button" aria-label={copy.docs.closeMenu} onClick={() => setMenuOpen(false)} />}
      <DocsNav pathname={pathname} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="docs-main">
        <div ref={introRef} className="docs-intro">{children}</div>
        {toc && toc.length > 1 && (
          <nav className="docs-toc" aria-label={copy.docs.onThisPage}>
            <p>{copy.docs.onThisPage}</p>
            <ul>
              {toc.map((item) => (
                <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}

function DocsNav({ pathname, open, onNavigate }: { pathname: string; open: boolean; onNavigate: () => void }) {
  const copy = useT()
  const locale = useLocale()
  const bare = stripLocalePrefix(pathname)
  const groups = useMemo(() => docsSidebarGroups(), [])
  return (
    <aside id="docs-navigation" className={open ? 'docs-sidebar open' : 'docs-sidebar'}>
      <LocaleLink to="/docs" className="docs-brand" onClick={onNavigate}><BookOpen size={16} /> {copy.docs.brand}</LocaleLink>
      <DocsSearch pathname={bare} onNavigate={onNavigate} />
      <nav className="docs-nav" aria-label={copy.nav.docs}>
        <p className="docs-nav-label">{copy.docs.guides}</p>
        {articles.map((article) => (
          <LocaleLink key={article.to} to={article.to} className={bare === article.to ? 'active' : undefined} onClick={onNavigate}>
            {article.labelKey === 'gettingStarted' ? copy.docs.gettingStarted : article.labelKey === 'privacy' ? copy.docs.privacy : copy.docs.issues}
          </LocaleLink>
        ))}
        {groups.map((group) => (
          <details key={group.category} className="docs-nav-group" open={group.tools.some((tool) => bare === `/docs/tools/${tool.slug}`)}>
            <summary>{copy.category[group.category] ?? group.category}</summary>
            {group.tools.map((tool) => (
              <LocaleLink
                key={tool.slug}
                to="/docs/tools/$slug"
                params={{ slug: tool.slug }}
                className={bare === `/docs/tools/${tool.slug}` ? 'active' : undefined}
                onClick={onNavigate}
              >
                {localizeTool(tool, locale).name}
                {!tool.available && <span className="docs-soon">{copy.docs.soon}</span>}
              </LocaleLink>
            ))}
          </details>
        ))}
      </nav>
    </aside>
  )
}

function DocsSearch({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const copy = useT()
  const locale = useLocale()
  const navigate = useLocaleNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const hits = query.trim() ? searchDocs(query).slice(0, 8) : []

  function openHit(hit: DocsSearchHit | undefined) {
    if (!hit) return
    onNavigate()
    setQuery('')
    if (hit.kind === 'article') {
      void navigate({ to: docsArticlePath(hit.slug) })
      return
    }
    void navigate({ to: '/docs/tools/$slug', params: { slug: hit.slug } })
  }

  return (
    <div className="docs-search">
      <label>
        <Search size={16} />
        <span className="sr-only">{copy.docs.search}</span>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => (index + 1) % Math.max(hits.length, 1)) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => (index - 1 + Math.max(hits.length, 1)) % Math.max(hits.length, 1)) }
            if (event.key === 'Enter') { event.preventDefault(); openHit(hits[active]) }
            if (event.key === 'Escape') setQuery('')
          }}
          placeholder={copy.docs.search}
          autoComplete="off"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
        />
      </label>
      {hits.length > 0 && (
        <ul id={listId} className="docs-search-results" role="listbox">
          {hits.map((hit, index) => {
            const tool = hit.kind === 'tool' ? getToolBySlug(hit.slug) : undefined
            const title = tool ? localizeTool(tool, locale).name : hit.title
            return (
              <li key={`${hit.kind}-${hit.slug}`}>
                <button type="button" role="option" aria-selected={index === active} className={index === active ? 'active' : undefined} onMouseEnter={() => setActive(index)} onClick={() => openHit(hit)}>
                  <span>{title}</span>
                  <small>{hit.kind === 'article' ? copy.docs.guides : copy.palette.docs}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!query && <p className="docs-search-hint">{pathname.startsWith('/docs') ? copy.docs.hint : null}</p>}
    </div>
  )
}

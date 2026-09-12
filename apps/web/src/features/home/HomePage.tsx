import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Clock3, LockKeyhole, Search, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AvailabilityFlipGrids } from '@/components/tool/ToolFlipGrid'
import { HorizontalToolList } from '@/components/tool/HorizontalToolList'
import { partitionByAvailability } from '@/features/tools/tool-availability'
import {
  homeCategories as categories,
  homeGroups as groups,
  type CategoryFilter,
  type GroupFilter,
} from './home-search'
import {
  getNewTools,
  getPopularTools,
  getToolBySlug,
  tools,
  type ToolDefinition,
} from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import { useLocaleNavigate } from '@/i18n/navigate'
import { searchToolsLocalized } from '@/i18n/tools'
import { useGSAP } from '@/lib/motion/gsap'
import { isCompactMotion, prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { refreshScroll, revealSectionOnce } from '@/lib/motion/scroll'
import { DISCOVERY_STORAGE_EVENT, useFavoriteIds } from '@/lib/storage/discovery'
import { RECENT_TOOLS_STORAGE_KEY, writeRecentCookie } from '@/lib/storage/tools'
import { holdElementViewportTop } from '@/lib/storage/scroll'

function filterTools(query: string, category: CategoryFilter, group: GroupFilter) {
  return searchToolsLocalized(query).filter((tool) =>
    (category === 'all' || (category === 'converter' ? tool.groups.includes('convert') : tool.category === category))
    && (group === 'all' || tool.groups.includes(group)),
  )
}

function subscribeToDiscovery(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(DISCOVERY_STORAGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(DISCOVERY_STORAGE_EVENT, callback)
  }
}

function getRecentSnapshot(fallback: string) {
  try {
    const stored = localStorage.getItem(RECENT_TOOLS_STORAGE_KEY)
    if (stored && stored !== '[]') return stored
  } catch { /* private mode */ }
  return fallback
}

function useRecentIds(ssrIds: readonly string[]) {
  const fallback = JSON.stringify(ssrIds)
  const snapshot = useSyncExternalStore(subscribeToDiscovery, () => getRecentSnapshot(fallback), () => fallback)
  try {
    const value = JSON.parse(snapshot) as unknown
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 10) : []
  } catch { return [] }
}

function toolsForIds(ids: readonly string[]) {
  return ids.map(getToolBySlug).filter((tool): tool is ToolDefinition => Boolean(tool))
}

export function Home() {
  const copy = useT()
  const { recent: ssrRecentIds, favorites: ssrFavoriteIds } = useLoaderData({ strict: false }) as { recent: readonly string[]; favorites: readonly string[] }
  const { q, category, group } = useSearch({ strict: false }) as { q: string; category: CategoryFilter; group: GroupFilter }
  const navigate = useNavigate()
  const openToolNav = useLocaleNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const homeRef = useRef<HTMLElement>(null)
  const catalogRef = useRef<HTMLElement>(null)
  const catalogTopRef = useRef<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const favorites = toolsForIds(useFavoriteIds(ssrFavoriteIds)).slice(0, 10)
  const recent = toolsForIds(useRecentIds(ssrRecentIds))
  const newest = getNewTools().slice(0, 10)
  const found = useMemo(() => filterTools(q, category, group), [q, category, group])
  const { available: availableMatches, comingSoon: comingSoonMatches } = useMemo(() => partitionByAvailability(found), [found])
  const suggestions = found.filter((tool) => tool.available).slice(0, 8)
  const workingCount = tools.filter((tool) => tool.available).length
  const showDiscovery = !q && category === 'all' && group === 'all'

  useGSAP(() => {
    const root = homeRef.current
    if (!root || prefersReducedMotion()) return
    revealSectionOnce(root.querySelector('.privacy-section'), '.privacy-mark, h2, p, .privacy-points span')
    if (!isCompactMotion()) return
    for (const selector of ['#recent', '#favorites', '#new', '.popular', '#all-tools']) {
      revealSectionOnce(
        root.querySelector(selector),
        '.section-heading, .tool-rail, .tool-grid, .tool-availability-group',
      )
    }
  }, { scope: homeRef, dependencies: [showDiscovery] })
  useEffect(() => {
    if (recent.length) writeRecentCookie(recent.map((tool) => tool.id))
  }, [recent])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement)) {
        event.preventDefault()
        inputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useLayoutEffect(() => {
    holdElementViewportTop(catalogRef.current, catalogTopRef.current)
    catalogTopRef.current = null
    refreshScroll()
  }, [q, category, group])

  function updateSearch(next: Partial<{ q: string; category: CategoryFilter; group: GroupFilter }>, history: 'replace' | 'push' = 'replace') {
    catalogTopRef.current = catalogRef.current?.getBoundingClientRect().top ?? null
    void navigate({ search: { q, category, group, ...next }, replace: history === 'replace', resetScroll: false } as never)
  }

  function openTool(tool: ToolDefinition | undefined) {
    if (!tool) return
    setSearchOpen(false)
    void openToolNav({ to: '/$tool', params: { tool: tool.slug } })
  }

  return (
    <main ref={homeRef}>
      <section className="hero discovery-hero">
        <div className="hero-grid">
          <div><p className="eyebrow"><Sparkles size={14}/> {copy.home.eyebrow}</p><h1><span className="hero-title-line">{copy.home.titleA}</span><br/><span className="hero-title-line">{copy.home.titleB}</span></h1><p className="hero-copy">{copy.home.copy}</p></div>
          <div className="hero-proof"><div className="proof-number">{workingCount}</div><p>{copy.home.workingTools}</p><div className="proof-rule"/><span><ShieldCheck size={17}/> {copy.home.mostRunLocally}</span></div>
        </div>
        <div className="search-combobox" onFocus={() => setSearchOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}>
          <div className="search-box" id="search"><Search size={23}/><input ref={inputRef} value={q} role="combobox" aria-autocomplete="list" aria-controls="home-search-results" aria-expanded={searchOpen && Boolean(q)} aria-activedescendant={searchOpen && suggestions[activeIndex] ? `home-search-option-${activeIndex}` : undefined} onChange={(event) => { updateSearch({ q: event.target.value }); setActiveIndex(0); setSearchOpen(true) }} onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSearchOpen(true); setActiveIndex((index) => (index + 1) % Math.max(suggestions.length, 1)) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSearchOpen(true); setActiveIndex((index) => (index - 1 + Math.max(suggestions.length, 1)) % Math.max(suggestions.length, 1)) }
            if (event.key === 'Enter' && searchOpen) { event.preventDefault(); openTool(suggestions[activeIndex]) }
            if (event.key === 'Escape') { event.preventDefault(); setSearchOpen(false); inputRef.current?.blur() }
          }} placeholder={copy.home.searchPlaceholder(tools.length)} aria-label={copy.home.searchAria} autoComplete="off"/><kbd>/</kbd></div>
          {searchOpen && q && <div className="search-suggestions" id="home-search-results" role="listbox" aria-label={copy.home.matchingTools}>{suggestions.map((tool, index) => <button id={`home-search-option-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} type="button" key={tool.id} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => openTool(tool)}><span><strong>{tool.name}</strong><small>{tool.shortDescription}</small></span><span className="suggestion-category">{copy.category[tool.category] ?? tool.category}</span></button>)}{!suggestions.length && <p>{copy.home.noWorkingMatch}</p>}</div>}
        </div>
        <FilterPills items={categories} value={category} label={copy.home.categories} getLabel={(item) => copy.category[item] ?? item} onChange={(value) => updateSearch({ category: value }, 'push')}/>
        <FilterPills items={groups} value={group} label={copy.home.groups} getLabel={(item) => copy.group[item] ?? item} secondary onChange={(value) => updateSearch({ group: value }, 'push')}/>
      </section>

      {showDiscovery && (
        <div className="discovery-stack">
          <ToolSection id="recent" eyebrow={copy.home.backToWork} title={copy.home.recentlyUsed} icon={<Clock3 size={14}/>} items={recent} empty={copy.home.recentEmpty}/>
          <ToolSection id="favorites" eyebrow={copy.home.savedByYou} title={copy.home.favorites} icon={<Star size={14}/>} items={favorites} empty={copy.home.favoritesEmpty}/>
          <ToolSection id="new" eyebrow={copy.home.justAdded} title={copy.nav.new} icon={<Sparkles size={14}/>} items={newest} empty={copy.home.newEmpty}/>
          <section className="page-section popular"><div className="section-heading"><div><p className="eyebrow">{copy.home.startHere}</p><h2>{copy.home.popular}</h2></div><LocaleLink to="/" hash="all-tools" search={{ q, category, group }}>{copy.home.browseAll} <ArrowRight size={16}/></LocaleLink></div><HorizontalToolList items={getPopularTools()} label={copy.home.popular}/></section>
        </div>
      )}

      <section ref={catalogRef} className="page-section" id="all-tools">
        <div className="section-heading"><div><p className="eyebrow">{q || category !== 'all' || group !== 'all' ? copy.home.matches(found.length) : copy.home.utilities(tools.length)}</p><h2>{q ? copy.home.resultsFor(q) : category !== 'all' ? copy.home.categoryTools(copy.category[category] ?? category) : group !== 'all' ? copy.home.groupTools(copy.group[group] ?? group) : copy.home.allTools}</h2></div><LocaleLink to="/tools">{copy.home.openCatalog} <ArrowRight size={16}/></LocaleLink></div>
        {found.length
          ? <AvailabilityFlipGrids available={availableMatches} comingSoon={comingSoonMatches} />
          : <div className="no-results"><Search size={28}/><h3>{copy.home.noToolsFound}</h3><p>{copy.home.noToolsHint}</p><button className="button secondary" type="button" onClick={() => updateSearch({ q: '', category: 'all', group: 'all' })}>{copy.home.clearFilters}</button></div>}
      </section>

      <section className="page-section privacy-section"><div className="privacy-mark"><ShieldCheck size={28}/></div><div><p className="eyebrow">{copy.home.privacyEyebrow}</p><h2>{copy.home.privacyTitle}</h2><p>{copy.home.privacyCopy}</p></div><div className="privacy-points"><span><LockKeyhole size={18}/><strong>{copy.home.localFirst}</strong>{copy.home.localFirstCopy}</span><span><ShieldCheck size={18}/><strong>{copy.home.clearLabels}</strong>{copy.home.clearLabelsCopy}</span><span><Zap size={18}/><strong>{copy.home.noSignIn}</strong>{copy.home.noSignInCopy}</span></div></section>
    </main>
  )
}

function FilterPills<T extends string>({ items, value, label, secondary = false, onChange, getLabel }: { items: readonly T[]; value: T; label: string; secondary?: boolean; onChange: (value: T) => void; getLabel?: (item: T) => string }) {
  return <div className={`category-tabs${secondary ? ' group-tabs' : ''}`} aria-label={label}>{items.map((item) => <button type="button" className={value === item ? 'active' : ''} data-active={value === item ? 'true' : 'false'} aria-pressed={value === item} key={item} onClick={() => onChange(item)}>{getLabel ? getLabel(item) : item}</button>)}</div>
}
function ToolSection({ id, eyebrow, title, icon, items, empty }: { id: string; eyebrow: string; title: string; icon: ReactNode; items: readonly ToolDefinition[]; empty: string }) {
  return <section id={id} className="page-section discovery-personal"><div className="section-heading"><div><p className="eyebrow">{icon}{eyebrow}</p><h2>{title}</h2></div></div>{items.length ? <HorizontalToolList items={items} label={title}/> : <p>{empty}</p>}</section>
}

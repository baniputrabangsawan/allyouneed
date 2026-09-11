import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Clock3, LockKeyhole, Search, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { z } from 'zod'
import { AvailabilityFlipGrids, ToolFlipGrid } from '@/components/tool/ToolFlipGrid'
import { partitionByAvailability } from '@/features/tools/tool-availability'
import {
  getNewTools,
  getPopularTools,
  searchTools,
  tools,
  type ToolDefinition,
} from '@/features/tools/tool-registry'
import { useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { refreshScroll, revealSectionOnce } from '@/lib/motion/scroll'
import { DISCOVERY_STORAGE_EVENT, useFavoriteIds } from '@/lib/storage/discovery'
import { loadRecentIds } from '@/lib/storage/recent-ssr'
import { RECENT_TOOLS_STORAGE_KEY, writeRecentCookie } from '@/lib/storage/tools'
import { holdElementViewportTop, restoreHomeScroll, writeHomeScroll } from '@/lib/storage/scroll'

const categories = ['all', 'image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const
const groups = ['all', 'optimize', 'create', 'edit', 'convert', 'security'] as const
type CategoryFilter = typeof categories[number]
type GroupFilter = typeof groups[number]

const searchSchema = z.object({
  q: z.string().catch('').default(''),
  category: z.enum(categories).catch('all').default('all'),
  group: z.enum(groups).catch('all').default('all'),
})

export const Route = createFileRoute('/')({ validateSearch: searchSchema, loader: () => loadRecentIds(), component: Home })

function filterTools(query: string, category: CategoryFilter, group: GroupFilter) {
  return searchTools(query).filter((tool) =>
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
  return ids.map((id) => tools.find((tool) => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool))
}

function Home() {
  const ssrRecentIds = Route.useLoaderData()
  const { q, category, group } = Route.useSearch()
  const navigate = Route.useNavigate()
  const hash = useRouterState({ select: (state) => state.location.hash })
  const skipHashScroll = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const homeRef = useRef<HTMLElement>(null)
  const catalogRef = useRef<HTMLElement>(null)
  const catalogTopRef = useRef<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const favorites = toolsForIds(useFavoriteIds()).slice(0, 10)
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
  }, { scope: homeRef })
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
    restoreHomeScroll()
    refreshScroll()
  }, [])

  useEffect(() => {
    const onScroll = () => writeHomeScroll(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    holdElementViewportTop(catalogRef.current, catalogTopRef.current)
    catalogTopRef.current = null
    writeHomeScroll(window.scrollY)
    refreshScroll()
  }, [q, category, group])

  useEffect(() => {
    if (skipHashScroll.current) {
      skipHashScroll.current = false
      return
    }
    const id = hash.replace(/^#/, '')
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [hash])

  function updateSearch(next: Partial<{ q: string; category: CategoryFilter; group: GroupFilter }>) {
    catalogTopRef.current = catalogRef.current?.getBoundingClientRect().top ?? null
    void navigate({ search: { q, category, group, ...next }, replace: true, resetScroll: false })
  }

  function openTool(tool: ToolDefinition | undefined) {
    if (!tool) return
    setSearchOpen(false)
    void navigate({ to: '/$tool', params: { tool: tool.slug } })
  }

  return (
    <main ref={homeRef}>
      <section className="hero discovery-hero">
        <div className="hero-grid">
          <div><p className="eyebrow"><Sparkles size={14}/> Useful by default</p><h1><span className="hero-title-line">Every tool you need.</span><br/><span className="hero-title-line">In one place.</span></h1><p className="hero-copy">Compress, convert, edit, and generate directly in your browser. Fast, private, and free to start.</p></div>
          <div className="hero-proof"><div className="proof-number">{workingCount}</div><p>working tools today</p><div className="proof-rule"/><span><ShieldCheck size={17}/> Most run locally</span></div>
        </div>
        <div className="search-combobox" onFocus={() => setSearchOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}>
          <div className="search-box" id="search"><Search size={23}/><input ref={inputRef} value={q} role="combobox" aria-autocomplete="list" aria-controls="home-search-results" aria-expanded={searchOpen && Boolean(q)} aria-activedescendant={searchOpen && suggestions[activeIndex] ? `home-search-option-${activeIndex}` : undefined} onChange={(event) => { updateSearch({ q: event.target.value }); setActiveIndex(0); setSearchOpen(true) }} onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSearchOpen(true); setActiveIndex((index) => (index + 1) % Math.max(suggestions.length, 1)) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSearchOpen(true); setActiveIndex((index) => (index - 1 + Math.max(suggestions.length, 1)) % Math.max(suggestions.length, 1)) }
            if (event.key === 'Enter' && searchOpen) { event.preventDefault(); openTool(suggestions[activeIndex]) }
            if (event.key === 'Escape') { event.preventDefault(); setSearchOpen(false); inputRef.current?.blur() }
          }} placeholder={`Search ${tools.length} tools...`} aria-label="Search tools" autoComplete="off"/><kbd>/</kbd></div>
          {searchOpen && q && <div className="search-suggestions" id="home-search-results" role="listbox" aria-label="Matching tools">{suggestions.map((tool, index) => <button id={`home-search-option-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} type="button" key={tool.id} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => openTool(tool)}><span><strong>{tool.name}</strong><small>{tool.shortDescription}</small></span><span className="suggestion-category">{tool.category}</span></button>)}{!suggestions.length && <p>No working tools match this search.</p>}</div>}
        </div>
        <FilterPills items={categories} value={category} label="Tool categories" onChange={(value) => updateSearch({ category: value })}/>
        <FilterPills items={groups} value={group} label="Tool groups" secondary onChange={(value) => updateSearch({ group: value })}/>
      </section>

      {showDiscovery && (
        <div className="discovery-stack">
          <ToolSection id="recent" eyebrow="Back to work" title="Recently used" icon={<Clock3 size={14}/>} items={recent} empty="Open a tool and it will show up here."/>
          <ToolSection id="favorites" eyebrow="Saved by you" title="Favorites" icon={<Star size={14}/>} items={favorites} empty="Star a tool to keep it here."/>
          <ToolSection id="new" eyebrow="Just added" title="New" icon={<Sparkles size={14}/>} items={newest} empty="No new tools right now."/>
          <section className="page-section popular"><div className="section-heading"><div><p className="eyebrow">Start here</p><h2>Popular tools</h2></div><a href="#all-tools">Browse all <ArrowRight size={16}/></a></div><ToolFlipGrid items={getPopularTools()}/></section>
        </div>
      )}

      <section ref={catalogRef} className="page-section" id="all-tools">
        <div className="section-heading"><div><p className="eyebrow">{q || category !== 'all' || group !== 'all' ? `${found.length} matches` : `${tools.length} utilities`}</p><h2>{q ? `Results for “${q}”` : category !== 'all' ? `${category} tools` : group !== 'all' ? `${group} tools` : 'All tools'}</h2></div><a href="/tools">Open catalog <ArrowRight size={16}/></a></div>
        {found.length
          ? <AvailabilityFlipGrids available={availableMatches} comingSoon={comingSoonMatches} />
          : <div className="no-results"><Search size={28}/><h3>No tools found</h3><p>Try a format, action, or broader keyword.</p><button className="button secondary" type="button" onClick={() => updateSearch({ q: '', category: 'all', group: 'all' })}>Clear filters</button></div>}
      </section>

      <section className="page-section privacy-section"><div className="privacy-mark"><ShieldCheck size={28}/></div><div><p className="eyebrow">Privacy, made explicit</p><h2>Your work stays yours.</h2><p>Local tools process files and text in this browser. When a tool needs a server, we label it before you start, so there are no quiet uploads or account walls.</p></div><div className="privacy-points"><span><LockKeyhole size={18}/><strong>Local first</strong>Data stays on your device when supported.</span><span><ShieldCheck size={18}/><strong>Clear labels</strong>Processing location appears on every card.</span><span><Zap size={18}/><strong>No sign-in</strong>Open a working tool and use it immediately.</span></div></section>
    </main>
  )
}

function FilterPills<T extends string>({ items, value, label, secondary = false, onChange }: { items: readonly T[]; value: T; label: string; secondary?: boolean; onChange: (value: T) => void }) {
  return <div className={`category-tabs${secondary ? ' group-tabs' : ''}`} aria-label={label}>{items.map((item) => <button type="button" className={value === item ? 'active' : ''} aria-pressed={value === item} key={item} onClick={() => onChange(item)}>{item}</button>)}</div>
}

function ToolSection({ id, eyebrow, title, icon, items, empty }: { id: string; eyebrow: string; title: string; icon: ReactNode; items: readonly ToolDefinition[]; empty: string }) {
  return <section id={id} className="page-section discovery-personal"><div className="section-heading"><div><p className="eyebrow">{icon}{eyebrow}</p><h2>{title}</h2></div></div>{items.length ? <ToolFlipGrid items={items}/> : <p>{empty}</p>}</section>
}

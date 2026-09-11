import { BookOpen, Search, Wrench } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { docsArticlePath, searchDocs } from '@/content/docs/catalog'
import {
  getPopularTools,
  getToolBySlug,
  type ToolDefinition,
} from '@/features/tools/tool-registry'
import { localizeTo, useLocale, useT } from '@/i18n'
import { useLocaleNavigate } from '@/i18n/navigate'
import { localizeTool, searchToolsLocalized } from '@/i18n/tools'
import { getRecentTools } from '@/lib/storage/tools'

type PaletteTool = ToolDefinition & { source?: 'Recent' | 'Popular' }
type PaletteItem =
  | { kind: 'tool'; id: string; title: string; subtitle: string; slug: string; source?: 'Recent' | 'Popular' }
  | { kind: 'docs'; id: string; title: string; subtitle: string; slug: string; article: boolean }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const navigate = useLocaleNavigate()
  const locale = useLocale()
  const copy = useT()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentIds, setRecentIds] = useState<readonly string[]>([])

  const recent = recentIds.map(getToolBySlug).filter((tool): tool is ToolDefinition => Boolean(tool?.available))
  const defaults: PaletteTool[] = [
    ...recent.map((tool) => ({ ...tool, source: 'Recent' as const })),
    ...getPopularTools().filter((tool) => !recent.some(({ id }) => id === tool.id)).map((tool) => ({ ...tool, source: 'Popular' as const })),
  ]
  const tools: readonly PaletteTool[] = (query ? searchToolsLocalized(query).filter((tool) => tool.available) : defaults).slice(0, 8)
  const items: PaletteItem[] = [
    ...tools.map((tool) => {
      const item = localizeTool(tool, locale)
      return { kind: 'tool' as const, id: tool.id, title: item.name, subtitle: copy.category[tool.category] ?? tool.category, slug: tool.slug, ...(tool.source ? { source: tool.source } : {}) }
    }),
    ...(!query ? [] : searchDocs(query).slice(0, 2).map((hit) => ({
      kind: 'docs' as const,
      id: `docs-${hit.kind}-${hit.slug}`,
      title: hit.kind === 'tool' ? copy.palette.howTo(localizeTool({ ...getToolBySlug(hit.slug)!, slug: hit.slug } as ToolDefinition, locale).name) : hit.title,
      subtitle: copy.palette.docs,
      slug: hit.slug,
      article: hit.kind === 'article',
    }))),
  ]

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setRecentIds(getRecentTools())
        dialog.showModal()
      }
      inputRef.current?.focus()
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
      return () => window.cancelAnimationFrame(frame)
    }
    if (dialog.open) {
      dialog.close()
      returnFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    const active = resultsRef.current?.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, items.length])

  function close() {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }

  function choose(item: PaletteItem | undefined) {
    if (!item) return
    close()
    if (item.kind === 'docs') {
      if (item.article) void navigate({ to: docsArticlePath(item.slug) })
      else void navigate({ to: '/docs/tools/$slug', params: { slug: item.slug } })
      return
    }
    void navigate({ to: '/$tool', params: { tool: item.slug } })
  }

  return <dialog ref={dialogRef} className="command-dialog" aria-labelledby="command-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === dialogRef.current) close() }}>
    <div className="command-panel" onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % Math.max(items.length, 1)) }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => (index - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)) }
      if (event.key === 'Enter') { event.preventDefault(); choose(items[activeIndex]) }
    }}>
      <h2 id="command-title" className="sr-only">{copy.palette.title}</h2>
      <label className="command-search"><Search size={20} /><span className="sr-only">{copy.palette.title}</span><input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={items[activeIndex] ? `command-result-${activeIndex}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} placeholder={copy.palette.placeholder} autoComplete="off" /><kbd>Esc</kbd></label>
      <div ref={resultsRef} id="command-results" className="command-results" role="listbox" aria-label={query ? copy.home.matchingTools : copy.palette.popular}>
        {items.map((item, index) => {
          const previous = items[index - 1]
          const Icon = item.kind === 'docs' ? BookOpen : Wrench
          const section = item.kind === 'docs' ? copy.palette.docs : !query ? (item.source === 'Recent' ? copy.palette.recent : copy.palette.popular) : undefined
          const previousSection = previous?.kind === 'docs' ? copy.palette.docs : !query && previous?.kind === 'tool' ? (previous.source === 'Recent' ? copy.palette.recent : copy.palette.popular) : undefined
          return <div key={item.id}>{section && section !== previousSection && <p className="command-section-label">{section}</p>}<button id={`command-result-${index}`} data-result-index={index} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}><Icon size={17} /><span>{item.title}</span><small>{item.subtitle}</small></button></div>
        })}
        {!items.length && <div className="command-empty"><Search size={22} /><p>{copy.palette.empty}</p></div>}
      </div>
      <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> {copy.palette.navigate}</span><span><kbd>↵</kbd> {copy.palette.open}</span><span>{copy.palette.searchAll}</span></div>
    </div>
  </dialog>
}

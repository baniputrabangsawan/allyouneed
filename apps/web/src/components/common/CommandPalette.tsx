import { useNavigate } from '@tanstack/react-router'
import { Search, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  getPopularTools,
  getToolBySlug,
  searchTools,
  type ToolDefinition,
} from '@/features/tools/tool-registry'
import { getRecentTools } from '@/lib/storage/tools'

type PaletteTool = ToolDefinition & { source?: 'Recent' | 'Popular' }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentIds, setRecentIds] = useState<readonly string[]>([])

  const recent = recentIds.map(getToolBySlug).filter((tool): tool is ToolDefinition => Boolean(tool?.available))
  const defaults: PaletteTool[] = [
    ...recent.map((tool) => ({ ...tool, source: 'Recent' as const })),
    ...getPopularTools().filter((tool) => !recent.some(({ id }) => id === tool.id)).map((tool) => ({ ...tool, source: 'Popular' as const })),
  ]
  const results: readonly PaletteTool[] = (query ? searchTools(query).filter((tool) => tool.available) : defaults).slice(0, 10)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setRecentIds(getRecentTools())
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      returnFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    const active = resultsRef.current?.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, results.length])

  function close() {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }

  function choose(tool: PaletteTool | undefined) {
    if (!tool) return
    close()
    void navigate({ to: '/$tool', params: { tool: tool.slug } })
  }

  return <dialog ref={dialogRef} className="command-dialog" aria-labelledby="command-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === dialogRef.current) close() }}>
    <div className="command-panel" onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % Math.max(results.length, 1)) }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => (index - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1)) }
      if (event.key === 'Enter') { event.preventDefault(); choose(results[activeIndex]) }
    }}>
      <h2 id="command-title" className="sr-only">Search tools</h2>
      <label className="command-search"><Search size={20} /><span className="sr-only">Search tools</span><input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={results[activeIndex] ? `command-result-${activeIndex}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} placeholder="Search tools..." autoComplete="off" /><kbd>Esc</kbd></label>
      <div ref={resultsRef} id="command-results" className="command-results" role="listbox" aria-label={query ? 'Search results' : 'Recent and popular tools'}>
        {results.map((tool, index) => <div key={tool.id}>{!query && tool.source !== results[index - 1]?.source && <p className="command-section-label">{tool.source}</p>}<button id={`command-result-${index}`} data-result-index={index} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(tool)}><Wrench size={17} /><span>{tool.name}</span><small>{tool.category}</small></button></div>)}
        {!results.length && <div className="command-empty"><Search size={22} /><p>No matching tools. Try a format or action.</p></div>}
      </div>
      <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span>Search all tools</span></div>
    </div>
  </dialog>
}

import { useState } from 'react'
import { useT } from '@/i18n'
import type { ToolDefinition } from '../tools/tool-registry'
import { CHANGE_FREQS, generateSitemap, type SitemapRowInput } from './sitemap-xml'
import { CopyButton, DownloadButton } from './workspace-ui'

interface SitemapRow extends SitemapRowInput {
  id: number
}

let nextId = 1
const emptyRow = (): SitemapRow => ({ id: nextId++, loc: '', lastmod: '', changefreq: '', priority: '' })

export function SitemapWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT().sitemap
  const [paste, setPaste] = useState('')
  const [rows, setRows] = useState<SitemapRow[]>([emptyRow()])
  const result = generateSitemap(rows)

  function update(id: number, patch: Partial<SitemapRowInput>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function addPasted() {
    const lines = [...new Set(paste.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))]
    if (!lines.length) return
    setRows((current) => {
      const filled = current.filter((row) => row.loc.trim())
      const seen = new Set(filled.map((row) => row.loc.trim()))
      const next = [...filled]
      for (const line of lines) {
        if (seen.has(line)) continue
        seen.add(line)
        next.push({ ...emptyRow(), loc: line })
      }
      return next.length ? next : [emptyRow()]
    })
    setPaste('')
  }

  function removeDuplicates() {
    setRows((current) => {
      const seen = new Set<string>()
      const next: SitemapRow[] = []
      for (const row of current) {
        const loc = row.loc.trim()
        if (!loc || seen.has(loc)) continue
        seen.add(loc)
        next.push({ ...row, loc })
      }
      return next.length ? next : [emptyRow()]
    })
  }

  function reset() {
    nextId = 1
    setPaste('')
    setRows([emptyRow()])
  }

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <label className="field">
          <span>{copy.paste}</span>
          <textarea
            aria-label={copy.paste}
            rows={6}
            spellCheck={false}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder="https://example.com/&#10;https://example.com/about"
          />
        </label>
        <p className="option-help">{copy.pasteHelp}</p>
        <div className="button-row">
          <button className="button secondary" type="button" onClick={addPasted}>{copy.addPasted}</button>
        </div>
        <div className="counter-stats" aria-live="polite">
          <div><strong>{result.total}</strong><span>{copy.total}</span></div>
          <div><strong>{result.valid}</strong><span>{copy.valid}</span></div>
          <div><strong>{result.invalid}</strong><span>{copy.invalid}</span></div>
        </div>
        {rows.map((row, index) => {
          const status = result.rows[index]
          return (
            <div className="robots-group" key={row.id}>
              <label className="field">
                <span>{copy.loc}</span>
                <input
                  aria-label={copy.loc}
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  value={row.loc}
                  aria-invalid={status?.locError || undefined}
                  onChange={(event) => update(row.id, { loc: event.target.value })}
                  placeholder="https://example.com/"
                />
              </label>
              {status?.locError ? <p className="field-error" role="alert">{copy.invalidUrl}</p> : null}
              {status?.duplicate ? <p className="field-error" role="alert">{copy.duplicate}</p> : null}
              <div className="field-grid">
                <label className="field">
                  <span>{copy.lastmod} ({copy.optional})</span>
                  <input
                    aria-label={copy.lastmod}
                    spellCheck={false}
                    value={row.lastmod ?? ''}
                    aria-invalid={status?.lastmodError || undefined}
                    onChange={(event) => update(row.id, { lastmod: event.target.value })}
                    placeholder="2026-09-15"
                  />
                </label>
                <label className="field">
                  <span>{copy.changefreq} ({copy.optional})</span>
                  <select
                    aria-label={copy.changefreq}
                    value={row.changefreq ?? ''}
                    onChange={(event) => update(row.id, { changefreq: event.target.value })}
                  >
                    <option value="">{copy.none}</option>
                    {CHANGE_FREQS.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              {status?.lastmodError ? <p className="field-error" role="alert">{copy.invalidLastmod}</p> : null}
              <label className="field">
                <span>{copy.priority} ({copy.optional})</span>
                <input
                  aria-label={copy.priority}
                  inputMode="decimal"
                  spellCheck={false}
                  value={row.priority ?? ''}
                  aria-invalid={status?.priorityError || undefined}
                  onChange={(event) => update(row.id, { priority: event.target.value })}
                  placeholder="0.5"
                />
              </label>
              {status?.priorityError ? <p className="field-error" role="alert">{copy.invalidPriority}</p> : null}
              {rows.length > 1 ? (
                <div className="button-row">
                  <button className="button secondary" type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>{copy.removeUrl}</button>
                </div>
              ) : null}
            </div>
          )
        })}
        <div className="button-row">
          <button className="button secondary" type="button" onClick={() => setRows((current) => [...current, emptyRow()])}>{copy.addUrl}</button>
          <button className="button secondary" type="button" onClick={removeDuplicates}>{copy.removeDuplicates}</button>
          <button className="button secondary" type="button" onClick={reset}>{copy.reset}</button>
        </div>
        <p className="local-note">{copy.disclaimer}</p>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.generatedXml}</span></div>
        <label className="counter-editor">
          <span className="sr-only">{copy.generatedXml}</span>
          <textarea aria-label={copy.generatedXml} readOnly spellCheck={false} value={result.xml} />
        </label>
        <div className="button-row">
          <CopyButton value={result.xml} label={copy.copyXml} />
          <DownloadButton value={result.xml} filename="sitemap.xml" type="application/xml" label={copy.downloadXml} />
        </div>
      </div>
    </section>
  )
}

import { useParams } from '@tanstack/react-router'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Suspense, useEffect, useSyncExternalStore } from 'react'
import { ToolCard } from '@/components/tool/ToolCard'
import { LocaleLink as Link } from '@/i18n/link'
import { PremiumGate } from '@/features/licensing/PremiumGate'
import { ComingSoonToolState } from '@/features/tools/ComingSoonToolState'
import { publicToolAudienceState } from '@/features/tools/tool-availability'
import { getRelatedTools, getToolBySlug, type ToolDefinition } from '@/features/tools/tool-registry'
import { getLazyWorkspace } from '@/features/workspaces/lazy-workspaces'
import { categoryLabel, categorySeoPath, getToolSeo, toolJsonLd } from '@/features/seo/tool-seo'
import { getToolPageCopy } from '@/features/tools/tool-content'
import { useLocale, type Locale } from '@/i18n'
import { localizeTool } from '@/i18n/tools'
import { addRecentTool } from '@/lib/storage/tools'

export function ToolRoute() {
  const params = useParams({ strict: false }) as { tool?: string; category?: string }
  const slug = params.tool ?? params.category ?? ''
  const locale = useLocale()
  const tool = getToolBySlug(slug)
  useEffect(() => { if (tool) addRecentTool(tool.id) }, [tool])
  if (!tool) return null
  const seo = getToolSeo(tool, locale)
  const item = localizeTool(tool, locale)
  const comingSoon = publicToolAudienceState(tool) === 'coming-soon'
  return (
    <main className="tool-page">
      <div className="tool-container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/" search={{ q: '', category: 'all', group: 'all' }}>Home</Link>
          <ChevronRight size={14} />
          <a href={categorySeoPath(locale, tool.category)}>{categoryLabel(tool.category, locale)}</a>
          <ChevronRight size={14} />
          <span>{item.name}</span>
        </nav>
        <header className="tool-heading">
          <div>
            <p className="eyebrow">{tool.category} tool{tool.requiresPro ? ' · Pro' : ''}</p>
            <h1>{seo.h1}</h1>
            <p>{seo.intro}</p>
          </div>
          {comingSoon ? null : (
            <div className={`privacy-chip ${tool.processingMode}`}>
              <ShieldCheck size={18} />
              <span>
                <strong>{tool.processingMode === 'client' ? 'Local processing' : 'Server processing'}</strong>
                {tool.processingMode === 'client' ? 'Your data stays here' : 'Requires a server'}
              </span>
            </div>
          )}
        </header>
        {comingSoon ? (
          <ComingSoonToolState tool={tool} />
        ) : (
          <PremiumGate tool={tool}>
            <ToolWorkspace tool={tool} />
          </PremiumGate>
        )}
        {comingSoon ? null : <InfoSections tool={tool} />}
      </div>
    </main>
  )
}

function ToolWorkspace({ tool }: { tool: ToolDefinition }) {
  const Workspace = getLazyWorkspace(tool)
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot)
  if (Workspace && tool.available) {
    if (!hydrated) return <WorkspaceLoading />
    return <Suspense fallback={<WorkspaceLoading />}><Workspace key={tool.slug} tool={tool} /></Suspense>
  }
  return <ComingSoonToolState tool={tool} />
}

const subscribeToHydration = () => () => undefined
const clientHydrationSnapshot = () => true
const serverHydrationSnapshot = () => false

function WorkspaceLoading() {
  return <section className="workspace" aria-busy="true" aria-label="Loading tool" />
}

function InfoSections({ tool }: { tool: ToolDefinition }) {
  const locale = useLocale()
  const seo = getToolSeo(tool, locale)
  const item = localizeTool(tool, locale)
  const related = getRelatedTools(tool)
  return (
    <>
      {toolJsonLd(tool, locale).map((data, index) => <script key={index} type="application/ld+json">{JSON.stringify(data)}</script>)}
      <section className="tool-info">
        <div>
          <p className="eyebrow">{locale === 'id' ? 'Cara pakai' : 'How it works'}</p>
          <h2>{locale === 'id' ? `Cara menggunakan ${item.name}` : `How to use ${item.name}`}</h2>
        </div>
        <ol>
          {seo.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}
        </ol>
      </section>
      <section className="tool-info">
        <div>
          <p className="eyebrow">{locale === 'id' ? 'Manfaat' : 'Benefits'}</p>
          <h2>{locale === 'id' ? `Kenapa memakai ${item.name}?` : `Why use ${item.name}?`}</h2>
        </div>
        <ul className="tool-info-list">{seo.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      </section>
      <section className="tool-info">
        <div>
          <p className="eyebrow">{locale === 'id' ? 'Format' : 'Formats'}</p>
          <h2>{locale === 'id' ? 'Format yang didukung' : 'Supported formats'}</h2>
        </div>
        <SupportedFormats tool={tool} locale={locale} />
      </section>
      <section className="privacy-banner">
        <ShieldCheck size={28} />
        <div>
          <h2>{locale === 'id' ? 'Privasi dan pemrosesan' : 'Privacy and processing'}</h2>
          <p>{tool.processingMode === 'client'
            ? (locale === 'id' ? 'Tool ini berjalan di browser Anda. File dan konten tidak diunggah.' : 'This tool works inside your browser. Your files and content are not uploaded.')
            : (locale === 'id' ? 'Tool ini memerlukan pemrosesan sementara di server Kits dan tetap divalidasi oleh sistem entitlement.' : 'This tool requires temporary Kits server processing and remains protected by backend entitlement checks when it is Pro.')}</p>
        </div>
      </section>
      <section className="tool-info">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2>{locale === 'id' ? 'Pertanyaan umum' : 'Frequently asked questions'}</h2>
        </div>
        <div className="tool-faq">{seo.faq.map((faq) => <article key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}</div>
      </section>
      {related.length > 0 && (
        <section className="related">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{locale === 'id' ? 'Tool terkait' : 'Keep going'}</p>
              <h2>{locale === 'id' ? `Tool terkait ${item.name}` : `Related ${categoryLabel(tool.category, locale).toLowerCase()}`}</h2>
            </div>
          </div>
          <div className="tool-grid">{related.map((relatedTool) => <ToolCard tool={relatedTool} key={relatedTool.id} />)}</div>
        </section>
      )}
    </>
  )
}

function SupportedFormats({ tool, locale }: { tool: ToolDefinition; locale: Locale }) {
  const page = getToolPageCopy(tool.slug, locale)
  const input = page?.inputFormats ?? []
  const output = page?.outputFormats ?? []
  return (
    <div>
      <p>{locale === 'id' ? 'Input' : 'Input'}: {input.join(', ')}</p>
      <p>{locale === 'id' ? 'Keluaran' : 'Output'}: {output.join(', ')}</p>
    </div>
  )
}

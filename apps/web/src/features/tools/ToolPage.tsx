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
import { addRecentTool } from '@/lib/storage/tools'

export function ToolRoute() {
  const params = useParams({ strict: false }) as { tool: string }
  const tool = getToolBySlug(params.tool)
  useEffect(() => { if (tool) addRecentTool(tool.id) }, [tool])
  if (!tool) return null
  const comingSoon = publicToolAudienceState(tool) === 'coming-soon'
  return (
    <main className="tool-page">
      <div className="tool-container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/" search={{ q: '', category: 'all', group: 'all' }}>Home</Link>
          <ChevronRight size={14} />
          <Link to="/" search={{ q: '', category: tool.category, group: 'all' }}>{tool.category}</Link>
          <ChevronRight size={14} />
          <span>{tool.name}</span>
        </nav>
        <header className="tool-heading">
          <div>
            <p className="eyebrow">{tool.category} tool{tool.accessTier === 'pro' || tool.premium ? ' · Pro' : ''}</p>
            <h1>{tool.name}</h1>
            <p>{tool.shortDescription}</p>
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
  const related = getRelatedTools(tool)
  return (
    <>
      <section className="tool-info">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Useful without a learning curve.</h2>
        </div>
        <ol>
          <li><span>01</span>Add your input</li>
          <li><span>02</span>Choose only the settings you need</li>
          <li><span>03</span>Process and save the result</li>
        </ol>
      </section>
      <section className="privacy-banner">
        <ShieldCheck size={28} />
        <div>
          <h2>Private by design</h2>
          <p>{tool.processingMode === 'client' ? 'This tool works inside your browser. Your files and content are not uploaded.' : 'This tool requires temporary server processing and will clearly say so before upload.'}</p>
        </div>
      </section>
      {related.length > 0 && (
        <section className="related">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Keep going</p>
              <h2>Related tools</h2>
            </div>
          </div>
          <div className="tool-grid">{related.map((item) => <ToolCard tool={item} key={item.id} />)}</div>
        </section>
      )}
    </>
  )
}

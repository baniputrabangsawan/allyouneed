import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChevronRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { ToolCard } from '@/components/tool/ToolCard'
import { HtmlToImageWorkspace } from '@/features/image/HtmlToImageWorkspace'
import { ImageWorkspace } from '@/features/image/ImageWorkspace'
import { SvgToPngWorkspace } from '@/features/image/SvgToPngWorkspace'
import { PremiumGate } from '@/features/licensing/PremiumGate'
import { getRelatedTools, getToolBySlug, type ToolDefinition } from '@/features/tools/tool-registry'
import { getWorkspaceComponent } from '@/features/workspaces'
import { addRecentTool } from '@/lib/storage/tools'

export const Route = createFileRoute('/$tool')({
  beforeLoad: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    if (!tool) throw notFound()
    return { tool }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    const title = tool?.seo.title ?? 'Online Tool'
    const description = tool?.seo.description ?? 'A fast browser utility.'
    const canonical = tool ? `/${tool.slug}` : `/${params.tool}`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: canonical },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: ToolRoute,
})

function ToolRoute() {
  const { tool } = Route.useRouteContext()
  useEffect(() => { addRecentTool(tool.id) }, [tool.id])
  return <main className="tool-page"><div className="tool-container"><nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><ChevronRight size={14}/><a href={`/?category=${tool.category}`}>{tool.category}</a><ChevronRight size={14}/><span>{tool.name}</span></nav><header className="tool-heading"><div><p className="eyebrow">{tool.category} tool{tool.accessTier === 'pro' || tool.premium ? ' · Pro' : ''}</p><h1>{tool.name}</h1><p>{tool.shortDescription}</p></div><div className={`privacy-chip ${tool.processingMode}`}><ShieldCheck size={18}/><span><strong>{tool.processingMode === 'client' ? 'Local processing' : 'Server processing'}</strong>{tool.processingMode === 'client' ? 'Your data stays here' : 'Requires a server'}</span></div></header><PremiumGate tool={tool}><ToolWorkspace tool={tool}/></PremiumGate><InfoSections tool={tool}/></div></main>
}

function ToolWorkspace({ tool }: { tool: ToolDefinition }) {
  if (tool.slug === 'svg-to-png' && tool.available) return <SvgToPngWorkspace key={tool.slug} tool={tool}/>
  if (tool.slug === 'html-to-image' && tool.available) return <HtmlToImageWorkspace key={tool.slug} tool={tool}/>
  if (tool.implementation === 'image-canvas' && tool.available) return <ImageWorkspace key={tool.slug} tool={tool}/>
  const Workspace = getWorkspaceComponent(tool)
  if (Workspace && tool.available) return <Workspace tool={tool}/>
  return <UnavailableWorkspace tool={tool}/>
}

function UnavailableWorkspace({ tool }: { tool: ToolDefinition }) {
  const needsServer = tool.processingMode === 'remote'
  return <section className="workspace unavailable-workspace"><div className="unavailable-icon"><LockKeyhole size={24}/></div><p className="eyebrow">{needsServer ? 'Backend service not configured' : 'Frontend module not installed'}</p><h2>{tool.name} is not available yet.</h2><p>{needsServer ? 'The interface and API contract are ready, but this tool needs a processing service. No file will be uploaded.' : 'This format needs a specialized browser module that is not included in the current bundle. The action stays disabled rather than returning a fake result.'}</p><button className="button primary" type="button" disabled>{needsServer ? 'Service not configured' : 'Coming soon'}</button></section>
}

function InfoSections({ tool }: { tool: ToolDefinition }) {
  const related = getRelatedTools(tool)
  return <><section className="tool-info"><div><p className="eyebrow">How it works</p><h2>Useful without a learning curve.</h2></div><ol><li><span>01</span>Add your input</li><li><span>02</span>Choose only the settings you need</li><li><span>03</span>Process and save the result</li></ol></section><section className="privacy-banner"><ShieldCheck size={28}/><div><h2>Private by design</h2><p>{tool.processingMode === 'client' ? 'This tool works inside your browser. Your files and content are not uploaded.' : 'This tool requires temporary server processing and will clearly say so before upload.'}</p></div></section>{related.length > 0 && <section className="related"><div className="section-heading"><div><p className="eyebrow">Keep going</p><h2>Related tools</h2></div></div><div className="tool-grid">{related.map((item) => <ToolCard tool={item} key={item.id}/>)}</div></section>}</>
}

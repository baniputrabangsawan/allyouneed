import { Search } from 'lucide-react'
import { DiscoveryToolCard } from '@/components/common/DiscoveryToolCard'
import { getPopularTools } from '@/features/tools/tool-registry'

export function NotFoundPage() {
  return <main id="main-content" className="not-found-page">
    <section className="not-found-copy"><p className="eyebrow">404 / Lost utility</p><h1>That tool isn’t in the kit.</h1><p>The address may have changed, or the tool is not available yet. Search the full directory or start with a reliable favorite.</p><form className="not-found-search" action="/" method="get"><Search size={20}/><label className="sr-only" htmlFor="not-found-query">Search tools</label><input id="not-found-query" name="q" placeholder="Try “compress image”"/><button className="button primary" type="submit">Search</button></form><a className="text-link" href="/">Back to all tools</a></section>
    <section className="page-section"><div className="section-heading"><div><p className="eyebrow">Useful starting points</p><h2>Popular tools</h2></div></div><div className="tool-grid">{getPopularTools().slice(0, 5).map((tool) => <DiscoveryToolCard key={tool.id} tool={tool}/>)}</div></section>
  </main>
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { DiscoveryToolCard } from '@/components/common/DiscoveryToolCard'
import { tools } from '@/features/tools/tool-registry'

const categories = ['image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const

export const Route = createFileRoute('/tools/')({
  head: () => ({ meta: [{ title: `All ${tools.length} Tools | Kits` }, { name: 'description', content: 'Browse every Kits utility, including tools currently in development.' }] }),
  component: ToolsCatalog,
})

function ToolsCatalog() {
  return <main className="catalog-page"><header className="catalog-header"><nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><ChevronRight size={14}/><span>Tools</span></nav><p className="eyebrow">Complete catalog</p><h1>All {tools.length} tools</h1><p>Browse every utility, including what is working now and what is coming next.</p><div className="catalog-categories" aria-label="Browse by category">{categories.map((category) => <Link key={category} to="/tools/$category" params={{ category }}>{category}</Link>)}</div></header><section className="page-section catalog-grid-section"><div className="section-heading"><div><p className="eyebrow">{tools.filter((tool) => tool.available).length} available now</p><h2>Complete collection</h2></div></div><div className="tool-grid">{tools.map((tool) => <DiscoveryToolCard key={tool.id} tool={tool}/>)}</div></section></main>
}

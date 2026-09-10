import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { AvailabilityFlipGrids } from '@/components/tool/ToolFlipGrid'
import { partitionByAvailability } from '@/features/tools/tool-availability'
import { getToolsByCategory, type ToolCategory } from '@/features/tools/tool-registry'
import { useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { revealPage } from '@/lib/motion/reveal'

const validCategories: readonly ToolCategory[] = ['image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter']

export const Route = createFileRoute('/tools/$category')({
  beforeLoad: ({ params }) => {
    if (!validCategories.includes(params.category as ToolCategory)) throw notFound()
    return { category: params.category as ToolCategory }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.category[0]?.toUpperCase()}${params.category.slice(1)} Tools | Kits` }, { name: 'description', content: `Browse all ${params.category} tools in Kits.` }] }),
  component: CategoryCatalog,
})

function CategoryCatalog() {
  const { category } = Route.useRouteContext()
  const categoryTools = getToolsByCategory(category)
  const { available, comingSoon } = partitionByAvailability(categoryTools)
  const pageRef = useRef<HTMLElement>(null)
  useGSAP(() => {
    if (prefersReducedMotion()) return
    revealPage(pageRef.current?.querySelector('.catalog-header') ?? null)
  }, { scope: pageRef, dependencies: [category] })
  return (
    <main ref={pageRef} className="catalog-page">
      <header className="catalog-header">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><ChevronRight size={14}/><Link to="/tools">Tools</Link><ChevronRight size={14}/><span>{category}</span></nav>
        <p className="eyebrow">Browse by category</p>
        <h1>{category} tools</h1>
        <p>{categoryTools.length} utilities for {category === 'converter' ? 'moving between formats' : `working with ${category}`}.</p>
        <div className="catalog-categories" aria-label="Other categories">{validCategories.map((item) => <Link key={item} className={item === category ? 'active' : ''} aria-current={item === category ? 'page' : undefined} to="/tools/$category" params={{ category: item }}>{item}</Link>)}</div>
      </header>
      <section className="page-section catalog-grid-section">
        <div className="section-heading"><div><p className="eyebrow">{available.length} available now</p><h2>{category} collection</h2></div></div>
        <AvailabilityFlipGrids available={available} comingSoon={comingSoon} />
      </section>
    </main>
  )
}

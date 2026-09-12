import { useParams } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { AvailabilityFlipGrids } from '@/components/tool/ToolFlipGrid'
import { partitionByAvailability } from '@/features/tools/tool-availability'
import { getToolsByCategory, type ToolCategory } from '@/features/tools/tool-registry'
import { LocaleLink as Link } from '@/i18n/link'
import { useT } from '@/i18n'
import { validCategories } from './categories'

export function CategoryCatalog() {
  const copy = useT()
  const params = useParams({ strict: false }) as { category: ToolCategory }
  const category = params.category
  const categoryTools = getToolsByCategory(category)
  const { available, comingSoon } = partitionByAvailability(categoryTools)
  const label = copy.category[category] ?? category
  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">{copy.catalog.home}</Link><ChevronRight size={14}/><Link to="/tools">{copy.catalog.tools}</Link><ChevronRight size={14}/><span>{label}</span></nav>
        <p className="eyebrow">{copy.catalog.browseByCategory}</p>
        <h1>{copy.home.categoryTools(label)}</h1>
        <p>{copy.catalog.availableNow(categoryTools.length)}</p>
        <div className="catalog-categories" aria-label={copy.catalog.browseByCategory}>{validCategories.map((item) => <Link key={item} className={item === category ? 'active' : ''} aria-current={item === category ? 'page' : undefined} to="/tools/$category" params={{ category: item }}>{copy.category[item]}</Link>)}</div>
      </header>
      <section className="page-section catalog-grid-section">
        <div className="section-heading"><div><p className="eyebrow">{copy.catalog.availableNow(available.length)}</p><h2>{label}</h2></div></div>
        <AvailabilityFlipGrids available={available} comingSoon={comingSoon} />
      </section>
    </main>
  )
}

import { ChevronRight } from 'lucide-react'
import { AvailabilityFlipGrids } from '@/components/tool/ToolFlipGrid'
import { partitionByAvailability } from '@/features/tools/tool-availability'
import { tools } from '@/features/tools/tool-registry'
import { LocaleLink as Link } from '@/i18n/link'
import { useT } from '@/i18n'

const categories = ['image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const

export function ToolsCatalog() {
  const copy = useT()
  const { available, comingSoon } = partitionByAvailability(tools)
  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">{copy.catalog.home}</Link><ChevronRight size={14}/><span>{copy.catalog.tools}</span></nav>
        <p className="eyebrow">{copy.catalog.completeCatalog}</p>
        <h1>{copy.catalog.allTools(tools.length)}</h1>
        <p>{copy.catalog.browseCopy}</p>
        <div className="catalog-categories" aria-label={copy.catalog.browseByCategory}>{categories.map((category) => <Link key={category} to="/tools/$category" params={{ category }}>{copy.category[category]}</Link>)}</div>
      </header>
      <section className="page-section catalog-grid-section">
        <div className="section-heading"><div><p className="eyebrow">{copy.catalog.availableNow(available.length)}</p><h2>{copy.catalog.completeCollection}</h2></div></div>
        <AvailabilityFlipGrids available={available} comingSoon={comingSoon} />
      </section>
    </main>
  )
}

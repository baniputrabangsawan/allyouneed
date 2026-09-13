import { ChevronRight } from 'lucide-react'
import { absoluteUrl } from './site'
import { LocaleLink } from '@/i18n/link'
import type { EnglishTo } from '@/i18n/path'

export interface BreadcrumbItem {
  name: string
  path: string
  to?: EnglishTo
  params?: Record<string, string>
}

function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function PageBreadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd(items))}</script>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <span key={`${item.path}-${item.name}`} className="breadcrumb-item">
              {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {last || !item.to ? <span>{item.name}</span> : (
                <LocaleLink to={item.to} params={item.params as never}>{item.name}</LocaleLink>
              )}
            </span>
          )
        })}
      </nav>
    </>
  )
}

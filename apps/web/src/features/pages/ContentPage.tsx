import type { ReactNode } from 'react'
import { Breadcrumbs, type BreadcrumbItem } from '@/features/seo/breadcrumbs'

export function ContentPage({
  eyebrow,
  title,
  lead,
  crumbs,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  crumbs: readonly BreadcrumbItem[]
  children: ReactNode
}) {
  return (
    <main className="content-page">
      <div className="tool-container">
        <Breadcrumbs items={crumbs} />
        <header className="content-header">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
        </header>
        <div className="content-body">{children}</div>
      </div>
    </main>
  )
}

import type { ReactNode } from 'react'
import { PageHero } from '@/features/pages/marketing'
import { Breadcrumbs, type BreadcrumbItem } from '@/features/seo/breadcrumbs'

export function ContentPage({
  eyebrow,
  title,
  lead,
  crumbs,
  hero,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  crumbs: readonly BreadcrumbItem[]
  hero?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="marketing-page">
      <Breadcrumbs items={crumbs} />
      <PageHero eyebrow={eyebrow} title={title} lead={lead}>
        {hero}
      </PageHero>
      <div className="marketing-body">{children}</div>
    </main>
  )
}

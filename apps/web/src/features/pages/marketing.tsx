import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { LocaleLink } from '@/i18n/link'
import type { EnglishTo } from '@/i18n/path'

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  children?: ReactNode
}) {
  return (
    <header className="page-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-hero-lead">{lead}</p>
      {children}
    </header>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: string
  lead?: string
}) {
  return (
    <header className="section-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </header>
  )
}

export function PageSearch({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="page-search" htmlFor={id}>
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  )
}

export function GuideCard({
  category,
  title,
  description,
  href,
  params,
  readLabel,
  readingTime,
  toolLabel,
  toolSlug,
}: {
  category: string
  title: string
  description: string
  href: EnglishTo
  params?: Record<string, string> | undefined
  readLabel: string
  readingTime?: string | undefined
  toolLabel?: string | undefined
  toolSlug?: string | undefined
}) {
  return (
    <article className="guide-card">
      <p className="guide-card-category">{category}</p>
      <h2>
        <LocaleLink to={href} params={params as never}>{title}</LocaleLink>
      </h2>
      <p className="guide-card-copy">{description}</p>
      {readingTime ? <p className="guide-card-meta">{readingTime}</p> : null}
      <p className="guide-card-actions">
        <LocaleLink className="guide-card-read" to={href} params={params as never}>
          {readLabel}
          <ArrowRight size={16} aria-hidden="true" />
        </LocaleLink>
        {toolSlug && toolLabel ? (
          <LocaleLink className="guide-card-tool" to="/tools/$category" params={{ category: toolSlug }}>
            {toolLabel}
          </LocaleLink>
        ) : null}
      </p>
    </article>
  )
}

export function SupportCategoryCard({
  title,
  copy,
  to,
  params,
  href,
}: {
  title: string
  copy: string
  to?: EnglishTo | undefined
  params?: Record<string, string> | undefined
  href?: string | undefined
}) {
  const body = (
    <>
      <h3>{title}</h3>
      <p>{copy}</p>
    </>
  )
  if (href) {
    return (
      <a className="support-topic-card" href={href}>
        {body}
      </a>
    )
  }
  if (!to) return null
  return (
    <LocaleLink className="support-topic-card" to={to} params={params as never}>
      {body}
    </LocaleLink>
  )
}

export function FAQAccordion({
  items,
}: {
  items: readonly {
    id?: string | undefined
    question: string
    answer: string
    extra?: ReactNode
    hidden?: boolean | undefined
  }[]
}) {
  return (
    <div className="faq-accordion">
      {items.map((item) => (
        <details key={item.question} {...(item.id ? { id: item.id } : {})} hidden={Boolean(item.hidden)}>
          <summary>
            {item.question}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <p>{item.answer}</p>
          {item.extra}
        </details>
      ))}
    </div>
  )
}

export function FeatureCard({
  title,
  copy,
}: {
  title: string
  copy: string
}) {
  return (
    <article className="feature-card">
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  )
}

export function CTASection({
  title,
  copy,
  children,
}: {
  title: string
  copy: string
  children: ReactNode
}) {
  return (
    <section className="page-cta" aria-labelledby="page-cta-heading">
      <h2 id="page-cta-heading">{title}</h2>
      <p>{copy}</p>
      <div className="page-cta-actions">{children}</div>
    </section>
  )
}

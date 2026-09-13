import { useMemo, useState } from 'react'
import { getGuide, guideArticles, guideCopy, guidePath } from '@/content/guides/catalog'
import { ContentPage } from '@/features/pages/ContentPage'
import { CTASection, GuideCard, PageSearch } from '@/features/pages/marketing'
import { readingMinutes } from '@/features/pages/reading-minutes'
import { categoryLabel, categorySeoPath } from '@/features/seo/tool-seo'
import { getToolBySlug, type ToolCategory } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { localizeTool } from '@/i18n/tools'

const guideFilters = ['all', 'image', 'pdf', 'audio', 'video', 'qr'] as const

function homePath(locale: string) {
  return locale === 'id' ? '/id' : '/'
}

function articleText(title: string, description: string, intro: string, sections: readonly { heading: string; paragraphs: readonly string[] }[]) {
  return [title, description, intro, ...sections.flatMap((section) => [section.heading, ...section.paragraphs])].join(' ')
}

export function GuidesHome() {
  const copy = useT()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof guideFilters)[number]>('all')
  const p = copy.pages
  const normalized = query.trim().toLowerCase()

  const visible = useMemo(() => {
    return guideArticles.filter((article) => {
      if (category !== 'all' && article.category !== category) return false
      if (!normalized) return true
      const item = guideCopy(article, locale)
      return articleText(item.title, item.description, item.intro, item.sections).toLowerCase().includes(normalized)
    })
  }, [category, locale, normalized])

  return (
    <ContentPage
      eyebrow={p.guidesEyebrow}
      title={p.guidesTitle}
      lead={p.guidesLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.nav.guides, path: locale === 'id' ? '/id/guides' : '/guides' },
      ]}
      hero={(
        <>
          <PageSearch
            id="guides-search"
            label={p.searchGuides}
            value={query}
            onChange={setQuery}
            placeholder={p.searchGuides}
          />
          <div className="guide-filters" role="group" aria-label={copy.home.categories}>
            {guideFilters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                className={category === item ? 'active' : undefined}
                onClick={() => setCategory(item)}
              >
                {item === 'all' ? p.allCategories : categoryLabel(item, locale)}
              </button>
            ))}
          </div>
        </>
      )}
    >
      <section className="guide-catalog" aria-label={copy.nav.guides}>
        {visible.length === 0 ? (
          <p className="guide-empty">{p.guidesEmpty}</p>
        ) : (
          <div className="guide-grid">
            {visible.map((article) => {
              const item = guideCopy(article, locale)
              const minutes = readingMinutes(articleText(item.title, item.description, item.intro, item.sections))
              const tool = article.toolSlugs.map((slug) => getToolBySlug(slug)).find((entry) => entry?.available)
              return (
                <GuideCard
                  key={article.slug}
                  category={categoryLabel(article.category, locale)}
                  title={item.title}
                  description={item.description}
                  href="/guides/$slug"
                  params={{ slug: article.slug }}
                  readLabel={p.readGuide}
                  readingTime={p.minutes(minutes)}
                  toolLabel={tool ? localizeTool(tool, locale).name : undefined}
                  toolSlug={tool?.slug}
                />
              )
            })}
          </div>
        )}
      </section>
      <CTASection title={copy.pages.exploreTools} copy={copy.pages.exploreToolsCopy}>
        <LocaleLink className="button primary" to="/tools">{copy.nav.tools}</LocaleLink>
        <LocaleLink className="button" to="/docs">{copy.footer.docs}</LocaleLink>
      </CTASection>
    </ContentPage>
  )
}

export function GuideArticlePage({ slug }: { slug: string }) {
  const copy = useT()
  const locale = useLocale()
  const article = getGuide(slug)
  if (!article) {
    return (
      <ContentPage
        eyebrow="404"
        title={copy.pages.guideMissingTitle}
        lead={copy.pages.guideMissingLead}
        crumbs={[
          { name: copy.catalog.home, path: homePath(locale), to: '/' },
          { name: copy.nav.guides, path: locale === 'id' ? '/id/guides' : '/guides', to: '/guides' },
        ]}
      >
        <p><LocaleLink className="button primary" to="/guides">{copy.nav.guides}</LocaleLink></p>
      </ContentPage>
    )
  }
  const item = guideCopy(article, locale)
  const tools = article.toolSlugs.map((toolSlug) => getToolBySlug(toolSlug)).filter((tool) => tool?.available)
  const related = guideArticles.filter((entry) => entry.slug !== article.slug && entry.category === article.category).slice(0, 3)
  const guidesPath = locale === 'id' ? '/id/guides' : '/guides'
  return (
    <ContentPage
      eyebrow={copy.pages.guideEyebrow}
      title={item.title}
      lead={item.intro}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.nav.guides, path: guidesPath, to: '/guides' },
        { name: item.title, path: locale === 'id' ? `/id${guidePath(article.slug)}` : guidePath(article.slug) },
      ]}
    >
      {item.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      {tools.length > 0 && (
        <section>
          <h2>{copy.pages.openTheTools}</h2>
          <ul className="content-links">
            {tools.map((tool) => {
              const localized = localizeTool(tool!, locale)
              return (
                <li key={tool!.id}>
                  <LocaleLink to="/tools/$category" params={{ category: tool!.slug }}>{localized.name}</LocaleLink>
                  <span> · {categoryLabel(tool!.category as ToolCategory, locale)}</span>
                </li>
              )
            })}
            <li>
              <a href={categorySeoPath(locale, article.category)}>{copy.home.categoryTools(categoryLabel(article.category, locale))}</a>
            </li>
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <section>
          <h2>{copy.pages.relatedGuides}</h2>
          <ul className="content-links">
            {related.map((entry) => {
              const relatedCopy = guideCopy(entry, locale)
              return (
                <li key={entry.slug}>
                  <LocaleLink to="/guides/$slug" params={{ slug: entry.slug }}>{relatedCopy.title}</LocaleLink>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </ContentPage>
  )
}

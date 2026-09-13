import { getGuide, guideArticles, guideCopy, guidePath } from '@/content/guides/catalog'
import { ContentPage } from '@/features/pages/ContentPage'
import { categoryLabel, categorySeoPath } from '@/features/seo/tool-seo'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { localizeTool } from '@/i18n/tools'

export function GuidesHome() {
  const copy = useT()
  const locale = useLocale()
  const homePath = locale === 'id' ? '/id' : '/'
  return (
    <ContentPage
      eyebrow={copy.pages.guidesEyebrow}
      title={copy.pages.guidesTitle}
      lead={copy.pages.guidesLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath, to: '/' },
        { name: copy.nav.guides, path: locale === 'id' ? '/id/guides' : '/guides' },
      ]}
    >
      <ul className="guide-index">
        {guideArticles.map((article) => {
          const item = guideCopy(article, locale)
          return (
            <li key={article.slug}>
              <LocaleLink to="/guides/$slug" params={{ slug: article.slug }}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </LocaleLink>
            </li>
          )
        })}
      </ul>
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
          { name: copy.catalog.home, path: locale === 'id' ? '/id' : '/', to: '/' },
          { name: copy.nav.guides, path: locale === 'id' ? '/id/guides' : '/guides', to: '/guides' },
        ]}
      >
        <p><LocaleLink className="button primary" to="/guides">{copy.nav.guides}</LocaleLink></p>
      </ContentPage>
    )
  }
  const item = guideCopy(article, locale)
  const tools = article.toolSlugs.map((toolSlug) => getToolBySlug(toolSlug)).filter((tool) => tool?.available)
  const homePath = locale === 'id' ? '/id' : '/'
  const guidesPath = locale === 'id' ? '/id/guides' : '/guides'
  return (
    <ContentPage
      eyebrow={copy.pages.guideEyebrow}
      title={item.title}
      lead={item.intro}
      crumbs={[
        { name: copy.catalog.home, path: homePath, to: '/' },
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
                  <span> · {categoryLabel(tool!.category, locale)}</span>
                </li>
              )
            })}
            <li>
              <a href={categorySeoPath(locale, article.category)}>{copy.home.categoryTools(categoryLabel(article.category, locale))}</a>
            </li>
          </ul>
        </section>
      )}
    </ContentPage>
  )
}

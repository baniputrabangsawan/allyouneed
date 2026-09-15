import { ArrowRight, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { docsArticles } from '@/content/docs/articles'
import { docsArticlePath, docsCategoryStats, docsSidebarGroups, popularDocSlugs, searchDocs } from '@/content/docs/catalog'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { localizeTool } from '@/i18n/tools'

function ArticleLink({ slug, children }: { slug: string; children: ReactNode }) {
  return <LocaleLink to={docsArticlePath(slug)}>{children}</LocaleLink>
}

const categoryDescKey = {
  image: 'catImage',
  pdf: 'catPdf',
  audio: 'catAudio',
  video: 'catVideo',
  qr: 'catQr',
  developer: 'catDeveloper',
  calculator: 'catCalculator',
  text: 'catText',
  generator: 'catGenerator',
  converter: 'catConverter',
} as const

export function DocsHome() {
  const copy = useT()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const hits = query.trim() ? searchDocs(query).slice(0, 8) : []
  const categories = useMemo(() => docsCategoryStats(), [])
  const groups = useMemo(() => docsSidebarGroups(), [])
  const popular = popularDocSlugs.map(getToolBySlug).filter((tool) => tool?.available)

  return (
    <article className="docs-article docs-home">
      <header className="docs-header">
        <p className="eyebrow">{copy.docs.brand}</p>
        <h1>{copy.docs.landingTitle}</h1>
        <p>{copy.docs.landingCopy}</p>
      </header>

      <label className="docs-home-search">
        <Search size={18} />
        <span className="sr-only">{copy.docs.search}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.docs.searchHome} autoComplete="off" />
      </label>
      {hits.length > 0 && (
        <ul className="docs-home-hits">
          {hits.map((hit) => {
            const tool = hit.kind === 'tool' ? getToolBySlug(hit.slug) : undefined
            const title = tool ? localizeTool(tool, locale).name : (
              hit.slug === 'getting-started' ? copy.docs.gettingStarted
                : hit.slug === 'troubleshooting' ? copy.footer.troubleshooting
                  : copy.docs.privacy
            )
            const subtitle = hit.kind === 'article' ? copy.docs.guides : copy.palette.docs
            return (
              <li key={`${hit.kind}-${hit.slug}`}>
                {hit.kind === 'article'
                  ? <ArticleLink slug={hit.slug}>{title}<small>{subtitle}</small></ArticleLink>
                  : <LocaleLink to="/docs/tools/$slug" params={{ slug: hit.slug }}>{title}<small>{subtitle}</small></LocaleLink>}
              </li>
            )
          })}
        </ul>
      )}

      <section>
        <h2>{copy.docs.gettingStarted}</h2>
        <ol className="docs-steps">
          <li><span>01</span><p>{copy.docs.start1}</p></li>
          <li><span>02</span><p>{copy.docs.start2}</p></li>
          <li><span>03</span><p>{copy.docs.start3}</p></li>
          <li><span>04</span><p>{copy.docs.start4}</p></li>
          <li><span>05</span><p>{copy.docs.start5}</p></li>
          <li><span>06</span><p>{copy.docs.start6}</p></li>
        </ol>
        <p><LocaleLink to="/docs/getting-started">{copy.docs.readGettingStarted} <ArrowRight size={14} /></LocaleLink></p>
      </section>

      <section>
        <h2>{copy.docs.browseCategory}</h2>
        <div className="docs-category-grid">
          {categories.map((item) => {
            const first = groups.find((group) => group.category === item.category)?.tools[0]
            if (!first) return null
            const descKey = categoryDescKey[item.category as keyof typeof categoryDescKey]
            return (
              <LocaleLink key={item.category} to="/docs/tools/$slug" params={{ slug: first.slug }} className="docs-category-card">
                <strong>{copy.category[item.category] ?? item.category}</strong>
                <p>{descKey ? copy.docs[descKey] : item.description}</p>
                <small>{copy.docs.availableListed(item.documented, item.total)}</small>
              </LocaleLink>
            )
          })}
        </div>
      </section>

      <section>
        <h2>{copy.docs.popularGuides}</h2>
        <ul className="docs-related">
          {popular.map((tool) => tool && (
            <li key={tool.slug}>
              <LocaleLink to="/docs/tools/$slug" params={{ slug: tool.slug }}>{localizeTool(tool, locale).name}</LocaleLink>
              <small>{localizeTool(tool, locale).shortDescription}</small>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{copy.docs.more}</h2>
        <ul className="docs-related">
          {docsArticles.map((article) => (
            <li key={article.slug}>
              <ArticleLink slug={article.slug}>
                {article.slug === 'getting-started' ? copy.docs.gettingStarted
                  : article.slug === 'troubleshooting' ? copy.footer.troubleshooting
                    : copy.docs.privacy}
              </ArticleLink>
              <small>
                {article.slug === 'getting-started' ? copy.docs.articleGettingStartedDesc
                  : article.slug === 'troubleshooting' ? copy.docs.articleTroubleshootingDesc
                    : copy.docs.articlePrivacyDesc}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

export function GettingStartedPage() {
  const copy = useT()
  return (
    <article className="docs-article">
      <p className="eyebrow">{copy.docs.articleEyebrow}</p>
      <h1>{copy.docs.gettingStarted}</h1>
      <p>{copy.docs.gsIntro}</p>
      <h2 id="find">{copy.docs.gsFind}</h2>
      <p>{copy.docs.gsFindBody}</p>
      <h2 id="workflow">{copy.docs.gsWorkflow}</h2>
      <ol className="docs-steps">
        <li><span>01</span><p>{copy.docs.gsChoose}</p></li>
        <li><span>02</span><p>{copy.docs.gsAdd}</p></li>
        <li><span>03</span><p>{copy.docs.gsAdjust}</p></li>
        <li><span>04</span><p>{copy.docs.gsProcess}</p></li>
        <li><span>05</span><p>{copy.docs.gsPreview}</p></li>
        <li><span>06</span><p>{copy.docs.gsDownload}</p></li>
      </ol>
      <h2>{copy.docs.gsFreePro}</h2>
      <p>{copy.docs.gsFreeProBody} {copy.docs.gsSee} <LocaleLink to="/pricing">{copy.nav.pricing}</LocaleLink> {copy.docs.gsAnd} <LocaleLink to="/license">{copy.nav.license}</LocaleLink>.</p>
      <h2>{copy.docs.comingSoon}</h2>
      <p>{copy.docs.gsSoonBody}</p>
    </article>
  )
}

export function TroubleshootingPage() {
  const copy = useT()
  return (
    <article className="docs-article">
      <p className="eyebrow">{copy.docs.articleEyebrow}</p>
      <h1>{copy.footer.troubleshooting}</h1>
      <dl className="docs-options">
        <div><dt>{copy.docs.tsUnsupported}</dt><dd>{copy.docs.tsUnsupportedA}</dd></div>
        <div><dt>{copy.docs.tsTooLarge}</dt><dd>{copy.docs.tsTooLargeA}</dd></div>
        <div><dt>{copy.docs.tsPermission}</dt><dd>{copy.docs.tsPermissionA}</dd></div>
        <div><dt>{copy.docs.tsUnavailable}</dt><dd>{copy.docs.tsUnavailableA}</dd></div>
        <div><dt>{copy.docs.tsDownload}</dt><dd>{copy.docs.tsDownloadA}</dd></div>
        <div><dt>{copy.docs.tsLicense}</dt><dd>{copy.docs.tsLicenseA}</dd></div>
        <div><dt>{copy.docs.tsSoon}</dt><dd>{copy.docs.tsSoonA}</dd></div>
        <div><dt>{copy.docs.tsNetwork}</dt><dd>{copy.docs.tsNetworkA}</dd></div>
      </dl>
    </article>
  )
}

export function PrivacyPage() {
  const copy = useT()
  return (
    <article className="docs-article">
      <p className="eyebrow">{copy.docs.articleEyebrow}</p>
      <h1>{copy.docs.privacy}</h1>
      <h2>{copy.docs.privacyClientH}</h2>
      <p>{copy.docs.privacyClientP}</p>
      <h2>{copy.docs.privacyServerH}</h2>
      <p>{copy.docs.privacyServerP}</p>
      <h2>{copy.docs.privacyTempH}</h2>
      <p>{copy.docs.privacyTempP}</p>
      <h2>{copy.docs.privacyAiH}</h2>
      <p>{copy.docs.privacyAiP}</p>
      <h2>{copy.docs.privacyDlH}</h2>
      <p>{copy.docs.privacyDlP}</p>
    </article>
  )
}

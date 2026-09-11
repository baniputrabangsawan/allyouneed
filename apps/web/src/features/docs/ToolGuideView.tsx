import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react'
import {
  docsNeighbors,
  docsRelated,
  formatMimeList,
  planLabel,
  processingLabel,
  resolveToolGuide,
} from '@/content/docs/catalog'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { localizeTool, useLocalizedTool } from '@/i18n/tools'

export function ToolGuideView({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const locale = useLocale()
  const item = useLocalizedTool(tool)
  const guide = resolveToolGuide(tool, locale)
  const related = docsRelated(tool)
  const { previous, next } = docsNeighbors(tool.slug)
  const inputs = formatMimeList(tool.acceptedFormats)
  const outputs = formatMimeList(tool.outputFormats)
  const available = tool.available
  const plan = planLabel(tool)
  const processing = processingLabel(tool)

  return (
    <article className="docs-article">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <LocaleLink to="/docs">{copy.nav.docs}</LocaleLink>
        <ChevronRight size={14} />
        <LocaleLink to="/tools/$category" params={{ category: tool.category }}>{copy.category[tool.category] ?? tool.category}</LocaleLink>
        <ChevronRight size={14} />
        <span>{item.name}</span>
      </nav>
      <header className="docs-header">
        <p className="eyebrow">{copy.docs.guideEyebrow(copy.category[tool.category] ?? tool.category)}</p>
        <h1>{item.name}</h1>
        <p>{item.shortDescription}</p>
        <div className="docs-badges">
          <span className="badge">{plan === 'Pro' ? copy.docs.pro : copy.docs.free}</span>
          <span className="badge">{processing === 'Client-side' ? copy.docs.client : processing === 'Hybrid' ? copy.docs.hybrid : copy.docs.server}</span>
          <span className={available ? 'badge success' : 'badge'}>{available ? copy.availability.available : copy.docs.comingSoon}</span>
          {tool.ai && <span className="badge">AI</span>}
        </div>
        {available
          ? <LocaleLink className="button primary" to="/$tool" params={{ tool: tool.slug }}>{copy.docs.open(item.name)}</LocaleLink>
          : <p className="docs-soon-copy">{copy.docs.comingSoonBody}</p>}
      </header>

      {!available ? null : guide && (
        <>
          <section id="overview">
            <h2>{copy.docs.overview}</h2>
            <p>{guide.overview}</p>
          </section>
          <section id="how-to">
            <h2>{copy.docs.howTo}</h2>
            <ol className="docs-steps">
              {guide.steps.map((step, index) => (
                <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>
              ))}
            </ol>
          </section>
          <section id="inputs">
            <h2>{copy.docs.inputs}</h2>
            {inputs.length
              ? <p>{inputs.join(', ')}</p>
              : <p>{copy.docs.noFileTypes}</p>}
          </section>
          {guide.optionDocs?.length ? (
            <section id="options">
              <h2>{copy.docs.options}</h2>
              <dl className="docs-options">
                {guide.optionDocs.map((option) => (
                  <div key={option.name}>
                    <dt>{option.name}</dt>
                    <dd>{option.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          <section id="output">
            <h2>{copy.docs.output}</h2>
            <p>{guide.output ?? (outputs.length ? copy.docs.outputFormats(outputs.join(', ')) : copy.docs.defaultOutput)}</p>
          </section>
          {guide.example && (
            <section id="example">
              <h2>{copy.docs.example}</h2>
              <p>{guide.example}</p>
            </section>
          )}
          <section id="privacy">
            <h2>{copy.docs.privacy}</h2>
            <PrivacyCopy tool={tool} />
          </section>
          <section id="limits">
            <h2>{copy.docs.limits}</h2>
            <LimitsCopy tool={tool} />
          </section>
          {guide.troubleshooting?.length ? (
            <section id="troubleshooting">
              <h2>{copy.docs.issues}</h2>
              <dl className="docs-options">
                {guide.troubleshooting.map((issue) => (
                  <div key={issue.problem}>
                    <dt>{issue.problem}</dt>
                    <dd>{issue.solution}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </>
      )}

      {related.length > 0 && (
        <section id="related">
          <h2>{copy.docs.related}</h2>
          <ul className="docs-related">
            {related.map((relatedTool) => {
              const relatedItem = localizeTool(relatedTool, locale)
              return (
                <li key={relatedTool.slug}>
                  <LocaleLink to="/docs/tools/$slug" params={{ slug: relatedTool.slug }}>{relatedItem.name}</LocaleLink>
                  <small>{relatedItem.shortDescription}</small>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {available && (
        <p className="docs-try">
          <LocaleLink className="button primary" to="/$tool" params={{ tool: tool.slug }}>{copy.docs.try(item.name)}</LocaleLink>
        </p>
      )}

      <nav className="docs-pager" aria-label="Guide sequence">
        {previous
          ? <LocaleLink to="/docs/tools/$slug" params={{ slug: previous.slug }}><ArrowLeft size={16} /> {localizeTool(previous, locale).name}</LocaleLink>
          : <LocaleLink to="/docs/getting-started"><ArrowLeft size={16} /> {copy.docs.gettingStarted}</LocaleLink>}
        {next
          ? <LocaleLink to="/docs/tools/$slug" params={{ slug: next.slug }}>{localizeTool(next, locale).name} <ArrowRight size={16} /></LocaleLink>
          : <span />}
      </nav>

      {available && guide && (
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: copy.docs.howToSchema(item.name),
          description: guide.overview,
          step: guide.steps.map((text, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            text,
          })),
        })}</script>
      )}
    </article>
  )
}

function PrivacyCopy({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  if (tool.ai) return <p>{copy.docs.privacyAi}</p>
  if (tool.processingMode === 'client') return <p>{copy.docs.privacyClient}</p>
  return <p>{copy.docs.privacyServer}</p>
}

function LimitsCopy({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const lines: string[] = []
  if (tool.acceptedFormats?.length) lines.push(copy.docs.acceptedFormats(formatMimeList(tool.acceptedFormats).join(', ')))
  if (tool.implementation === 'remote-api') lines.push(copy.docs.remoteLimit)
  if (tool.implementation === 'image-canvas') lines.push(copy.docs.imageLimit)
  if (tool.accessTier === 'pro' || tool.premium) lines.push(copy.docs.proRequired)
  if (!lines.length) return <p>{copy.docs.noLimits}</p>
  return <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
}

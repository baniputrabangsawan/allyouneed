import { useParams } from '@tanstack/react-router'
import { toolGuideToc } from '@/content/docs/catalog'
import { DocsHome, GettingStartedPage, PrivacyPage, TroubleshootingPage } from '@/features/docs/DocsHome'
import { DocsShell } from '@/features/docs/DocsShell'
import { ToolGuideView } from '@/features/docs/ToolGuideView'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'

export function DocsIndex() {
  return (
    <main className="docs-page">
      <DocsShell>
        <DocsHome />
      </DocsShell>
    </main>
  )
}

export function GettingStartedDocs() {
  return (
    <main className="docs-page">
      <DocsShell toc={[{ id: 'find', label: 'Find a tool' }, { id: 'workflow', label: 'Workflow' }]}>
        <GettingStartedPage />
      </DocsShell>
    </main>
  )
}

export function PrivacyDocs() {
  return (
    <main className="docs-page">
      <DocsShell>
        <PrivacyPage />
      </DocsShell>
    </main>
  )
}

export function TroubleshootingDocs() {
  return (
    <main className="docs-page">
      <DocsShell>
        <TroubleshootingPage />
      </DocsShell>
    </main>
  )
}

export function ToolDocsRoute() {
  const copy = useT()
  const params = useParams({ strict: false }) as { slug: string }
  const tool = getToolBySlug(params.slug)
  if (!tool) {
    return (
      <main className="docs-page">
        <DocsShell>
          <article className="docs-article">
            <p className="eyebrow">404</p>
            <h1>{copy.docs.notFound}</h1>
            <p>{copy.docs.notFoundCopy}</p>
            <p className="docs-try">
              <LocaleLink className="button primary" to="/docs">{copy.docs.backToDocs}</LocaleLink>
              <LocaleLink className="button" to="/">{copy.docs.browseTools}</LocaleLink>
            </p>
          </article>
        </DocsShell>
      </main>
    )
  }
  return (
    <main className="docs-page">
      <DocsShell {...(tool.available ? { toc: toolGuideToc } : {})}>
        <ToolGuideView tool={tool} />
      </DocsShell>
    </main>
  )
}

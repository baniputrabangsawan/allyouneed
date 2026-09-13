import { createFileRoute } from '@tanstack/react-router'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { throwIfLegacyTool } from '@/features/tools/tool-legacy'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { localizeTool } from '@/i18n/tools'
import { ToolDocsRoute } from '@/features/docs/pages'

export const Route = createFileRoute('/id/docs/tools/$slug')({
  beforeLoad: ({ params }) => {
    throwIfLegacyTool(params.slug, 'docs', 'id')
  },
  head: ({ params }) => {
    const copy = getMessages('id')
    const tool = getToolBySlug(params.slug)
    if (!tool) return pageSeo('id', `/docs/tools/${params.slug}`, copy.docs.guideNotFoundTitle, copy.docs.guideNotFoundDescription)
    const localized = localizeTool(tool, 'id')
    const title = copy.docs.howToTitle(localized.name)
    const description = tool.available
      ? localized.shortDescription
      : copy.docs.comingSoonDescription(localized.name)
    return pageSeo('id', `/docs/tools/${tool.slug}`, title, description)
  },
  component: ToolDocsRoute,
})

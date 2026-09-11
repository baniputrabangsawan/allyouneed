import { createFileRoute, notFound } from '@tanstack/react-router'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { localizeTool } from '@/i18n/tools'
import { pageSeo } from '@/i18n/seo'
import { ToolRoute } from '@/features/tools/ToolPage'

export const Route = createFileRoute('/id/$tool')({
  beforeLoad: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    if (!tool) throw notFound()
    return { tool }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    const localized = tool ? localizeTool(tool, 'id') : undefined
    const title = localized?.seo.title ?? 'Tool | Kits'
    const description = localized?.seo.description ?? 'Utilitas browser Kits.'
    return pageSeo('id', `/${params.tool}`, title, description)
  },
  component: ToolRoute,
})

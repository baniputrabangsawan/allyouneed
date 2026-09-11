import { createFileRoute, notFound } from '@tanstack/react-router'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { ToolRoute } from '@/features/tools/ToolPage'

export const Route = createFileRoute('/$tool')({
  beforeLoad: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    if (!tool) throw notFound()
    return { tool }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    const title = tool?.seo.title ?? 'Online Tool'
    const description = tool?.seo.description ?? 'A fast browser utility.'
    const canonical = tool ? `/${tool.slug}` : `/${params.tool}`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: canonical },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: ToolRoute,
})

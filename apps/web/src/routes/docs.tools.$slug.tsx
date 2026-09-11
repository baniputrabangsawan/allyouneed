import { createFileRoute } from '@tanstack/react-router'
import { ToolDocsRoute } from '@/features/docs/pages'
import { getToolBySlug } from '@/features/tools/tool-registry'

export const Route = createFileRoute('/docs/tools/$slug')({
  head: ({ params }) => {
    const tool = getToolBySlug(params.slug)
    if (!tool) {
      return {
        meta: [
          { title: 'Guide not found — Kits Docs' },
          { name: 'description', content: 'That documentation page does not exist.' },
        ],
      }
    }
    const title = `How to use ${tool.name} — Kits Docs`
    const description = tool.available
      ? `${tool.shortDescription} Processing: ${tool.processingMode}.`
      : `${tool.name} is Coming Soon. This page does not describe unimplemented options.`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
      ],
      links: [{ rel: 'canonical', href: `/docs/tools/${tool.slug}` }],
    }
  },
  component: ToolDocsRoute,
})

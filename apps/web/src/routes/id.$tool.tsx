import { createFileRoute, notFound } from '@tanstack/react-router'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { throwIfLegacyTool } from '@/features/tools/tool-legacy'
import { toolHead } from '@/features/seo/tool-seo'
import { ToolRoute } from '@/features/tools/ToolPage'

export const Route = createFileRoute('/id/$tool')({
  beforeLoad: ({ params }) => {
    throwIfLegacyTool(params.tool, 'bare', 'id')
    const tool = getToolBySlug(params.tool)
    if (!tool) throw notFound()
    return { tool }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    return tool ? toolHead(tool, 'id') : { meta: [{ title: 'Tool | Kits' }] }
  },
  component: ToolRoute,
})

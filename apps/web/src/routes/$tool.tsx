import { createFileRoute, notFound } from '@tanstack/react-router'
import { getToolBySlug } from '@/features/tools/tool-registry'
import { throwIfLegacyTool } from '@/features/tools/tool-legacy'
import { ToolRoute } from '@/features/tools/ToolPage'
import { toolHead } from '@/features/seo/tool-seo'

export const Route = createFileRoute('/$tool')({
  beforeLoad: ({ params }) => {
    throwIfLegacyTool(params.tool, 'bare', 'en')
    const tool = getToolBySlug(params.tool)
    if (!tool) throw notFound()
    return { tool }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.tool)
    return tool ? toolHead(tool, 'en') : { meta: [{ title: 'Online Tool | Kits' }] }
  },
  component: ToolRoute,
})

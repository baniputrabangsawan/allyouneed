import { createFileRoute, notFound } from '@tanstack/react-router'
import { CategoryCatalog } from '@/features/catalog/CategoryCatalog'
import { validCategories } from '@/features/catalog/categories'
import { getToolBySlug, type ToolCategory } from '@/features/tools/tool-registry'
import { categoryLabel, categorySeoPath, toolHead } from '@/features/seo/tool-seo'
import { absoluteUrl } from '@/features/seo/site'
import { ToolRoute } from '@/features/tools/ToolPage'

export const Route = createFileRoute('/id/tools/$category')({
  beforeLoad: ({ params }) => {
    const tool = getToolBySlug(params.category)
    if (tool) return { tool }
    if (!validCategories.includes(params.category as ToolCategory)) throw notFound()
    return { category: params.category as ToolCategory }
  },
  head: ({ params }) => {
    const tool = getToolBySlug(params.category)
    if (tool) return toolHead(tool, 'id')
    const label = categoryLabel(params.category, 'id')
    const path = categorySeoPath('id', params.category)
    return {
      meta: [
        { title: `${label} Online | Kits` },
        { name: 'description', content: `Jelajahi ${label.toLowerCase()} di Kits untuk konversi, edit, optimasi, dan utilitas online.` },
      ],
      links: [{ rel: 'canonical', href: absoluteUrl(path) }],
    }
  },
  component: CategoryOrTool,
})

function CategoryOrTool() {
  const params = Route.useParams()
  return getToolBySlug(params.category) ? <ToolRoute /> : <CategoryCatalog />
}

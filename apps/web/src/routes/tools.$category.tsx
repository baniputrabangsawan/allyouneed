import { createFileRoute, notFound } from '@tanstack/react-router'
import { CategoryCatalog, validCategories } from '@/features/catalog/CategoryCatalog'
import { type ToolCategory } from '@/features/tools/tool-registry'

export const Route = createFileRoute('/tools/$category')({
  beforeLoad: ({ params }) => {
    if (!validCategories.includes(params.category as ToolCategory)) throw notFound()
    return { category: params.category as ToolCategory }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.category[0]?.toUpperCase()}${params.category.slice(1)} Tools | Kits` }, { name: 'description', content: `Browse all ${params.category} tools in Kits.` }] }),
  component: CategoryCatalog,
})

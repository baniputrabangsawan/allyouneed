import { createFileRoute, notFound } from '@tanstack/react-router'
import { CategoryCatalog } from '@/features/catalog/CategoryCatalog'
import { validCategories } from '@/features/catalog/categories'
import { type ToolCategory } from '@/features/tools/tool-registry'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/id/tools/$category')({
  beforeLoad: ({ params }) => {
    if (!validCategories.includes(params.category as ToolCategory)) throw notFound()
    return { category: params.category as ToolCategory }
  },
  head: ({ params }) => {
    const copy = getMessages('id')
    const label = copy.category[params.category as ToolCategory] ?? params.category
    return pageSeo('id', `/tools/${params.category}`, copy.home.categoryTools(label), copy.catalog.description)
  },
  component: CategoryCatalog,
})

import { createFileRoute } from '@tanstack/react-router'
import { ToolsCatalog } from '@/features/catalog/ToolsCatalog'
import { tools } from '@/features/tools/tool-registry'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/id/tools/')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/tools', copy.catalog.title(tools.length), copy.catalog.description)
  },
  component: ToolsCatalog,
})

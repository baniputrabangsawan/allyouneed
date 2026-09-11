import { createFileRoute } from '@tanstack/react-router'
import { ToolsCatalog } from '@/features/catalog/ToolsCatalog'
import { tools } from '@/features/tools/tool-registry'

export const Route = createFileRoute('/tools/')({
  head: () => ({ meta: [{ title: `All ${tools.length} Tools | Kits` }, { name: 'description', content: 'Browse every Kits utility, including tools currently in development.' }] }),
  component: ToolsCatalog,
})

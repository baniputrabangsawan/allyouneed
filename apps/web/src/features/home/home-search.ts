import { z } from 'zod'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { searchToolsLocalized } from '@/i18n/tools'

export const homeCategories = ['all', 'image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const
export const homeGroups = ['all', 'optimize', 'create', 'edit', 'convert', 'security'] as const
export type CategoryFilter = typeof homeCategories[number]
export type GroupFilter = typeof homeGroups[number]

export const homeSearchSchema = z.object({
  q: z.string().catch('').default(''),
  category: z.enum(homeCategories).catch('all').default('all'),
  group: z.enum(homeGroups).catch('all').default('all'),
})

export function matchesCategory(tool: ToolDefinition, category: CategoryFilter) {
  return category === 'all' || (category === 'converter' ? tool.groups.includes('convert') : tool.category === category)
}

export function matchesGroup(tool: ToolDefinition, group: GroupFilter) {
  return group === 'all' || tool.groups.includes(group)
}

export function filterTools(query: string, category: CategoryFilter, group: GroupFilter): ToolDefinition[] {
  return searchToolsLocalized(query).filter((tool) => matchesCategory(tool, category) && matchesGroup(tool, group))
}

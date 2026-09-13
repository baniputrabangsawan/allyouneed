import { z } from 'zod'
import { getAllTools, type ToolDefinition } from '@/features/tools/tool-registry'
import { toolsId } from '@/i18n/tools-id'

export const homeCategories = ['all', 'image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const
export const homeGroups = ['all', 'optimize', 'create', 'edit', 'convert', 'security'] as const
export type CategoryFilter = typeof homeCategories[number]
export type GroupFilter = typeof homeGroups[number]

export const homeSearchSchema = z.object({
  q: z.string().catch('').default(''),
  category: z.enum(homeCategories).catch('all').default('all'),
  group: z.enum(homeGroups).catch('all').default('all'),
})

export interface SearchableTool {
  tool: ToolDefinition
  searchText: string
}

export const searchIndex: readonly SearchableTool[] = getAllTools().map((tool) => {
  const id = toolsId[tool.slug]
  return {
    tool,
    searchText: [
      tool.name,
      tool.shortDescription,
      tool.description,
      tool.tags.join(' '),
      tool.aliases.join(' '),
      tool.category,
      id?.name,
      id?.shortDescription,
      id?.aliases?.join(' '),
    ].filter(Boolean).join(' ').toLowerCase(),
  }
})

export function matchesCategory(tool: ToolDefinition, category: CategoryFilter) {
  return category === 'all' || (category === 'converter' ? tool.groups.includes('convert') : tool.category === category)
}

export function matchesGroup(tool: ToolDefinition, group: GroupFilter) {
  return group === 'all' || tool.groups.includes(group)
}

export function filterTools(query: string, category: CategoryFilter, group: GroupFilter): ToolDefinition[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches: ToolDefinition[] = []
  for (const entry of searchIndex) {
    if (!matchesCategory(entry.tool, category) || !matchesGroup(entry.tool, group)) continue
    if (tokens.length && !tokens.every((token) => entry.searchText.includes(token))) continue
    matches.push(entry.tool)
  }
  return matches
}

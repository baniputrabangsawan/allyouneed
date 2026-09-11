import Fuse from 'fuse.js'
import { getAllTools, searchTools, type ToolDefinition } from '@/features/tools/tool-registry'
import type { Locale } from './config'
import { useLocale } from './index'
import { toolsId } from './tools-id'

export function localizeTool(tool: ToolDefinition, locale: Locale): ToolDefinition {
  if (locale !== 'id') return tool
  const copy = toolsId[tool.slug]
  if (!copy) return tool
  return {
    ...tool,
    name: copy.name,
    shortDescription: copy.shortDescription,
    description: copy.shortDescription,
    aliases: [...tool.aliases, ...(copy.aliases ?? [])],
    seo: {
      title: `${copy.name} Online`,
      description: copy.shortDescription,
    },
  }
}

export function useLocalizedTool(tool: ToolDefinition): ToolDefinition {
  return localizeTool(tool, useLocale())
}

const bilingualRecords = getAllTools().map((tool) => {
  const id = toolsId[tool.slug]
  return {
    tool,
    haystack: [
      tool.name,
      tool.shortDescription,
      tool.description,
      tool.tags.join(' '),
      tool.aliases.join(' '),
      tool.category,
      id?.name,
      id?.shortDescription,
      id?.aliases?.join(' '),
    ].filter(Boolean).join(' '),
  }
})

const bilingualFuse = new Fuse(bilingualRecords, {
  keys: ['haystack'],
  threshold: 0.32,
})

export function searchToolsLocalized(query: string): ToolDefinition[] {
  const trimmed = query.trim()
  if (!trimmed) return getAllTools()
  const bilingual = bilingualFuse.search(trimmed).map(({ item }) => item.tool)
  if (bilingual.length) return bilingual
  return searchTools(trimmed)
}

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

const searchRecords = getAllTools().map((tool) => {
  const id = toolsId[tool.slug]
  const searchText = [
    tool.name,
    tool.shortDescription,
    tool.description,
    tool.tags.join(' '),
    tool.aliases.join(' '),
    tool.category,
    id?.name,
    id?.shortDescription,
    id?.aliases?.join(' '),
  ].filter(Boolean).join(' ').toLowerCase()
  return { tool, searchText }
})

const bilingualFuse = new Fuse(searchRecords, {
  keys: ['searchText'],
  threshold: 0.32,
})

export function searchToolsLocalized(query: string): ToolDefinition[] {
  const trimmed = query.trim()
  if (!trimmed) return getAllTools()
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  const exact = searchRecords.filter((record) => tokens.every((token) => record.searchText.includes(token))).map((record) => record.tool)
  if (exact.length) return exact
  const bilingual = bilingualFuse.search(trimmed).map(({ item }) => item.tool)
  if (bilingual.length) return bilingual
  return searchTools(trimmed)
}

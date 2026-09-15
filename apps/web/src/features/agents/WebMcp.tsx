import { useEffect } from 'react'
import { filterTools } from '@/features/home/home-search'
import { getAllTools, getToolBySlug } from '@/features/tools/tool-registry'
import { useLocaleNavigate } from '@/i18n/navigate'

type JsonSchema = {
  type: 'object'
  properties?: Record<string, { type: string; description?: string }>
  required?: string[]
  additionalProperties?: boolean
}

type WebMcpTool = {
  name: string
  description: string
  inputSchema: JsonSchema
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown
}

type ModelContext = {
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void
  provideContext?: (input: { tools: WebMcpTool[] }) => void
}

declare global {
  interface Navigator {
    modelContext?: ModelContext
  }
  interface Document {
    modelContext?: ModelContext
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function summarize(tool: { name: string; slug: string; shortDescription: string; available: boolean; requiresPro: boolean }) {
  return {
    name: tool.name,
    slug: tool.slug,
    description: tool.shortDescription,
    available: tool.available,
    requiresPro: tool.requiresPro,
    url: `/tools/${tool.slug}`,
  }
}

export function WebMcp() {
  const navigate = useLocaleNavigate()

  useEffect(() => {
    const context = document.modelContext ?? navigator.modelContext
    if (!context) return
    const controller = new AbortController()

    const tools: WebMcpTool[] = [
      {
        name: 'search_kits_tools',
        description: 'Search Kits tools by name, format, or task. Returns matching catalog entries.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text query such as compress png or merge pdf' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: ({ query }) => {
          const matches = filterTools(asString(query), 'all', 'all').slice(0, 12).map(summarize)
          return { matches }
        },
      },
      {
        name: 'list_kits_tools',
        description: 'List working Kits tools that can be opened in this browser.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
        },
        execute: () => ({
          tools: getAllTools().filter((tool) => tool.available).map(summarize),
        }),
      },
      {
        name: 'open_kits_tool',
        description: 'Open a Kits tool workspace by slug, such as compress-image or merge-pdf.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Tool slug from the catalog' },
          },
          required: ['slug'],
          additionalProperties: false,
        },
        execute: async ({ slug }) => {
          const tool = getToolBySlug(asString(slug))
          if (!tool) return { ok: false, error: 'unknown_tool' }
          await navigate({ to: '/tools/$category', params: { category: tool.slug } })
          return { ok: true, slug: tool.slug, name: tool.name }
        },
      },
    ]

    if (typeof context.registerTool === 'function') {
      for (const tool of tools) context.registerTool(tool, { signal: controller.signal })
    } else if (typeof context.provideContext === 'function') {
      context.provideContext({ tools })
    }

    return () => controller.abort()
  }, [navigate])

  return null
}

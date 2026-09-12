import Fuse from 'fuse.js'
import { tools } from '@/features/tools/tool-registry'
import { toolsId } from '@/i18n/tools-id'
import { docsArticles } from './articles'

export type DocsSearchHit =
  | { kind: 'tool'; slug: string; title: string; subtitle: string; keywords: string; nameId?: string }
  | { kind: 'article'; slug: string; title: string; subtitle: string; keywords: string; nameId?: string }

export function docsArticlePath(slug: string) {
  if (slug === 'getting-started') return '/docs/getting-started' as const
  if (slug === 'troubleshooting') return '/docs/troubleshooting' as const
  return '/docs/privacy-and-processing' as const
}

// Keep global search metadata compact. Full guide bodies belong to Docs route chunks.
const searchRecords: DocsSearchHit[] = [
  ...docsArticles.map((article) => ({
    kind: 'article' as const,
    slug: article.slug,
    title: article.title,
    subtitle: 'Guide',
    keywords: article.keywords.join(' '),
  })),
  ...tools.map((tool) => {
    const idCopy = toolsId[tool.slug]
    return {
      kind: 'tool' as const,
      slug: tool.slug,
      title: tool.name,
      subtitle: `${tool.category} • Guide`,
      ...(idCopy?.name ? { nameId: idCopy.name } : {}),
      keywords: [
        tool.description,
        tool.tags.join(' '),
        tool.aliases.join(' '),
        idCopy?.name,
        idCopy?.shortDescription,
        idCopy?.aliases?.join(' '),
      ].filter(Boolean).join(' '),
    }
  }),
]

const fuse = new Fuse(searchRecords, {
  keys: ['title', 'subtitle', 'slug', 'keywords', 'nameId'],
  threshold: 0.34,
})

export function searchDocs(query: string): DocsSearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return searchRecords.slice(0, 12)
  return fuse.search(trimmed).map(({ item }) => item)
}

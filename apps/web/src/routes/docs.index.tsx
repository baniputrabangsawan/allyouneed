import { createFileRoute } from '@tanstack/react-router'
import { DocsIndex } from '@/features/docs/pages'

export const Route = createFileRoute('/docs/')({
  head: () => ({
    meta: [
      { title: 'Kits Docs — Learn how to use every tool' },
      { name: 'description', content: 'Guides for Kits tools: what they accept, how to run them, and whether processing stays in the browser.' },
    ],
    links: [{ rel: 'canonical', href: '/docs' }],
  }),
  component: DocsIndex,
})

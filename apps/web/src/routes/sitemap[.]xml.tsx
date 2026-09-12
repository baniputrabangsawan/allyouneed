import { createFileRoute } from '@tanstack/react-router'
import { generateSitemapXml } from '@/features/seo/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => new Response(generateSitemapXml(), {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      }),
    },
  },
})

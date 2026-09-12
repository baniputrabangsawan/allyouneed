import { createFileRoute } from '@tanstack/react-router'
import { generateRobotsTxt } from '@/features/seo/sitemap'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => new Response(generateRobotsTxt(), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      }),
    },
  },
})

import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { htmlOrMarkdown } from '@/features/agents/headers'
import { Home } from '@/features/home/HomePage'
import { homeSearchSchema } from '@/features/home/home-search'
import { absoluteUrl, seoImage } from '@/features/seo/site'
import { organizationJsonLd, websiteJsonLd } from '@/features/seo/tool-seo'
import { loadDiscovery } from '@/lib/storage/recent-ssr'

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  search: {
    middlewares: [stripSearchParams({ q: '', category: 'all', group: 'all' })],
  },
  loader: () => loadDiscovery(),
  server: {
    handlers: {
      GET: htmlOrMarkdown,
    },
  },
  head: () => ({
    meta: [
      { title: 'Kits - Free Online Image, PDF, Audio & Utility Tools' },
      { name: 'description', content: 'Use Kits to compress images, convert files, remove backgrounds, edit PDFs, generate QR codes, transcribe audio and use useful online tools.' },
      { property: 'og:title', content: 'Kits - Free Online Image, PDF, Audio & Utility Tools' },
      { property: 'og:description', content: 'Fast online tools for images, PDFs, audio, video, text, QR codes, and everyday file tasks.' },
      { property: 'og:url', content: absoluteUrl('/') },
      { property: 'og:image', content: seoImage() },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl('/') },
      { rel: 'alternate', hrefLang: 'en', href: absoluteUrl('/') },
      { rel: 'alternate', hrefLang: 'id', href: absoluteUrl('/id') },
      { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl('/') },
    ],
    scripts: [
      { type: 'application/ld+json', children: JSON.stringify(websiteJsonLd('en')) },
      { type: 'application/ld+json', children: JSON.stringify(organizationJsonLd()) },
    ],
  }),
  component: Home,
})

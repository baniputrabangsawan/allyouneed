import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { htmlOrMarkdown } from '@/features/agents/headers'
import { Home } from '@/features/home/HomePage'
import { homeSearchSchema } from '@/features/home/home-search'
import { absoluteUrl, seoImage } from '@/features/seo/site'
import { organizationJsonLd, websiteJsonLd } from '@/features/seo/tool-seo'
import { getMessages } from '@/i18n'
import { loadDiscovery } from '@/lib/storage/recent-ssr'

export const Route = createFileRoute('/id/')({
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
  head: () => {
    const copy = getMessages('id')
    return {
      meta: [
        { title: 'Kits - Tool Online untuk Gambar, PDF, Audio & Teks' },
        { name: 'description', content: 'Gunakan Kits untuk kompres gambar, hapus background, konversi file, edit PDF, buat QR code, transkripsi audio, dan tool online lain.' },
        { property: 'og:title', content: copy.home.titleA },
        { property: 'og:description', content: copy.home.copy },
        { property: 'og:url', content: absoluteUrl('/id') },
        { property: 'og:image', content: seoImage() },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        { rel: 'canonical', href: absoluteUrl('/id') },
        { rel: 'alternate', hrefLang: 'en', href: absoluteUrl('/') },
        { rel: 'alternate', hrefLang: 'id', href: absoluteUrl('/id') },
        { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl('/') },
      ],
      scripts: [
        { type: 'application/ld+json', children: JSON.stringify(websiteJsonLd('id')) },
        { type: 'application/ld+json', children: JSON.stringify(organizationJsonLd()) },
      ],
    }
  },
  component: Home,
})

import { validCategories } from '@/features/catalog/categories'
import { getAllTools } from '@/features/tools/tool-registry'
import { absoluteUrl } from './site'

const publicDocs = [
  '/docs',
  '/docs/getting-started',
  '/docs/privacy-and-processing',
  '/docs/troubleshooting',
] as const

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export function publicSitemapPaths() {
  const paths = new Set<string>([
    '/',
    '/id',
    '/tools',
    '/id/tools',
    ...publicDocs,
    ...publicDocs.map((path) => `/id${path}`),
  ])
  for (const category of validCategories) {
    paths.add(`/tools/${category}`)
    paths.add(`/id/tools/${category}`)
  }
  for (const tool of getAllTools()) {
    if (!tool.available) continue
    paths.add(`/tools/${tool.slug}`)
    paths.add(`/id/tools/${tool.slug}`)
    paths.add(`/docs/tools/${tool.slug}`)
    paths.add(`/id/docs/tools/${tool.slug}`)
  }
  return [...paths].sort()
}

export function generateSitemapXml() {
  const urls = publicSitemapPaths().map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function generateRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /internal/',
    'Disallow: /jobs/',
    'Disallow: /uploads/',
    '',
    'Sitemap: https://usekits.online/sitemap.xml',
    '',
  ].join('\n')
}

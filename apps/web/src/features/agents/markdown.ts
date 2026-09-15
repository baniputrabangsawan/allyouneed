import { PRODUCTION_API_ORIGIN } from '@/lib/api/public-origin'
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/features/seo/site'
import { getAllTools, getToolBySlug, type ToolDefinition } from '@/features/tools/tool-registry'
import { localeFromPathname, stripLocalePrefix } from '@/i18n/path'
import { localizeTool } from '@/i18n/tools'
import { DISCOVERY_PATHS } from './paths'

export function wantsMarkdown(accept: string | null) {
  if (!accept) return false
  const markdown = quality(accept, 'text/markdown')
  if (markdown <= 0) return false
  const html = quality(accept, 'text/html')
  const star = quality(accept, '*/*')
  const bestGeneric = Math.max(html, star)
  return markdown >= bestGeneric
}

function quality(accept: string, type: string) {
  for (const part of accept.split(',')) {
    const [rawType, ...params] = part.trim().split(';')
    const media = (rawType ?? '').trim().toLowerCase()
    if (media !== type) continue
    const q = params.find((item) => item.trim().startsWith('q='))
    const value = q ? Number(q.trim().slice(2)) : 1
    return Number.isFinite(value) ? value : 1
  }
  return 0
}

export function markdownForPath(pathname: string): string | undefined {
  const path = stripLocalePrefix(pathname)
  if (path === '/') return homeMarkdown()
  if (path === '/tools') return catalogMarkdown()
  if (path === '/docs') return docsMarkdown()
  if (path === '/docs/getting-started') return gettingStartedMarkdown()
  if (path === '/docs/privacy-and-processing') return privacyDocsMarkdown()
  if (path === '/docs/troubleshooting') return troubleshootingMarkdown()
  if (path === '/about') return aboutMarkdown()
  if (path === '/pricing') return pricingMarkdown()
  if (path === '/license') return licenseMarkdown()
  if (path === '/contact') return contactMarkdown()
  if (path === '/support') return supportMarkdown()
  if (path === '/privacy') return privacyMarkdown()
  if (path === '/terms') return termsMarkdown()

  const toolsMatch = path.match(/^\/tools\/([^/]+)$/)
  if (toolsMatch?.[1]) {
    const slug = toolsMatch[1]
    const tool = getToolBySlug(slug)
    if (tool) return toolMarkdown(tool, pathname)
    return categoryMarkdown(slug)
  }

  const docsTool = path.match(/^\/docs\/tools\/([^/]+)$/)
  if (docsTool?.[1]) {
    const tool = getToolBySlug(docsTool[1])
    if (tool) return toolMarkdown(tool, pathname)
  }

  const bare = path.match(/^\/([^/]+)$/)
  if (bare?.[1]) {
    const tool = getToolBySlug(bare[1])
    if (tool) return toolMarkdown(tool, pathname)
  }

  return undefined
}

function heading(title: string, pathname: string, intro: string) {
  return `# ${title}\n\n${intro}\n\n- Site: ${SITE_URL}\n- This page: ${absoluteUrl(pathname)}\n`
}

function homeMarkdown() {
  const available = getAllTools().filter((tool) => tool.available)
  const lines = [
    `# ${SITE_NAME}`,
    '',
    'Browser-first utility app: compress, convert, generate, and process files without creating an account. Most tools run in the browser. Pro tools that need a server require a license key activated on one installation at a time.',
    '',
    `- Catalog: ${absoluteUrl('/tools')}`,
    `- Docs: ${absoluteUrl('/docs')}`,
    `- License: ${absoluteUrl('/license')}`,
    `- API catalog: ${absoluteUrl(DISCOVERY_PATHS.apiCatalog)}`,
    `- OpenAPI: ${absoluteUrl(DISCOVERY_PATHS.openapi)}`,
    `- API origin: ${PRODUCTION_API_ORIGIN}`,
    '',
    '## Working tools',
    '',
    ...available.map((tool) => `- [${tool.name}](${absoluteUrl(`/tools/${tool.slug}`)}) — ${tool.shortDescription}`),
    '',
  ]
  return lines.join('\n')
}

function catalogMarkdown() {
  const tools = getAllTools()
  return [
    heading('Kits tools', '/tools', 'Browse every Kits utility, including tools currently in development.'),
    ...tools.map((tool) => {
      const status = tool.available ? 'available' : 'coming soon'
      const pro = tool.requiresPro ? ', Pro' : ''
      return `- [${tool.name}](${absoluteUrl(`/tools/${tool.slug}`)}) (${tool.category}, ${status}${pro}) — ${tool.shortDescription}`
    }),
    '',
  ].join('\n')
}

function categoryMarkdown(category: string) {
  const tools = getAllTools().filter((tool) => tool.category === category || (category === 'converter' && tool.groups.includes('convert')))
  if (!tools.length) return undefined
  return [
    heading(`${category} tools`, `/tools/${category}`, `Kits ${category} utilities.`),
    ...tools.map((tool) => `- [${tool.name}](${absoluteUrl(`/tools/${tool.slug}`)}) — ${tool.shortDescription}`),
    '',
  ].join('\n')
}

function toolMarkdown(tool: ToolDefinition, pathname: string) {
  const localized = localizeTool(tool, localeFromPathname(pathname))
  const processing = tool.processingMode === 'client' ? 'browser' : tool.processingMode
  return [
    heading(localized.name, pathname, localized.description),
    `- Category: ${tool.category}`,
    `- Processing: ${processing}`,
    `- Pro: ${tool.requiresPro ? 'yes' : 'no'}`,
    `- Available: ${tool.available ? 'yes' : 'coming soon'}`,
    `- Workspace: ${absoluteUrl(`/tools/${tool.slug}`)}`,
    `- Docs: ${absoluteUrl(`/docs/tools/${tool.slug}`)}`,
    '',
  ].join('\n')
}

function docsMarkdown() {
  return [
    heading('Kits docs', '/docs', 'Learn how to use every tool. Search the catalog, open a workspace, and read the processing label before you upload.'),
    `- Getting started: ${absoluteUrl('/docs/getting-started')}`,
    `- Privacy and processing: ${absoluteUrl('/docs/privacy-and-processing')}`,
    `- Troubleshooting: ${absoluteUrl('/docs/troubleshooting')}`,
    '',
  ].join('\n')
}

function gettingStartedMarkdown() {
  return [
    heading('Getting started', '/docs/getting-started', 'Find a tool from the homepage search or Tools catalog. Open it and use it. Free tools do not require an account.'),
    '1. Search or browse the catalog.',
    '2. Open a working tool.',
    '3. Drop a file or paste text.',
    '4. Read the Local / Server label.',
    '5. Download the result.',
    '6. Activate Pro only if a tool requires it.',
    '',
  ].join('\n')
}

function privacyDocsMarkdown() {
  return heading(
    'Privacy and processing',
    '/docs/privacy-and-processing',
    'Local tools process files in this browser. Server tools upload to Kits for a short-lived job. Temporary objects are not a personal library and are not used to train models.',
  )
}

function troubleshootingMarkdown() {
  return heading(
    'Troubleshooting',
    '/docs/troubleshooting',
    'If a dropzone rejects a file, the type is not in that tool’s accept list. If a server tool fails, retry later. Client tools do not need the API after the page has loaded.',
  )
}

function aboutMarkdown() {
  return heading(
    'About Kits',
    '/about',
    'Kits is a library of small, focused tools for images, PDFs, audio, video, text, QR codes, and developer files. There is no account wall on the free catalog.',
  )
}

function pricingMarkdown() {
  return [
    heading('Kits Pro pricing', '/pricing', 'Same Pro capabilities, different duration. Keys are issued after a manual purchase. There is no fake checkout.'),
    '- pro_1_month — 1 month',
    '- pro_6_months — 6 months',
    '- pro_12_months — 12 months',
    '',
    `Activate at ${absoluteUrl('/license')}.`,
    '',
  ].join('\n')
}

function licenseMarkdown() {
  return heading(
    'Pro license',
    '/license',
    'Paste a key issued for this product. Duration starts on first activation. One license is one active browser. Kits does not use OAuth sign-in.',
  )
}

function contactMarkdown() {
  return heading(
    'Contact',
    '/contact',
    'Kits does not run a ticket inbox from this site. Use Support and Docs for tool behavior, and the License page for Pro keys.',
  )
}

function supportMarkdown() {
  return heading(
    'Support',
    '/support',
    'Use Docs for tool behavior, Troubleshooting for failed jobs, and the License page for Pro keys.',
  )
}

function privacyMarkdown() {
  return heading(
    'Privacy',
    '/privacy',
    'Most files never leave the device. When a tool needs a server, the page says so before you upload.',
  )
}

function termsMarkdown() {
  return heading(
    'Terms',
    '/terms',
    'Kits is provided as a set of utilities in the browser and, for some tools, on Kits servers. Use it for files you have the right to process.',
  )
}

export function markdownTokenCount(markdown: string) {
  return markdown.trim().split(/\s+/).filter(Boolean).length
}

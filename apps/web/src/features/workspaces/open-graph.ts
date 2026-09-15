import { escapeHtml } from './workspace-utils'
import { parseCanonicalUrl } from './meta-tags'

export type OgType = 'website' | 'article'
export type TwitterCard = 'summary' | 'summary_large_image'

export interface OpenGraphInput {
  title: string
  description: string
  url: string
  siteName: string
  imageUrl: string
  type: OgType
  twitterCard: TwitterCard
}

export interface OpenGraphPreview {
  title: string
  description: string
  siteName: string
  hostname: string
  imageUrl: string | null
  type: OgType
  twitterCard: TwitterCard
}

export interface OpenGraphResult {
  html: string
  urlError: boolean
  imageError: boolean
  preview: OpenGraphPreview
}

function flatten(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function attr(value: string): string {
  return escapeHtml(flatten(value))
}

function hostnameOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function generateOpenGraphTags(input: OpenGraphInput): OpenGraphResult {
  const lines: string[] = []
  const title = flatten(input.title)
  const description = flatten(input.description)
  const siteName = flatten(input.siteName)
  const pageUrl = parseCanonicalUrl(input.url)
  const imageUrl = parseCanonicalUrl(input.imageUrl)
  const urlError = !pageUrl.ok && pageUrl.reason === 'invalid'
  const imageError = !imageUrl.ok && imageUrl.reason === 'invalid'

  if (title) lines.push(`<meta property="og:title" content="${attr(title)}">`)
  if (description) lines.push(`<meta property="og:description" content="${attr(description)}">`)
  if (pageUrl.ok) lines.push(`<meta property="og:url" content="${attr(pageUrl.href)}">`)
  if (imageUrl.ok) lines.push(`<meta property="og:image" content="${attr(imageUrl.href)}">`)
  lines.push(`<meta property="og:type" content="${input.type}">`)
  if (siteName) lines.push(`<meta property="og:site_name" content="${attr(siteName)}">`)

  lines.push(`<meta name="twitter:card" content="${input.twitterCard}">`)
  if (title) lines.push(`<meta name="twitter:title" content="${attr(title)}">`)
  if (description) lines.push(`<meta name="twitter:description" content="${attr(description)}">`)
  if (imageUrl.ok) lines.push(`<meta name="twitter:image" content="${attr(imageUrl.href)}">`)

  return {
    html: lines.join('\n'),
    urlError,
    imageError,
    preview: {
      title,
      description,
      siteName,
      hostname: pageUrl.ok ? hostnameOf(pageUrl.href) : '',
      imageUrl: imageUrl.ok ? imageUrl.href : null,
      type: input.type,
      twitterCard: input.twitterCard,
    },
  }
}

import { parseCanonicalUrl } from './meta-tags'

export const SCHEMA_TYPES = [
  'WebSite',
  'Organization',
  'Person',
  'Article',
  'BreadcrumbList',
  'FAQPage',
  'Product',
  'SoftwareApplication',
] as const

export type SchemaType = (typeof SCHEMA_TYPES)[number]
export type ScalarKind = 'text' | 'url' | 'email' | 'date' | 'textarea'
export type ScalarKey =
  | 'name' | 'url' | 'logo' | 'description' | 'inLanguage' | 'searchUrl' | 'image'
  | 'jobTitle' | 'email' | 'worksFor' | 'headline' | 'datePublished' | 'dateModified'
  | 'author' | 'publisher' | 'sku' | 'brand' | 'applicationCategory' | 'operatingSystem'
  | 'price' | 'priceCurrency'

export interface ScalarField {
  key: ScalarKey
  kind: ScalarKind
  required?: boolean
}

export interface JsonLdCrumb {
  name: string
  url: string
}

export interface JsonLdFaq {
  question: string
  answer: string
}

export interface JsonLdInput {
  type: SchemaType
  values: Record<string, string>
  sameAs: string
  crumbs: JsonLdCrumb[]
  faqs: JsonLdFaq[]
}

export interface FieldError {
  field: string
  code: 'required' | 'invalid-url' | 'invalid-email' | 'invalid-date'
}

export interface JsonLdResult {
  node: Record<string, unknown>
  json: string
  script: string
  errors: FieldError[]
  canCopy: boolean
}

export const SCALAR_FIELDS: Record<SchemaType, readonly ScalarField[]> = {
  WebSite: [
    { key: 'name', kind: 'text', required: true },
    { key: 'url', kind: 'url', required: true },
    { key: 'description', kind: 'textarea' },
    { key: 'inLanguage', kind: 'text' },
    { key: 'searchUrl', kind: 'url' },
  ],
  Organization: [
    { key: 'name', kind: 'text', required: true },
    { key: 'url', kind: 'url' },
    { key: 'logo', kind: 'url' },
    { key: 'description', kind: 'textarea' },
  ],
  Person: [
    { key: 'name', kind: 'text', required: true },
    { key: 'url', kind: 'url' },
    { key: 'image', kind: 'url' },
    { key: 'jobTitle', kind: 'text' },
    { key: 'email', kind: 'email' },
    { key: 'worksFor', kind: 'text' },
    { key: 'description', kind: 'textarea' },
  ],
  Article: [
    { key: 'headline', kind: 'text', required: true },
    { key: 'url', kind: 'url' },
    { key: 'description', kind: 'textarea' },
    { key: 'image', kind: 'url' },
    { key: 'datePublished', kind: 'date' },
    { key: 'dateModified', kind: 'date' },
    { key: 'author', kind: 'text' },
    { key: 'publisher', kind: 'text' },
  ],
  BreadcrumbList: [],
  FAQPage: [],
  Product: [
    { key: 'name', kind: 'text', required: true },
    { key: 'description', kind: 'textarea' },
    { key: 'image', kind: 'url' },
    { key: 'url', kind: 'url' },
    { key: 'sku', kind: 'text' },
    { key: 'brand', kind: 'text' },
  ],
  SoftwareApplication: [
    { key: 'name', kind: 'text', required: true },
    { key: 'url', kind: 'url' },
    { key: 'description', kind: 'textarea' },
    { key: 'applicationCategory', kind: 'text' },
    { key: 'operatingSystem', kind: 'text' },
    { key: 'price', kind: 'text' },
    { key: 'priceCurrency', kind: 'text' },
  ],
}

export const usesSameAs = (type: SchemaType) => type === 'Organization' || type === 'Person'
export const usesCrumbs = (type: SchemaType) => type === 'BreadcrumbList'
export const usesFaqs = (type: SchemaType) => type === 'FAQPage'

export const emptyJsonLdInput = (type: SchemaType = 'WebSite'): JsonLdInput => ({
  type,
  values: {},
  sameAs: '',
  crumbs: [{ name: '', url: '' }],
  faqs: [{ question: '', answer: '' }],
})

export function errorFor(errors: FieldError[], field: string): FieldError | undefined {
  return errors.find((error) => error.field === field)
}

function text(raw: string | undefined): string {
  return (raw ?? '').trim()
}

function takeText(raw: string | undefined, field: string, errors: FieldError[], required = false): string | undefined {
  const value = text(raw)
  if (!value) {
    if (required) errors.push({ field, code: 'required' })
    return undefined
  }
  return value
}

function takeUrl(raw: string | undefined, field: string, errors: FieldError[], required = false): string | undefined {
  const value = text(raw)
  if (!value) {
    if (required) errors.push({ field, code: 'required' })
    return undefined
  }
  const parsed = parseCanonicalUrl(value)
  if (!parsed.ok) {
    errors.push({ field, code: 'invalid-url' })
    return undefined
  }
  return parsed.href
}

function takeEmail(raw: string | undefined, field: string, errors: FieldError[]): string | undefined {
  const value = text(raw)
  if (!value) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push({ field, code: 'invalid-email' })
    return undefined
  }
  return value
}

function takeDate(raw: string | undefined, field: string, errors: FieldError[]): string | undefined {
  const value = text(raw)
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, code: 'invalid-date' })
    return undefined
  }
  return value
}

function takeSameAs(raw: string, errors: FieldError[]): string[] | undefined {
  const lines = raw.split(/\r\n|\n|\r/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return undefined
  const urls: string[] = []
  let invalid = false
  for (const line of lines) {
    const parsed = parseCanonicalUrl(line)
    if (parsed.ok) urls.push(parsed.href)
    else invalid = true
  }
  if (invalid) errors.push({ field: 'sameAs', code: 'invalid-url' })
  return urls.length ? urls : undefined
}

function wrapScript(json: string): string {
  return `<script type="application/ld+json">\n${json.replace(/</g, '\\u003c')}\n</script>`
}

function nodeBase(type: SchemaType): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': type }
}

function set(node: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) node[key] = value
}

export function generateJsonLd(input: JsonLdInput): JsonLdResult {
  const errors: FieldError[] = []
  const values = input.values
  const node = nodeBase(input.type)

  switch (input.type) {
    case 'WebSite': {
      set(node, 'name', takeText(values.name, 'name', errors, true))
      set(node, 'url', takeUrl(values.url, 'url', errors, true))
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'inLanguage', takeText(values.inLanguage, 'inLanguage', errors))
      const searchUrl = takeUrl(values.searchUrl, 'searchUrl', errors)
      if (searchUrl) {
        node.potentialAction = {
          '@type': 'SearchAction',
          target: searchUrl,
          'query-input': 'required name=search_term_string',
        }
      }
      break
    }
    case 'Organization': {
      set(node, 'name', takeText(values.name, 'name', errors, true))
      set(node, 'url', takeUrl(values.url, 'url', errors))
      set(node, 'logo', takeUrl(values.logo, 'logo', errors))
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'sameAs', takeSameAs(input.sameAs, errors))
      break
    }
    case 'Person': {
      set(node, 'name', takeText(values.name, 'name', errors, true))
      set(node, 'url', takeUrl(values.url, 'url', errors))
      set(node, 'image', takeUrl(values.image, 'image', errors))
      set(node, 'jobTitle', takeText(values.jobTitle, 'jobTitle', errors))
      set(node, 'email', takeEmail(values.email, 'email', errors))
      const worksFor = takeText(values.worksFor, 'worksFor', errors)
      if (worksFor) node.worksFor = { '@type': 'Organization', name: worksFor }
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'sameAs', takeSameAs(input.sameAs, errors))
      break
    }
    case 'Article': {
      set(node, 'headline', takeText(values.headline, 'headline', errors, true))
      set(node, 'url', takeUrl(values.url, 'url', errors))
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'image', takeUrl(values.image, 'image', errors))
      set(node, 'datePublished', takeDate(values.datePublished, 'datePublished', errors))
      set(node, 'dateModified', takeDate(values.dateModified, 'dateModified', errors))
      const author = takeText(values.author, 'author', errors)
      if (author) node.author = { '@type': 'Person', name: author }
      const publisher = takeText(values.publisher, 'publisher', errors)
      if (publisher) node.publisher = { '@type': 'Organization', name: publisher }
      break
    }
    case 'BreadcrumbList': {
      const items: Record<string, unknown>[] = []
      input.crumbs.forEach((crumb, index) => {
        const name = text(crumb.name)
        const url = takeUrl(crumb.url, `crumb:${index}:url`, errors)
        if (!name) return
        const item: Record<string, unknown> = { '@type': 'ListItem', position: items.length + 1, name }
        if (url) item.item = url
        items.push(item)
      })
      if (!items.length) errors.push({ field: 'crumbs', code: 'required' })
      else node.itemListElement = items
      break
    }
    case 'FAQPage': {
      const entities: Record<string, unknown>[] = []
      for (const row of input.faqs) {
        const question = text(row.question)
        const answer = text(row.answer)
        if (!question && !answer) continue
        if (!question || !answer) {
          errors.push({ field: 'faqs', code: 'required' })
          continue
        }
        entities.push({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })
      }
      if (!entities.length) errors.push({ field: 'faqs', code: 'required' })
      else node.mainEntity = entities
      break
    }
    case 'Product': {
      set(node, 'name', takeText(values.name, 'name', errors, true))
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'image', takeUrl(values.image, 'image', errors))
      set(node, 'url', takeUrl(values.url, 'url', errors))
      set(node, 'sku', takeText(values.sku, 'sku', errors))
      const brand = takeText(values.brand, 'brand', errors)
      if (brand) node.brand = { '@type': 'Brand', name: brand }
      break
    }
    case 'SoftwareApplication': {
      set(node, 'name', takeText(values.name, 'name', errors, true))
      set(node, 'url', takeUrl(values.url, 'url', errors))
      set(node, 'description', takeText(values.description, 'description', errors))
      set(node, 'applicationCategory', takeText(values.applicationCategory, 'applicationCategory', errors))
      set(node, 'operatingSystem', takeText(values.operatingSystem, 'operatingSystem', errors))
      const price = takeText(values.price, 'price', errors)
      const priceCurrency = takeText(values.priceCurrency, 'priceCurrency', errors)
      if (price) {
        const offer: Record<string, unknown> = { '@type': 'Offer', price }
        if (priceCurrency) offer.priceCurrency = priceCurrency
        node.offers = offer
      }
      break
    }
  }

  const json = `${JSON.stringify(node, null, 2)}\n`
  const canCopy = !errors.some((error) => error.code === 'required')
  return { node, json, script: wrapScript(json.trimEnd()), errors, canCopy }
}

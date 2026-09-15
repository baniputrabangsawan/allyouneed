import { describe, expect, it } from 'vitest'
import { emptyJsonLdInput, generateJsonLd, SCHEMA_TYPES, type JsonLdInput } from './json-ld'

function input(partial: Partial<JsonLdInput> & Pick<JsonLdInput, 'type'>): JsonLdInput {
  return { ...emptyJsonLdInput(partial.type), ...partial }
}

describe('generateJsonLd', () => {
  it('builds Organization JSON-LD and omits empty optional fields', () => {
    const result = generateJsonLd(input({
      type: 'Organization',
      values: {
        name: 'Kits',
        url: 'https://usekits.online',
        logo: 'https://usekits.online/logo.png',
        description: 'Browser-first file tools.',
      },
      sameAs: 'https://github.com/baniputrabangsawan/allyouneed\nhttps://x.com/usekits',
    }))
    expect(result.canCopy).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.node).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Kits',
      url: 'https://usekits.online/',
      logo: 'https://usekits.online/logo.png',
      description: 'Browser-first file tools.',
      sameAs: ['https://github.com/baniputrabangsawan/allyouneed', 'https://x.com/usekits'],
    })
    expect(JSON.parse(result.json)).toEqual(result.node)
    expect(result.script).toContain('<script type="application/ld+json">')
    expect(result.script).toContain('"@type": "Organization"')
    expect(result.script.endsWith('</script>')).toBe(true)
  })

  it('does not invent data, ratings, or a SearchAction', () => {
    const org = generateJsonLd(input({ type: 'Organization', values: { name: 'Kits' } }))
    expect(org.node).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Kits' })
    expect(org.json).not.toMatch(/aggregateRating|review|ratingValue/)

    const product = generateJsonLd(input({ type: 'Product', values: { name: 'Notebook' } }))
    expect(product.node).toEqual({ '@context': 'https://schema.org', '@type': 'Product', name: 'Notebook' })
    expect(JSON.stringify(product.node)).not.toMatch(/aggregateRating|"review"|ratingValue/)

    const site = generateJsonLd(input({ type: 'WebSite', values: { name: 'Kits', url: 'https://usekits.online' } }))
    expect(site.node.potentialAction).toBeUndefined()
  })

  it('requires identifying fields and keeps a live node without them', () => {
    const result = generateJsonLd(input({ type: 'Organization', values: { url: 'https://example.com' } }))
    expect(result.canCopy).toBe(false)
    expect(result.errors).toContainEqual({ field: 'name', code: 'required' })
    expect(result.node).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      url: 'https://example.com/',
    })
  })

  it('omits invalid URLs, emails, and dates without blocking copy of the rest', () => {
    const result = generateJsonLd(input({
      type: 'Person',
      values: {
        name: 'Ada',
        url: 'javascript:alert(1)',
        email: 'not-an-email',
        image: 'https://example.com/ada.jpg',
      },
      sameAs: 'https://example.com/ada\nftp://files.example',
    }))
    expect(result.canCopy).toBe(true)
    expect(result.node).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada',
      image: 'https://example.com/ada.jpg',
      sameAs: ['https://example.com/ada'],
    })
    expect(result.errors).toEqual([
      { field: 'url', code: 'invalid-url' },
      { field: 'email', code: 'invalid-email' },
      { field: 'sameAs', code: 'invalid-url' },
    ])
  })

  it('escapes < in the script embed so JSON stays valid inside HTML', () => {
    const result = generateJsonLd(input({
      type: 'Organization',
      values: { name: 'Shop</script><script>alert(1)' },
    }))
    expect(result.json).toContain('Shop</script><script>alert(1)')
    expect(result.script).toContain('\\u003c/script>')
    expect(result.script).not.toMatch(/<\/script><script>/)
    const body = result.script.replace(/^<script type="application\/ld\+json">\n/, '').replace(/\n<\/script>$/, '')
    expect(JSON.parse(body)).toEqual(result.node)
  })

  it('builds BreadcrumbList positions from named items only', () => {
    const result = generateJsonLd(input({
      type: 'BreadcrumbList',
      crumbs: [
        { name: '', url: 'https://example.com' },
        { name: 'Home', url: 'https://example.com' },
        { name: 'Docs', url: '' },
      ],
    }))
    expect(result.canCopy).toBe(true)
    expect(result.node.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
      { '@type': 'ListItem', position: 2, name: 'Docs' },
    ])
  })

  it('requires at least one complete FAQ pair', () => {
    const empty = generateJsonLd(input({ type: 'FAQPage' }))
    expect(empty.canCopy).toBe(false)
    expect(empty.node.mainEntity).toBeUndefined()

    const partial = generateJsonLd(input({
      type: 'FAQPage',
      faqs: [{ question: 'What is JSON-LD?', answer: '' }],
    }))
    expect(partial.canCopy).toBe(false)

    const ok = generateJsonLd(input({
      type: 'FAQPage',
      faqs: [{ question: 'What is JSON-LD?', answer: 'A JSON format for schema.org markup.' }],
    }))
    expect(ok.node.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'What is JSON-LD?',
        acceptedAnswer: { '@type': 'Answer', text: 'A JSON format for schema.org markup.' },
      },
    ])
  })

  it('nests Article and SoftwareApplication objects only from filled fields', () => {
    const article = generateJsonLd(input({
      type: 'Article',
      values: {
        headline: 'Using JSON-LD',
        datePublished: '2026-09-15',
        dateModified: 'not-a-date',
        author: 'Ada',
        publisher: 'Kits',
      },
    }))
    expect(article.node).toMatchObject({
      headline: 'Using JSON-LD',
      datePublished: '2026-09-15',
      author: { '@type': 'Person', name: 'Ada' },
      publisher: { '@type': 'Organization', name: 'Kits' },
    })
    expect(article.node.dateModified).toBeUndefined()
    expect(article.errors).toContainEqual({ field: 'dateModified', code: 'invalid-date' })

    const app = generateJsonLd(input({
      type: 'SoftwareApplication',
      values: { name: 'Kits', price: '0', priceCurrency: 'USD' },
    }))
    expect(app.node.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' })

    const namelessPrice = generateJsonLd(input({
      type: 'SoftwareApplication',
      values: { price: '9' },
    }))
    expect(namelessPrice.canCopy).toBe(false)
    expect(namelessPrice.node.offers).toEqual({ '@type': 'Offer', price: '9' })
  })

  it('covers every supported schema type', () => {
    expect(SCHEMA_TYPES).toEqual([
      'WebSite', 'Organization', 'Person', 'Article', 'BreadcrumbList', 'FAQPage', 'Product', 'SoftwareApplication',
    ])
    for (const type of SCHEMA_TYPES) {
      const result = generateJsonLd(emptyJsonLdInput(type))
      expect(result.node['@context']).toBe('https://schema.org')
      expect(result.node['@type']).toBe(type)
    }
  })
})

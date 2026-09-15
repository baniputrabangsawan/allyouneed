import { describe, expect, it } from 'vitest'
import { generateOpenGraphTags } from './open-graph'

const base = {
  title: 'Kits — file tools in the browser',
  description: 'Compress, convert, and generate files locally without creating an account.',
  url: 'https://usekits.online/tools/open-graph-generator',
  siteName: 'Kits',
  imageUrl: 'https://usekits.online/og/kits-tools.png',
  type: 'website' as const,
  twitterCard: 'summary_large_image' as const,
}

describe('generateOpenGraphTags', () => {
  it('builds escaped Open Graph and Twitter tags', () => {
    const { html, urlError, imageError, preview } = generateOpenGraphTags({
      ...base,
      title: 'Shop <script>alert(1)</script>',
      description: 'Say "hello" & goodbye',
      siteName: 'Kits & Co',
    })
    expect(html).toContain('<meta property="og:title" content="Shop &lt;script&gt;alert(1)&lt;/script&gt;">')
    expect(html).toContain('<meta property="og:description" content="Say &quot;hello&quot; &amp; goodbye">')
    expect(html).toContain('<meta property="og:url" content="https://usekits.online/tools/open-graph-generator">')
    expect(html).toContain('<meta property="og:image" content="https://usekits.online/og/kits-tools.png">')
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(html).toContain('<meta property="og:site_name" content="Kits &amp; Co">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('<meta name="twitter:title" content="Shop &lt;script&gt;alert(1)&lt;/script&gt;">')
    expect(html).toContain('<meta name="twitter:image" content="https://usekits.online/og/kits-tools.png">')
    expect(html).not.toContain('<script>')
    expect(urlError).toBe(false)
    expect(imageError).toBe(false)
    expect(preview.hostname).toBe('usekits.online')
    expect(preview.imageUrl).toBe('https://usekits.online/og/kits-tools.png')
  })

  it('omits empty optional tags and keeps type plus card', () => {
    const { html, urlError, imageError, preview } = generateOpenGraphTags({
      title: '',
      description: '  ',
      url: '',
      siteName: '',
      imageUrl: '',
      type: 'article',
      twitterCard: 'summary',
    })
    expect(html).toBe('<meta property="og:type" content="article">\n<meta name="twitter:card" content="summary">')
    expect(urlError).toBe(false)
    expect(imageError).toBe(false)
    expect(preview.imageUrl).toBeNull()
    expect(preview.hostname).toBe('')
  })

  it('omits invalid page and image URLs without blocking other tags', () => {
    const { html, urlError, imageError, preview } = generateOpenGraphTags({
      ...base,
      url: 'javascript:alert(1)',
      imageUrl: '/relative.png',
    })
    expect(html).toContain('<meta property="og:title"')
    expect(html).not.toContain('og:url')
    expect(html).not.toContain('og:image')
    expect(html).not.toContain('twitter:image')
    expect(urlError).toBe(true)
    expect(imageError).toBe(true)
    expect(preview.imageUrl).toBeNull()
  })

  it('rejects credentialed and non-http image URLs', () => {
    const data = generateOpenGraphTags({ ...base, imageUrl: 'data:image/png;base64,xxxx' })
    expect(data.imageError).toBe(true)
    expect(data.html).not.toContain('og:image')
    const creds = generateOpenGraphTags({ ...base, imageUrl: 'https://user:pass@cdn.example.com/og.png' })
    expect(creds.imageError).toBe(true)
  })
})

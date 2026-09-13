import { describe, expect, it } from 'vitest'
import { guideArticles, guideCopy } from '@/content/guides/catalog'
import { readingMinutes } from './reading-minutes'

describe('guide catalog presentation', () => {
  it('keeps title and description as separate strings for every article', () => {
    for (const article of guideArticles) {
      const item = guideCopy(article, 'en')
      expect(item.title.trim().length).toBeGreaterThan(0)
      expect(item.description.trim().length).toBeGreaterThan(0)
      expect(item.title.includes(item.description)).toBe(false)
      expect(readingMinutes(`${item.title} ${item.description} ${item.intro}`)).toBeGreaterThan(0)
    }
  })

  it('covers image, pdf, audio, video, and qr guides for the filter row', () => {
    const categories = new Set(guideArticles.map((article) => article.category))
    expect(categories.has('image')).toBe(true)
    expect(categories.has('pdf')).toBe(true)
    expect(categories.has('audio')).toBe(true)
    expect(categories.has('video')).toBe(true)
    expect(categories.has('qr')).toBe(true)
  })
})

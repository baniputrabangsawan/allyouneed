import { describe, expect, it } from 'vitest'
import { activeHomeSection } from './active-home-section'

describe('active home section', () => {
  const sections = [
    { id: 'recent', top: 40 },
    { id: 'favorites', top: 200 },
    { id: 'new', top: 400 },
    { id: 'all-tools', top: 600 },
  ]

  it('returns none before any section crosses the spy line', () => {
    expect(activeHomeSection(sections.map((section) => ({ ...section, top: section.top + 200 })), 96)).toBe(null)
  })

  it('highlights only the last section that crossed the line', () => {
    expect(activeHomeSection(sections, 96)).toBe('recent')
    expect(activeHomeSection([
      { id: 'recent', top: -20 },
      { id: 'favorites', top: 80 },
      { id: 'new', top: 300 },
      { id: 'all-tools', top: 500 },
    ], 96)).toBe('favorites')
  })

  it('does not keep earlier sections active', () => {
    expect(activeHomeSection([
      { id: 'recent', top: -400 },
      { id: 'favorites', top: -200 },
      { id: 'new', top: -40 },
      { id: 'all-tools', top: 40 },
    ], 96)).toBe('all-tools')
  })
})

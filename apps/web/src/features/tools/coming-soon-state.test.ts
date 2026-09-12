import { describe, expect, it } from 'vitest'
import { publicToolAudienceState } from './tool-availability'
import { getRelatedTools, getToolBySlug } from './tool-registry'

describe('public tool audience state', () => {
  it('maps unavailable tools to coming soon, including Pro catalog entries', () => {
    const ocr = getToolBySlug('ocr-pdf')
    expect(ocr?.available).toBe(false)
    expect(publicToolAudienceState(ocr!)).toBe('coming-soon')
    expect(publicToolAudienceState(ocr!, false)).toBe('coming-soon')
  })

  it('keeps available tools available and locks Pro only when entitled is false', () => {
    const compress = getToolBySlug('compress-image')
    expect(compress?.available).toBe(true)
    expect(publicToolAudienceState(compress!)).toBe('available')
    expect(publicToolAudienceState({ available: true, accessTier: 'pro' }, false)).toBe('pro-locked')
    expect(publicToolAudienceState({ available: true, accessTier: 'pro' }, true)).toBe('available')
  })

  it('does not expose configuration-required to public users', () => {
    const ocr = getToolBySlug('ocr-pdf')
    expect(publicToolAudienceState(ocr!)).not.toBe('configuration-required')
    const subtitle = getToolBySlug('add-subtitle')
    expect(subtitle?.available).toBe(true)
    expect(publicToolAudienceState(subtitle!)).toBe('available')
  })

  it('suggests only available related tools from the registry', () => {
    const subtitle = getToolBySlug('add-subtitle')
    const related = getRelatedTools(subtitle!)
    expect(related.length).toBeGreaterThan(0)
    expect(related.length).toBeLessThanOrEqual(4)
    expect(related.every((tool) => tool.available && tool.id !== subtitle!.id)).toBe(true)
  })
})

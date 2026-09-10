import { describe, expect, it } from 'vitest'
import {
  comparisonRows,
  monthlyEquivalent,
  planCardHighlights,
  pricingPlans,
  proFeatureList,
  savingsVsMonthly,
} from './plans'

describe('pricing plans', () => {
  it('keeps the same Pro features across every duration', () => {
    expect(pricingPlans.map((plan) => plan.id)).toEqual(['pro_1_month', 'pro_6_months', 'pro_12_months'])
    const features = proFeatureList()
    expect(features).toContain('Remove Background')
    expect(features).toContain('Upscale Image')
    expect(new Set(features).size).toBe(features.length)
  })

  it('marks 6 months as most popular and 12 months as best value', () => {
    const [oneMonth, sixMonths, twelveMonths] = pricingPlans
    expect(oneMonth).toMatchObject({ price: 30_000, badge: 'Short-term access' })
    expect(oneMonth?.featured).toBeFalsy()
    expect(sixMonths).toMatchObject({ price: 70_000, badge: 'Most popular', featured: true })
    expect(twelveMonths).toMatchObject({ price: 100_000, badge: 'Best value', value: true })
    expect(twelveMonths?.featured).toBeFalsy()
  })

  it('keeps compact card highlights identical across durations', () => {
    expect(planCardHighlights).toEqual([
      'Full Pro access',
      'AI tools included',
      'Subtitle Generator',
      'Speech to Text',
      'Advanced OCR',
      '1 active installation',
    ])
  })

  it('prices longer plans below monthly access', () => {
    expect(monthlyEquivalent(70_000, 6)).toBe(11_667)
    expect(monthlyEquivalent(100_000, 12)).toBe(8_333)
    expect(savingsVsMonthly(70_000, 6)).toBe(110_000)
    expect(savingsVsMonthly(100_000, 12)).toBe(260_000)
  })

  it('keeps Free tools available in the comparison', () => {
    const rows = comparisonRows()
    expect(rows.find((row) => row.label === 'Basic browser tools')).toMatchObject({ free: true, pro: true })
    expect(rows.find((row) => row.label === 'Remove Background')).toMatchObject({ free: false, pro: true })
  })
})

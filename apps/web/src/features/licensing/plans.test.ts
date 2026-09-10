import { describe, expect, it } from 'vitest'
import {
  comparisonRows,
  monthlyEquivalent,
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

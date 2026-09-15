import { describe, expect, it } from 'vitest'
import { bases, bitwise, calculatePercent, compoundInterest, evaluateExpression, loanPayment, simplifyFraction, statistics } from './calculator-engines'

describe('calculator engines', () => {
  it('evaluates standard and scientific expressions safely', () => {
    expect(evaluateExpression('(125 + 25) / 3')).toBeCloseTo(50)
    expect(evaluateExpression('sin(45)', 'deg')).toBeCloseTo(Math.SQRT1_2)
    expect(evaluateExpression('log(1000)')).toBeCloseTo(3)
    expect(evaluateExpression('sqrt(144)')).toBeCloseTo(12)
    expect(evaluateExpression('5!')).toBe(120)
    expect(evaluateExpression('2^10')).toBe(1024)
    expect(evaluateExpression('500 * 12%')).toBe(60)
    expect(evaluateExpression('10 % 3')).toBe(1)
  })

  it('handles percentage, finance, stats, bases, bitwise, and fractions', () => {
    expect(calculatePercent('of', 2000, 15)).toBe(300)
    expect(calculatePercent('change', 100, 125)).toBe(25)
    expect(loanPayment(100000, 6, 360).monthly).toBeCloseTo(599.55, 1)
    expect(compoundInterest(1000, 10, 1, 1).finalValue).toBeCloseTo(1100)
    expect(compoundInterest(1000, 0, 2, 12, 100)).toEqual({ finalValue: 3400, contributed: 3400, interest: 0 })
    expect(statistics([10, 15, 20, 25, 30], false)).toMatchObject({ count: 5, sum: 100, mean: 20, median: 20, range: 20 })
    expect(bases('255')).toEqual({ binary: '11111111', octal: '377', decimal: '255', hex: 'FF' })
    expect(bitwise('AND', 12, 10)).toBe(8)
    expect(simplifyFraction(23, 20)).toEqual({ n: 23, d: 20 })
  })
})

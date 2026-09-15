import { describe, expect, it } from 'vitest'
import { calculateClamp, formatCssNumber, valueAtViewport, type ClampInput } from './css-clamp'

const base: ClampInput = {
  minViewport: 320,
  maxViewport: 1440,
  minValue: 16,
  maxValue: 32,
  unit: 'px',
  rootPx: 16,
  property: 'font-size',
}

describe('calculateClamp', () => {
  it('builds clamp() for 320px–1440px and 16px–32px', () => {
    const result = calculateClamp(base)
    expect(result.ok).toBe(true)
    expect(result.css).toBe('font-size: clamp(16px, 1.4286vw + 11.4286px, 32px);')
    expect(result.preferred).toBe('1.4286vw + 11.4286px')
    expect(valueAtViewport(base, 320)).toBeCloseTo(16, 3)
    expect(valueAtViewport(base, 1440)).toBeCloseTo(32, 3)
  })

  it('converts rem using a custom root font size', () => {
    const input: ClampInput = { ...base, minValue: 1, maxValue: 2, unit: 'rem', rootPx: 16 }
    const result = calculateClamp(input)
    expect(result.ok).toBe(true)
    expect(result.css).toBe('font-size: clamp(1rem, 1.4286vw + 0.7143rem, 2rem);')
    expect(valueAtViewport(input, 320)).toBeCloseTo(1, 3)
    expect(valueAtViewport({ ...input, rootPx: 20 }, 320)).toBeCloseTo(1, 3)
  })

  it('rejects equal viewports to avoid divide-by-zero', () => {
    const result = calculateClamp({ ...base, minViewport: 800, maxViewport: 800 })
    expect(result.ok).toBe(false)
    expect(result.css).toBe('')
    expect(result.errors).toContain('viewportOrder')
  })

  it('requires min viewport < max viewport', () => {
    const result = calculateClamp({ ...base, minViewport: 1440, maxViewport: 320 })
    expect(result.ok).toBe(false)
    expect(result.css).toBe('')
    expect(result.errors).toContain('viewportOrder')
  })

  it('keeps inverted values valid by ordering clamp bounds', () => {
    const input: ClampInput = { ...base, minValue: 32, maxValue: 16 }
    const result = calculateClamp(input)
    expect(result.ok).toBe(true)
    expect(result.css.startsWith('font-size: clamp(16px, ')).toBe(true)
    expect(result.css.endsWith(', 32px);')).toBe(true)
    expect(valueAtViewport(input, 320)).toBeCloseTo(32, 3)
    expect(valueAtViewport(input, 1440)).toBeCloseTo(16, 3)
  })

  it('handles decimals without emitting excessive precision', () => {
    const result = calculateClamp({ ...base, minValue: 16.25, maxValue: 31.75 })
    expect(result.ok).toBe(true)
    expect(result.css).toMatch(/^font-size: clamp\(16\.25px, [\d.]+vw \+ [\d.]+px, 31\.75px\);$/)
    expect(result.css).not.toMatch(/\d{5,}/)
    expect(formatCssNumber(1.428571428)).toBe('1.4286')
  })

  it('does not emit CSS for invalid numbers, root, or property', () => {
    expect(calculateClamp({ ...base, minViewport: Number.NaN }).css).toBe('')
    expect(calculateClamp({ ...base, rootPx: 0 }).errors).toContain('root')
    expect(calculateClamp({ ...base, property: 'font size' }).css).toBe('')
    expect(calculateClamp({ ...base, property: 'width;color:red' }).ok).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { convertAll, conversionCategories } from './conversion-engine'

const ctx = { remPx: 16, emPx: 16 }
const value = (category: string, amount: number, unit: string, target: string) => convertAll(category, amount, unit, ctx).find((item) => item.id === target)!.value

describe('conversion engine', () => {
  it('uses canonical base units for exact length values', () => {
    expect(value('length', 100, 'centimeter', 'meter')).toBeCloseTo(1)
    expect(value('length', 1, 'kilometer', 'meter')).toBeCloseTo(1000)
    expect(value('length', 1, 'inch', 'centimeter')).toBeCloseTo(2.54)
  })

  it('uses accepted mass, temperature, data, and fuel constants', () => {
    expect(value('mass', 1, 'pound', 'kilogram')).toBeCloseTo(0.45359237)
    expect(value('temperature', 0, 'celsius', 'fahrenheit')).toBeCloseTo(32)
    expect(value('temperature', 100, 'celsius', 'kelvin')).toBeCloseTo(373.15)
    expect(value('data', 1, 'byte', 'bit')).toBeCloseTo(8)
    expect(value('data', 1, 'kib', 'byte')).toBeCloseTo(1024)
    expect(value('fuel', 10, 'l-100km', 'km-l')).toBeCloseTo(10)
  })

  it('covers the requested converter categories', () => {
    expect(conversionCategories.map((category) => category.id)).toEqual(expect.arrayContaining(['length', 'area', 'volume', 'mass', 'temperature', 'speed', 'time', 'data', 'data-rate', 'pressure', 'energy', 'power', 'force', 'torque', 'angle', 'frequency', 'fuel', 'typography']))
  })
})

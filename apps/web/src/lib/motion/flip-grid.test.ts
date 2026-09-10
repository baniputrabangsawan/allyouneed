import { describe, expect, it } from 'vitest'
import { itemSignature, liveItems, planFlipRender } from './flip-grid'

describe('planFlipRender', () => {
  it('keeps leaving items until they are removed', () => {
    const previous = [{ item: 'a', leaving: false }, { item: 'b', leaving: false }, { item: 'c', leaving: false }]
    const planned = planFlipRender(previous, ['a', 'c'], (id) => id)
    expect(planned.map((entry) => entry.item)).toEqual(['a', 'c', 'b'])
    expect(planned.find((entry) => entry.item === 'b')?.leaving).toBe(true)
    expect(liveItems(planned)).toEqual(['a', 'c'])
  })

  it('does not duplicate ids that moved rather than left', () => {
    const previous = [{ item: 'soon', leaving: false }, { item: 'live', leaving: false }]
    const planned = planFlipRender(previous, ['live', 'soon'], (id) => id)
    expect(planned).toEqual([{ item: 'live', leaving: false }, { item: 'soon', leaving: false }])
  })

  it('builds a stable signature for filter changes', () => {
    expect(itemSignature(['image', 'pdf'], (id) => id)).not.toBe(itemSignature(['developer'], (id) => id))
  })
})

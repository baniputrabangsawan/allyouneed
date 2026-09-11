import { describe, expect, it } from 'vitest'
import {
  addMemeLayer,
  createMemeLayer,
  defaultMemeLayers,
  drawMemeLayers,
  getMemeCaption,
  hasMemeText,
  nudgeMemeLayer,
  removeMemeLayer,
  resolveMemeFont,
  setMemeCaption,
  updateMemeLayer,
  wrapMemeText,
  type MemeTextLayer,
} from './meme-utils'

function fakeContext() {
  const calls: Array<[string, string, number, number]> = []
  const context = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: 'center',
    textBaseline: 'middle',
    lineJoin: 'round',
    miterLimit: 2,
    save() {},
    restore() {},
    measureText(text: string) { return { width: text.length * 10 } },
    fillText(text: string, x: number, y: number) { calls.push(['fill', text, x, y]) },
    strokeText(text: string, x: number, y: number) { calls.push(['stroke', text, x, y]) },
  }
  return { context: context as unknown as CanvasRenderingContext2D, calls }
}

describe('meme text-layer state', () => {
  it('starts with independent top and bottom caption layers', () => {
    const layers = defaultMemeLayers({ width: 800, height: 600 })
    expect(layers.map((layer) => layer.role)).toEqual(['top', 'bottom'])
    expect(layers[0]?.y).toBeLessThan(layers[1]?.y ?? 1)
    expect(layers[0]?.align).toBe('center')
    expect(getMemeCaption(layers, 'top')).toBe('')
    expect(hasMemeText(layers)).toBe(false)
  })

  it('updates captions and extra layers without mutating the original array', () => {
    const start = defaultMemeLayers()
    const withText = setMemeCaption(setMemeCaption(start, 'top', 'ONE DOES NOT'), 'bottom', 'SIMPLY WALK')
    const extra = createMemeLayer({ id: 'mid', text: 'INTO MORDOR', y: 0.5, fontFamily: 'arial', align: 'left' })
    const added = addMemeLayer(withText, extra)
    const moved = updateMemeLayer(added, 'mid', { x: 0.2, fontSize: 36, fill: '#ff0', stroke: '#111', strokeWidth: 2 })
    expect(start[0]?.text).toBe('')
    expect(getMemeCaption(moved, 'top')).toBe('ONE DOES NOT')
    expect(getMemeCaption(moved, 'bottom')).toBe('SIMPLY WALK')
    expect(moved[2]).toMatchObject({ id: 'mid', text: 'INTO MORDOR', x: 0.2, fontSize: 36, align: 'left', fontFamily: 'arial' })
    expect(hasMemeText(moved)).toBe(true)
  })

  it('keeps top and bottom layers when extras are removed', () => {
    const layers = addMemeLayer(defaultMemeLayers(), createMemeLayer({ id: 'extra', text: 'bonus' }))
    expect(removeMemeLayer(layers, 'top')).toHaveLength(3)
    expect(removeMemeLayer(layers, 'extra').map((layer) => layer.id)).toEqual(['top', 'bottom'])
  })

  it('clamps dragged positions and unknown fonts', () => {
    const layers = nudgeMemeLayer(updateMemeLayer(defaultMemeLayers(), 'top', { x: 2, y: -1, fontFamily: 'comic' }), 'bottom', 0, 5)
    expect(layers[0]).toMatchObject({ x: 1, y: 0, fontFamily: 'comic' })
    expect(layers[1]?.y).toBe(1)
    expect(resolveMemeFont('not-a-font').id).toBe('impact')
    expect(resolveMemeFont('courier').stack).toContain('Courier New')
  })
})

describe('meme canvas export drawing', () => {
  it('strokes and fills visible text onto a fresh drawing list', () => {
    const { context, calls } = fakeContext()
    const layers: MemeTextLayer[] = [
      createMemeLayer({ id: 'top', role: 'top', text: 'TOP TEXT', y: 0.1, fontSize: 40, strokeWidth: 4 }),
      createMemeLayer({ id: 'bottom', role: 'bottom', text: '   ', y: 0.9 }),
      createMemeLayer({ id: 'mid', text: 'MID', x: 0.25, y: 0.5, align: 'left', strokeWidth: 0, fill: '#fff' }),
    ]
    const snapshot = structuredClone(layers)
    drawMemeLayers(context, { width: 400, height: 200 }, layers)
    expect(layers).toEqual(snapshot)
    expect(calls.filter((call) => call[0] === 'stroke').map((call) => call[1])).toEqual(['TOP TEXT'])
    expect(calls.filter((call) => call[0] === 'fill').map((call) => call[1])).toEqual(['TOP TEXT', 'MID'])
    const top = calls.find((call) => call[1] === 'TOP TEXT')
    expect(top?.[2]).toBe(200)
    expect(top?.[3]).toBeCloseTo(20, 5)
    const mid = calls.find((call) => call[1] === 'MID')
    expect(mid?.[2]).toBe(100)
  })

  it('wraps long caption lines to the layer max width', () => {
    const measure = { measureText(text: string) { return { width: text.length * 10 } } }
    expect(wrapMemeText(measure, 'one two three', 40)).toEqual(['one', 'two', 'three'])
    expect(wrapMemeText(measure, 'hello\nworld', 400)).toEqual(['hello', 'world'])
  })
})

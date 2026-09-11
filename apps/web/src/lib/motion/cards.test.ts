import { describe, expect, it } from 'vitest'
import { cardEnterVars, cardExitVars, comingSoonEnterVars } from './cards'
import { motion } from './config'

describe('card motion tokens', () => {
  it('enters through rise, scale, and blur without claiming a long stagger', () => {
    const enter = cardEnterVars()
    expect(enter.from.y).toBe(motion.card.enter.y)
    expect(enter.from.scale).toBe(0.965)
    expect(enter.from.filter).toContain('10px')
    expect(enter.to.duration).toBe(0.45)
    expect(enter.to.stagger.each).toBeLessThan(0.05)
  })

  it('exits faster than it enters and never uses MP3-like elastic easing', () => {
    const exit = cardExitVars()
    expect(exit.duration).toBeLessThan(cardEnterVars().to.duration)
    expect(exit.scale).toBe(0.95)
    expect(exit.ease).toBe('power2.in')
  })

  it('keeps Coming Soon quieter than available cards', () => {
    const soon = comingSoonEnterVars()
    const available = cardEnterVars()
    expect(soon.from.y).toBeLessThan(available.from.y)
    expect(soon.from.scale).toBeGreaterThan(available.from.scale)
    expect(soon.from.filter).toContain('6px')
  })
})

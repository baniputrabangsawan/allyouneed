import { motion } from './config'
import { gsap } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'

export function visibleCards(cards: Iterable<Element>) {
  if (typeof window === 'undefined') return [...cards]
  const limit = window.innerHeight + 120
  return [...cards].filter((card) => card.getBoundingClientRect().top < limit)
}

export function cardEnterVars() {
  const compact = isCompactMotion()
  return {
    from: {
      autoAlpha: 0,
      y: compact ? 16 : motion.card.enter.y,
      scale: motion.card.enter.scale,
      filter: `blur(${compact ? motion.blur.small : motion.card.enter.blur}px)`,
    },
    to: {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: compact ? motion.duration.normal : motion.card.enter.duration,
      stagger: { each: compact ? 0.02 : motion.card.enter.stagger, from: 'start' as const },
      ease: motion.ease.enter,
      overwrite: 'auto' as const,
      clearProps: 'filter',
    },
  }
}

export function cardExitVars() {
  const compact = isCompactMotion()
  return {
    autoAlpha: 0,
    y: compact ? -4 : motion.card.exit.y,
    scale: motion.card.exit.scale,
    filter: `blur(${compact ? motion.blur.small : motion.card.exit.blur}px)`,
    duration: motion.card.exit.duration,
    ease: motion.ease.exit,
    overwrite: 'auto' as const,
  }
}

export function revealCards(cards: Iterable<Element>) {
  const elements = visibleCards(cards)
  const rest = [...cards].filter((card) => !elements.includes(card))
  if (rest.length) gsap.set(rest, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)' })
  if (!elements.length || prefersReducedMotion()) {
    gsap.set([...cards], { autoAlpha: 1, y: 0, scale: 1, filter: 'none' })
    return
  }
  const { from, to } = cardEnterVars()
  gsap.fromTo(elements, from, to)
}

export function comingSoonEnterVars() {
  const compact = isCompactMotion()
  return {
    from: { autoAlpha: 0.35, y: compact ? 10 : 18, filter: `blur(${compact ? 6 : 10}px)` },
    to: {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: motion.duration.normal,
      stagger: { each: 0.025, from: 'start' as const },
      ease: motion.ease.enter,
      overwrite: 'auto' as const,
      clearProps: 'filter',
    },
  }
}

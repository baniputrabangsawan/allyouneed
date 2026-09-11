import { motion } from './config'
import { gsap } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'

export function visibleCards(cards: Iterable<Element>) {
  if (typeof window === 'undefined') return [...cards]
  const limit = window.innerHeight + 120
  return [...cards].filter((card) => card.getBoundingClientRect().top < limit)
}

function settledCard() {
  return { autoAlpha: 1, y: 0, scale: 1, filter: 'none' }
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

export function comingSoonEnterVars() {
  const compact = isCompactMotion()
  const soon = motion.card.comingSoon
  return {
    from: {
      autoAlpha: 0,
      y: compact ? 10 : soon.y,
      scale: soon.scale,
      filter: `blur(${compact ? motion.blur.small : soon.blur}px)`,
    },
    to: {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: compact ? motion.duration.normal : soon.duration,
      stagger: { each: compact ? 0.02 : soon.stagger, from: 'start' as const },
      ease: motion.ease.enter,
      overwrite: 'auto' as const,
      clearProps: 'filter',
    },
  }
}

function playEnter(elements: Element[], from: object, to: object) {
  const visible = visibleCards(elements)
  const rest = elements.filter((element) => !visible.includes(element))
  if (visible.length) gsap.fromTo(visible, from, to)
  if (rest.length) gsap.set(rest, settledCard())
}

export function animateEnteringCards(elements: Iterable<Element>) {
  const list = [...elements]
  if (!list.length) return
  if (prefersReducedMotion()) {
    gsap.set(list, settledCard())
    return
  }
  const soon = list.filter((element) => element.querySelector('.tool-card.disabled'))
  const available = list.filter((element) => !soon.includes(element))
  if (available.length) {
    const enter = cardEnterVars()
    playEnter(available, enter.from, enter.to)
  }
  if (soon.length) {
    const vars = comingSoonEnterVars()
    playEnter(soon, vars.from, vars.to)
  }
}

export function revealCards(cards: Iterable<Element>) {
  animateEnteringCards(cards)
}

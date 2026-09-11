import { cardEnterVars } from './cards'
import { motion } from './config'
import { gsap, ScrollTrigger } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'

export function revealSectionOnce(section: Element | null, children?: string) {
  if (!section || prefersReducedMotion()) return
  const compact = isCompactMotion()
  const targets = children ? section.querySelectorAll(children) : [section]
  if (!targets.length) return
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: compact ? 16 : 28, filter: `blur(${compact ? 8 : 14}px)` },
    {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: compact ? motion.duration.normal : 0.6,
      stagger: compact ? 0.04 : 0.08,
      ease: motion.ease.enter,
      clearProps: 'filter',
      immediateRender: false,
      scrollTrigger: {
        trigger: section,
        start: 'top 82%',
        once: true,
      },
    },
  )
}

export function batchRevealCards(cards: Iterable<Element>) {
  const list = [...cards]
  if (!list.length) return
  if (prefersReducedMotion()) {
    gsap.set(list, { autoAlpha: 1, y: 0, scale: 1, filter: 'none' })
    return
  }
  const compact = isCompactMotion()
  const { from, to } = cardEnterVars()
  const fold = window.innerHeight + 40
  const above: Element[] = []
  const below: Element[] = []
  for (const card of list) {
    if (card.getBoundingClientRect().top < fold) above.push(card)
    else below.push(card)
  }
  if (above.length) gsap.fromTo(above, from, to)
  if (!below.length) return
  gsap.set(below, from)
  ScrollTrigger.batch(below, {
    interval: 0.12,
    batchMax: compact ? 6 : 8,
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: to.duration,
      stagger: compact ? 0.02 : motion.card.enter.stagger,
      ease: motion.ease.enter,
      overwrite: 'auto',
      clearProps: 'filter',
    }),
  })
}

export function refreshScroll() {
  if (typeof window === 'undefined') return
  ScrollTrigger.refresh()
}

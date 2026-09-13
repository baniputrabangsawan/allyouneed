import { animateEnteringCards } from './cards'
import { motion } from './config'
import { gsap, ScrollTrigger } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'
import { isRestoringNavigation } from './restore'

export function revealSectionOnce(section: Element | null, children?: string) {
  if (!section || prefersReducedMotion() || isRestoringNavigation()) return
  const compact = isCompactMotion()
  const targets = children ? section.querySelectorAll(children) : [section]
  if (!targets.length) return
  if (compact) gsap.set(targets, { autoAlpha: 0, y: 16, filter: 'blur(8px)' })
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
        start: compact ? 'top 62%' : 'top 82%',
        once: true,
      },
    },
  )
}

export function batchRevealCards(cards: Iterable<Element>) {
  animateEnteringCards(cards)
}

export function refreshScroll() {
  if (typeof window === 'undefined') return
  ScrollTrigger.refresh()
}

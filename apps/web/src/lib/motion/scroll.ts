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

export function refreshScroll() {
  if (typeof window === 'undefined') return
  ScrollTrigger.refresh()
}

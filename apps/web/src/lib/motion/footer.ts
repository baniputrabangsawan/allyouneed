import { motion } from './config'
import { gsap, ScrollTrigger } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'
import { isRestoringNavigation } from './restore'

export function revealFooter(root: Element | null) {
  if (!root || prefersReducedMotion() || isRestoringNavigation()) return

  const compact = isCompactMotion()
  const cta = root.querySelector('.footer-cta')
  const card = root.querySelector('.footer-card')
  const wordmark = root.querySelector('.footer-wordmark')
  const inner = [...root.querySelectorAll('.footer-brand, .footer-nav-group, .footer-legal')]
  const y = compact ? 16 : 30
  const duration = compact ? motion.duration.fast : 0.55

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: motion.ease.enter, overwrite: 'auto', immediateRender: false },
  })

  if (cta) {
    tl.fromTo(
      cta,
      { autoAlpha: 0, y, scale: 0.985, filter: `blur(${compact ? motion.blur.small : 10}px)` },
      { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration, clearProps: 'filter' },
    )
  }
  if (card) {
    tl.fromTo(
      card,
      { autoAlpha: 0, y: compact ? 18 : 34, scale: 0.98, filter: `blur(${compact ? motion.blur.small : 8}px)` },
      { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: compact ? 0.36 : 0.5, clearProps: 'filter' },
      compact ? '-=0.12' : '-=0.22',
    )
  }
  if (wordmark) {
    tl.fromTo(
      wordmark,
      { autoAlpha: 0, y },
      { autoAlpha: 1, y: 0, duration: compact ? 0.4 : 0.65 },
      compact ? '-=0.18' : '-=0.28',
    )
  }
  if (inner.length) {
    tl.fromTo(
      inner,
      { autoAlpha: 0, y: compact ? 8 : 12 },
      { autoAlpha: 1, y: 0, duration: compact ? 0.28 : 0.38, stagger: compact ? 0.04 : 0.06 },
      compact ? '-=0.16' : '-=0.22',
    )
  }

  ScrollTrigger.create({
    trigger: root,
    start: 'top 85%',
    once: true,
    onEnter: () => tl.play(),
  })

  return tl
}

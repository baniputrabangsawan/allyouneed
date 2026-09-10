import { motion } from './config'
import { gsap } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'

export function revealPage(root: Element | null) {
  if (!root || prefersReducedMotion()) return
  const compact = isCompactMotion()
  gsap.fromTo(
    root,
    { autoAlpha: 0, y: compact ? 12 : 20, filter: `blur(${compact ? motion.blur.small : motion.blur.medium}px)` },
    {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: compact ? motion.duration.normal : motion.duration.slow,
      ease: motion.ease.enter,
      clearProps: 'filter',
    },
  )
}

export function revealSequence(items: Array<Element | null>, extras?: { strongerFirst?: boolean }) {
  const nodes = items.filter((item): item is Element => Boolean(item))
  if (!nodes.length || prefersReducedMotion()) return
  const compact = isCompactMotion()
  const tl = gsap.timeline({ defaults: { ease: motion.ease.enter, overwrite: 'auto' } })
  nodes.forEach((node, index) => {
    const strong = Boolean(extras?.strongerFirst && index < 2)
    tl.fromTo(
      node,
      {
        autoAlpha: 0,
        y: compact ? 14 : strong ? 34 : 24,
        filter: `blur(${compact ? 8 : strong ? 16 : 12}px)`,
      },
      {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: compact ? 0.35 : strong ? 0.65 : 0.5,
        clearProps: 'filter',
      },
      index === 0 ? 0 : compact ? 0.05 : 0.08,
    )
  })
  return tl
}

export function clearMotionStyles(targets: Iterable<Element> | Element | null) {
  if (!targets) return
  gsap.set(targets, { clearProps: 'transform,filter,opacity,visibility' })
}

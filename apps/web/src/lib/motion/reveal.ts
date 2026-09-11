import { motion } from './config'
import { gsap } from './gsap'
import { isCompactMotion, prefersReducedMotion } from './prefers-reduced-motion'
import { isRestoringNavigation } from './restore'

export function revealPage(root: Element | null) {
  if (!root || prefersReducedMotion() || isRestoringNavigation()) return
  const compact = isCompactMotion()
  gsap.fromTo(
    root,
    { autoAlpha: 0, y: compact ? 12 : 16, filter: `blur(${compact ? motion.blur.small : 8}px)` },
    {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: compact ? motion.duration.fast : 0.5,
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
    const search = node.classList.contains('search-box')
    tl.fromTo(
      node,
      {
        autoAlpha: 0,
        y: compact ? 12 : strong ? 28 : search ? 18 : 16,
        scale: search ? 0.98 : strong ? 0.985 : 1,
        filter: `blur(${compact ? 6 : strong ? 14 : search ? 8 : 8}px)`,
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: compact ? 0.32 : strong ? 0.55 : 0.42,
        clearProps: 'filter',
      },
      index === 0 ? 0 : compact ? 0.04 : index < 2 ? 0.1 : 0.08,
    )
  })
  return tl
}

export function clearMotionStyles(targets: Iterable<Element> | Element | null) {
  if (!targets) return
  gsap.set(targets, { clearProps: 'transform,filter,opacity,visibility' })
}

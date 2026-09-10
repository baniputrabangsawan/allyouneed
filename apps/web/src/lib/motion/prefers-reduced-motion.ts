export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isCompactMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

export function motionScale() {
  if (prefersReducedMotion()) return 0
  return isCompactMotion() ? 0.65 : 1
}

export const motion = {
  duration: {
    instant: 0.18,
    fast: 0.28,
    normal: 0.45,
    slow: 0.7,
    cinematic: 1.0,
  },
  ease: {
    standard: 'power2.out',
    enter: 'power3.out',
    exit: 'power2.in',
    emphasized: 'power4.out',
    layout: 'power2.inOut',
  },
  blur: {
    small: 6,
    medium: 12,
    large: 18,
  },
  card: {
    enter: { y: 28, scale: 0.96, blur: 14, duration: 0.55, stagger: 0.035 },
    exit: { y: -8, scale: 0.94, blur: 10, duration: 0.22 },
    hoverY: -4,
    hoverScale: 1.01,
  },
} as const

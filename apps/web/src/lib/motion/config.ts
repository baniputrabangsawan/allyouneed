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
    layout: 'power3.inOut',
  },
  blur: {
    small: 6,
    medium: 12,
    large: 18,
  },
  card: {
    enter: { y: 20, scale: 0.965, blur: 10, duration: 0.45, stagger: 0.035 },
    exit: { y: -8, scale: 0.95, blur: 8, duration: 0.22 },
    comingSoon: { y: 14, scale: 0.985, blur: 6, duration: 0.45, stagger: 0.025 },
    hoverY: -4,
    hoverScale: 1.01,
  },
} as const

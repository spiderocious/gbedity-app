export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EASE_SPRING = 'back.out(1.6)';
export const EASE_OUT = 'power3.out';

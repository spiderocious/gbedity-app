// Shared motion helpers for the Missing Letters slice. Kept local so the slice has zero dependency
// on the old in-game flow primitives. Respects prefers-reduced-motion everywhere.

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Spring-ish overshoot ease for the "slide bounces in" feel (branding: ease-spring).
export const EASE_SPRING = 'back.out(1.6)';
export const EASE_OUT = 'power3.out';

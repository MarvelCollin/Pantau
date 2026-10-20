export function prefersReducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

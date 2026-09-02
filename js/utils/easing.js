export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Overshoots past 1 before settling — deliberately NOT clamped here, so a
// caller animating transform (scale/rotate) off it gets a visible "pop"
// past its resting size; clamp the result yourself first if you need it
// for something that can't exceed 1, like opacity or a counted-up number.
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

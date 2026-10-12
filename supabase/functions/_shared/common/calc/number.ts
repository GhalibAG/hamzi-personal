/** Pembulatan half-up 2 desimal (PRD §7.1). 3,5625 → 3,56; 3,565 → 3,57. */
export function roundHalfUp2(x: number): number {
  return Math.round(x * 100 + 1e-9) / 100;
}

/** Pembulatan ke atas 2 desimal untuk nilai minimal yang dibutuhkan. 3,8176 → 3,82. */
export function ceil2(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

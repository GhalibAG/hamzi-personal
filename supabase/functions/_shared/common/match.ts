/** Normalisasi nama untuk pencocokan (case-insensitive, spasi rapat, tanpa tanda baca ringan). */
export function normName(s: string): string {
  return s.toLowerCase().replace(/[&]/g, 'dan').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/** Cari nama yang cocok; urutan: persis → awalan → mengandung. */
export function matchName<T extends { name: string }>(input: string, candidates: T[]): T | null {
  const q = normName(input);
  if (!q) return null;
  return (
    candidates.find((c) => normName(c.name) === q) ??
    candidates.find((c) => normName(c.name).startsWith(q) || q.startsWith(normName(c.name))) ??
    candidates.find((c) => normName(c.name).includes(q) || q.includes(normName(c.name))) ??
    null
  );
}

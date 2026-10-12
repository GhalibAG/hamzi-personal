// Pemeriksaan grounding angka untuk ringkasan AI (TECH-SPEC §7.5).

function normalizeNumber(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  let mult = 1;
  if (/(jt|juta)$/.test(s)) { mult = 1_000_000; s = s.replace(/\s*(jt|juta)$/, ''); }
  else if (/(rb|ribu|k)$/.test(s)) { mult = 1000; s = s.replace(/\s*(rb|ribu|k)$/, ''); }
  s = s.replace(/^rp\s*/, '').replace('%', '');
  // "85.000" → 85000 ; "3,5" → 3.5
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

/** Ambil semua angka dari teks. */
export function extractNumbers(text: string): number[] {
  const re = /(?:rp\s*)?\d+(?:[.,]\d+)*\s*(?:%|jt|juta|rb|ribu|k)?/gi;
  const out: number[] = [];
  for (const m of text.match(re) ?? []) {
    const n = normalizeNumber(m);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Kumpulkan angka dari payload JSON secara rekursif. */
export function collectNumbers(payload: unknown, acc: number[] = []): number[] {
  if (typeof payload === 'number') acc.push(payload);
  else if (typeof payload === 'string') acc.push(...extractNumbers(payload));
  else if (Array.isArray(payload)) payload.forEach((x) => collectNumbers(x, acc));
  else if (payload && typeof payload === 'object') Object.values(payload).forEach((x) => collectNumbers(x, acc));
  return acc;
}

/** Lulus bila setiap angka di teks ada di payload (angka kecil 0–10 diabaikan, umum dipakai di kalimat). */
export function groundingCheck(text: string, payload: unknown): { ok: boolean; foreign: number[] } {
  const allowed = collectNumbers(payload);
  const has = (n: number) => allowed.some((a) => Math.abs(a - n) < 0.0001 || Math.abs(a - n) / Math.max(1, Math.abs(a)) < 0.005);
  const foreign = extractNumbers(text).filter((n) => !(n >= 0 && n <= 10 && Number.isInteger(n)) && !has(n));
  return { ok: foreign.length === 0, foreign };
}

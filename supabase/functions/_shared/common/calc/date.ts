// Util tanggal murni (tanpa DOM/Deno). Semua "hari" memakai string 'YYYY-MM-DD' kalender WIB.
export const WIB_OFFSET_MIN = 7 * 60;

export type DateStr = string; // 'YYYY-MM-DD'

/** Tanggal WIB untuk sebuah instan (default: sekarang). */
export function wibDate(at: Date = new Date()): DateStr {
  return new Date(at.getTime() + WIB_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Jam WIB 'HH:MM' untuk sebuah instan. */
export function wibTime(at: Date = new Date()): string {
  return new Date(at.getTime() + WIB_OFFSET_MIN * 60_000).toISOString().slice(11, 16);
}

/** Menit sejak tengah malam WIB. */
export function wibMinutes(at: Date = new Date()): number {
  const t = wibTime(at);
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

function toUtc(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromParts(y: number, m: number, d: number): DateStr {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

export function addDays(d: DateStr, n: number): DateStr {
  return new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Selisih hari b − a (bilangan bulat). */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Hari ISO: 1 = Senin … 7 = Minggu. */
export function isoWeekday(d: DateStr): number {
  const w = new Date(toUtc(d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Senin pada minggu tanggal d. */
export function weekStart(d: DateStr): DateStr {
  return addDays(d, 1 - isoWeekday(d));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Instan UTC dari tanggal WIB + jam WIB. */
export function wibToInstant(d: DateStr, hhmm = '00:00'): Date {
  return new Date(toUtc(d) + parseHHMM(hhmm) * 60_000 - WIB_OFFSET_MIN * 60_000);
}

import { parseHHMM } from './date.ts';

export const SYSTEM_NOTIF_MAX_PER_DAY = 6;

/** Apakah menit m berada di jam tenang [start, end) yang boleh melewati tengah malam. */
export function inQuietHours(hhmm: string, quietStart = '23:00', quietEnd = '05:00'): boolean {
  const m = parseHHMM(hhmm);
  const s = parseHHMM(quietStart);
  const e = parseHHMM(quietEnd);
  return s <= e ? m >= s && m < e : m >= s || m < e;
}

/** Pengingat sistem patuh jam tenang; pengingat buatan pengguna selalu dikirim (PRD NOT-06). */
export function shouldSendNow(category: 'user' | 'system', hhmm: string, quietStart = '23:00', quietEnd = '05:00'): boolean {
  if (category === 'user') return true;
  return !inQuietHours(hhmm, quietStart, quietEnd);
}

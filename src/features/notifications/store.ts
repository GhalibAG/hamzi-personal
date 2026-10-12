// Simpanan lokal mesin pengingat: penundaan ("Tunda") dan catatan pengingat yang sudah ditampilkan perangkat ini
// (mode Supabase tidak membuat baris notifikasi dari klien; catatan ini mencegah tampil ulang tiap 30 detik).
import { readLocal, writeLocal } from '@/lib/storage';
import { snoozeKey, type NotifCategory, type Reminder, type SentLog, type Snooze } from './schedule';

const SNOOZE_KEY = 'hamzi-reminder-snoozes';
const FIRED_KEY = 'hamzi-reminders-fired';
const KEEP_MS = 3 * 86_400_000;

interface FiredEntry { key: string; category: NotifCategory; at: string }

export function readSnoozes(): Snooze[] {
  const list = readLocal<Snooze[]>(SNOOZE_KEY, []);
  return Array.isArray(list) ? list.filter((s) => s && typeof s.key === 'string' && s.base) : [];
}

/** Tunda pengingat `minutes` menit dari sekarang. Mengembalikan entri penundaan. */
export function addSnooze(base: Reminder, action: string, minutes: number, now = new Date()): Snooze {
  const fireAt = new Date(now.getTime() + minutes * 60_000);
  const entry: Snooze = { key: snoozeKey(base, action, fireAt), fire_at: fireAt.toISOString(), base };
  const rest = readSnoozes().filter((s) => s.key !== entry.key);
  writeLocal(SNOOZE_KEY, [...rest, entry]);
  return entry;
}

export function removeSnoozes(keys: string[]) {
  if (!keys.length) return;
  const drop = new Set(keys);
  writeLocal(SNOOZE_KEY, readSnoozes().filter((s) => !drop.has(s.key)));
}

export function readFired(now = new Date()): SentLog[] {
  const list = readLocal<FiredEntry[]>(FIRED_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && now.getTime() - new Date(e.at).getTime() < KEEP_MS)
    .map((e) => ({ dedupe_key: e.key, category: e.category, status: 'sent', sent_at: e.at }));
}

export function markFired(items: Pick<Reminder, 'dedupe_key' | 'category'>[], now = new Date()) {
  if (!items.length) return;
  const keep = readLocal<FiredEntry[]>(FIRED_KEY, []).filter((e) => e && now.getTime() - new Date(e.at).getTime() < KEEP_MS);
  const at = now.toISOString();
  writeLocal(FIRED_KEY, [...keep, ...items.map((i) => ({ key: i.dedupe_key, category: i.category, at }))]);
}

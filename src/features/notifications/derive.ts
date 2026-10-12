// Turunan kotak notifikasi: waktu relatif & pengelompokan hari (WIB).
import { addDays, diffDays, isoWeekday, wibDate, wibTime } from '@common/calc/index.ts';
import { BULAN_PENDEK, HARI } from '@common/format.ts';
import type { ScheduledNotification } from '@/data/types';

/** "baru saja", "5 mnt lalu", "2 jam lalu", "kemarin 19:00", "Sabtu 19:00", "3 Okt 19:00". */
export function relTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  const day = wibDate(at);
  const today = wibDate(now);
  const time = wibTime(at);
  if (day === today) {
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins} mnt lalu`;
    return `${Math.floor(mins / 60)} jam lalu`;
  }
  if (day === addDays(today, -1)) return `kemarin ${time}`;
  if (diffDays(day, today) < 7) return `${HARI[isoWeekday(day)]} ${time}`;
  return `${Number(day.slice(8, 10))} ${BULAN_PENDEK[Number(day.slice(5, 7))]} ${time}`;
}

export type NotifGroup = 'Hari ini' | 'Kemarin' | 'Sebelumnya';

/** Notifikasi terkirim 14 hari terakhir, terbaru dulu, dikelompokkan Hari ini / Kemarin / Sebelumnya. */
export function inboxGroups(rows: ScheduledNotification[], now: Date, days = 14): { label: NotifGroup; items: ScheduledNotification[] }[] {
  const today = wibDate(now);
  const from = now.getTime() - days * 86_400_000;
  const sent = rows
    .filter((n) => n.status === 'sent' && new Date(n.sent_at ?? n.fire_at).getTime() >= from)
    .sort((a, b) => (b.sent_at ?? b.fire_at).localeCompare(a.sent_at ?? a.fire_at));
  const groups: { label: NotifGroup; items: ScheduledNotification[] }[] = [
    { label: 'Hari ini', items: [] }, { label: 'Kemarin', items: [] }, { label: 'Sebelumnya', items: [] },
  ];
  for (const n of sent) {
    const d = wibDate(new Date(n.sent_at ?? n.fire_at));
    groups[d === today ? 0 : d === addDays(today, -1) ? 1 : 2].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

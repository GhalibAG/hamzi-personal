// Mesin pengingat dalam app (NOT-01..08). Dipasang global oleh AppShell.
// - MODE DEMO: satu-satunya penjadwal → setiap pengingat yang jatuh tempo dicatat sebagai baris `scheduled_notifications`
//   (status 'sent') lalu ditampilkan.
// - MODE SUPABASE: baris dibuat server (scheduler-tick); mesin ini hanya cadangan saat app terbuka → tampilkan pengingat
//   yang dedupe_key-nya belum ada di server (tanpa menulis baris).
// Tampil sebagai notifikasi sistem bila izin diberikan, selain itu banner dalam app. Juga menangani `?notif_action=` dari SW.
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { wibDate } from '@common/calc/index.ts';
import { DEMO } from '@/data';
import { showLocalNotification } from '@/data/local-functions';
import { useUpsert } from '@/data/hooks';
import type { ScheduledNotification } from '@/data/types';
import { useBannerQueue } from './banner';
import { ReminderBanner } from './components/ReminderBanner';
import { rowToReminder, useNotifActions, useReminderData } from './hooks';
import { notifPermission } from './push';
import { planReminders, type Reminder, type ReminderData, type SentLog } from './schedule';
import { markFired, readFired, readSnoozes, removeSnoozes } from './store';

const TICK_MS = 30_000;
/** Jeda pertama setelah app dibuka (biarkan layar selesai dimuat dulu). */
const FIRST_TICK_MS = 4_000;

/** URL untuk notifikasi lokal: sertakan `kind` agar aksi dari SW (mode demo) tahu jenisnya. */
function localUrl(r: Reminder): string {
  if (/[?&]kind=/.test(r.url)) return r.url;
  return `${r.url}${r.url.includes('?') ? '&' : '?'}kind=${encodeURIComponent(r.kind)}`;
}

/** Cari pengingat untuk `?notif_action=&kind=&ref=` (baris terbaru yang cocok, atau dibangun dari data). */
function resolveFromUrl(kind: string, ref: string | null, action: string, notifs: ScheduledNotification[], data: ReminderData): Reminder | null {
  const sorted = [...notifs].sort((a, b) => (b.sent_at ?? b.fire_at).localeCompare(a.sent_at ?? a.fire_at));
  const row = sorted.find((n) => (!kind || n.kind === kind) && (!ref || n.ref_id === ref))
    ?? (!ref ? sorted.find((n) => (n.actions ?? []).some((a) => a.action === action)) : undefined);
  if (row) {
    const r = rowToReminder(row, data);
    return ref && !r.ref_id ? { ...r, ref_id: ref } : r;
  }
  if (!ref) return null;
  const now = new Date().toISOString();
  const today = wibDate();
  const base = { category: 'user' as const, system_key: null, fire_at: now, actions: [] };
  if (kind === 'routine') {
    const x = data.routines.find((r) => r.id === ref);
    if (x) return { ...base, dedupe_key: `routine:${ref}:${today}`, kind, ref_type: 'routine', ref_id: ref, title: x.name, body: '', url: `/tumbuh?ref=${ref}` };
  }
  if (kind === 'task') {
    const x = data.tasks.find((t) => t.id === ref);
    if (x) return { ...base, dedupe_key: `task:${ref}:url:${now}`, kind, ref_type: 'task', ref_id: ref, title: x.title, body: '', url: `/rencana?ref=${ref}` };
  }
  if (kind === 'module') {
    const x = data.modules.find((m) => m.id === ref);
    if (x) return { ...base, dedupe_key: `module:${ref}:${today}`, kind, ref_type: 'module', ref_id: ref, title: x.title, body: '', url: `/tumbuh/sesi?modul=${ref}` };
  }
  if (kind === 'class') {
    return { ...base, category: 'system', system_key: 'class', dedupe_key: `class:${ref}:${today}`, kind, ref_type: 'course_schedule', ref_id: ref, title: 'Kelas', body: '', url: '/kuliah' };
  }
  return null;
}

export function ReminderEngine() {
  const { data, ready, notifs, settings, profile } = useReminderData();
  const upsert = useUpsert('scheduled_notifications');
  const run = useNotifActions(data, notifs);
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const queue = useBannerQueue((s) => s.queue);
  const shift = useBannerQueue((s) => s.shift);

  // Nilai terbaru untuk callback interval (tanpa memasang ulang timer).
  const latest = useRef({ data, ready, notifs, settings, profile, upsert });
  useEffect(() => { latest.current = { data, ready, notifs, settings, profile, upsert }; });
  const busy = useRef(false);

  const tick = useCallback(async () => {
    const s = latest.current;
    if (!s.ready || !s.settings || busy.current) return;
    busy.current = true;
    try {
      const now = new Date();
      // Baris server/demo + catatan lokal perangkat ini (unik per dedupe_key agar batas harian tidak terhitung ganda).
      const byKey = new Map<string, SentLog>();
      for (const n of s.notifs) byKey.set(n.dedupe_key, { dedupe_key: n.dedupe_key, category: n.category, status: n.status, sent_at: n.sent_at ?? null });
      for (const f of readFired(now)) if (!byKey.has(f.dedupe_key)) byKey.set(f.dedupe_key, f);
      const sent = [...byKey.values()];
      const plan = planReminders({
        now, data: s.data, settings: s.settings, sent, snoozes: readSnoozes(), backupRef: s.profile?.onboarded_at ?? null,
      });
      const snoozeDone = plan.skipped.filter((x) => x.reason === 'stale').map((x) => x.reminder.dedupe_key);
      removeSnoozes([...snoozeDone, ...plan.fire.filter((f) => f.dedupe_key.startsWith('snooze:')).map((f) => f.dedupe_key)]);
      if (!plan.fire.length) return;
      markFired(plan.fire, now);
      if (DEMO) {
        const stamp = now.toISOString();
        await s.upsert.save(plan.fire.map((r) => ({
          category: r.category, kind: r.kind, ref_type: r.ref_type, ref_id: r.ref_id, dedupe_key: r.dedupe_key, fire_at: r.fire_at,
          title: r.title, body: r.body, url: r.url, actions: r.actions, status: 'sent' as const, attempts: 1, sent_at: stamp, read_at: null,
        }))).catch(() => undefined);
      }
      const banner: Reminder[] = [];
      const granted = notifPermission() === 'granted';
      for (const r of plan.fire) {
        const shown = granted && (await showLocalNotification(r.title, r.body, localUrl(r), r.actions));
        if (!shown) banner.push(r);
      }
      if (banner.length) useBannerQueue.getState().push(banner);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void tick(), FIRST_TICK_MS);
    const id = window.setInterval(() => void tick(), TICK_MS);
    const vis = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearTimeout(first); window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [tick]);

  // Aksi dari klik notifikasi SW (mode demo / tanpa token): ?notif_action=done&kind=routine&ref=<id>
  const handled = useRef<string | null>(null);
  const action = params.get('notif_action');
  useEffect(() => {
    if (!action || !ready) return;
    const sig = `${loc.key}|${params.toString()}`;
    if (handled.current === sig) return;
    handled.current = sig;
    const kind = params.getAll('kind').find(Boolean) ?? '';
    const ref = params.get('ref') ?? params.get('modul');
    const target = resolveFromUrl(kind, ref, action, notifs, data);
    const next = new URLSearchParams(params);
    for (const k of ['notif_action', 'kind', 'ref']) next.delete(k);
    // Tunda modul jangan sampai membuka layar timer.
    if (target?.kind === 'module' && action !== 'start') nav('/tumbuh', { replace: true });
    else setParams(next, { replace: true });
    if (target) void run(target, action);
  }, [action, ready, loc.key, params, setParams, nav, notifs, data, run]);

  const current = queue[0];
  if (!current) return null;
  const next = shift;
  return (
    <ReminderBanner
      key={current.dedupe_key}
      item={current}
      queued={queue.length - 1}
      onClose={next}
      onOpen={() => { next(); void run(current, 'open'); }}
      onAction={(a) => { next(); void run(current, a); }}
    />
  );
}

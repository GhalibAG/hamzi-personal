// push-test — tombol "Coba pengingat" (TECH-SPEC §6.3). JWT; berjalan sebagai pengguna (RLS), tanpa service role.
// Kirim push uji ke semua subscription pengguna: kind 'test', judul = rutinitas pertama yang belum selesai hari ini
// atau "Waktunya belajar 25 menit", aksi done/snooze10.
import { wibDate } from '../_shared/common/calc/date.ts';
import { isRoutineDue } from '../_shared/common/calc/growth.ts';
import { NOTIF_ACTIONS, notifBody } from '../_shared/common/notif-lines.id.ts';
import { corsHeaders, json, logEvent, originRejected, preflight } from '../_shared/cors.ts';
import { env, requireUser, rpc } from '../_shared/supabase.ts';
import { signToken } from '../_shared/hmac.ts';
import { sendToAll, type PushSub } from '../_shared/push.ts';

interface RoutineRow { id: string; name: string; repeat_days: number[]; remind_at: string | null; sort: number }

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
  if (originRejected(req)) return json({ ok: false, error: 'origin' }, 403, cors);
  const auth = await requireUser(req);
  if (!auth) return json({ ok: false, error: 'unauthorized' }, 401, cors);
  const { client: db, uid } = auth;

  try {
    const today = wibDate();
    const { data: subsData } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth');
    const subs = (subsData ?? []) as PushSub[];
    if (!subs.length) return json({ ok: false, sent: 0, reason: 'Belum ada perangkat yang berlangganan pengingat.' }, 200, cors);

    const { data: rs } = await db.from('routines').select('id, name, repeat_days, remind_at, sort')
      .is('deleted_at', null).eq('archived', false).order('remind_at', { ascending: true, nullsFirst: false }).order('sort');
    const { data: logs } = await db.from('routine_logs').select('routine_id').eq('log_date', today).eq('done', true);
    const doneSet = new Set(((logs ?? []) as { routine_id: string }[]).map((l) => l.routine_id));
    const pending = ((rs ?? []) as RoutineRow[]).find((r) => isRoutineDue(r.repeat_days, today) && !doneSet.has(r.id)) ?? null;

    const title = pending?.name ?? 'Waktunya belajar 25 menit';
    const body = notifBody('test');
    const nid = await rpc<string>(db, 'rpc_log_test_notification', { p_title: title, p_body: body, p_ref_id: pending?.id ?? null });
    const token = await signToken({ nid, uid, kind: 'test', ref_id: pending?.id ?? null, day: today }, env('NOTIF_ACTION_SECRET'));
    const r = await sendToAll(subs, { title, body, url: '/tumbuh', tag: nid, kind: 'test', token, actions: NOTIF_ACTIONS.test });
    if (r.gone.length) await db.from('push_subscriptions').delete().in('id', r.gone);
    logEvent('push-test', { subs: subs.length, sent: r.sent, gone: r.gone.length });
    return json({
      ok: r.sent > 0, sent: r.sent, title, body,
      reason: r.sent > 0 ? null : 'Push gagal terkirim. Coba aktifkan ulang pengingat di Pengaturan > Notifikasi.',
    }, 200, cors);
  } catch (e) {
    logEvent('push-test', { error: e instanceof Error ? e.message.slice(0, 60) : 'error' });
    return json({ ok: false, sent: 0, reason: 'Server belum bisa mengirim push.' }, 500, cors);
  }
});

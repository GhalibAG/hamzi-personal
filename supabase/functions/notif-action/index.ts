// notif-action — tombol aksi notifikasi dari service worker (TECH-SPEC §6.2). verify_jwt = false.
// Body { token, action }; token HMAC (NOTIF_ACTION_SECRET) 24 jam. Service role memanggil fn_*_for(uid dari token).
// Respons { ok, message } — ditampilkan SW sebagai notifikasi konfirmasi singkat (tanpa emoji).
import { z } from 'zod';
import { wibDate } from '../_shared/common/calc/date.ts';
import { corsHeaders, json, logEvent, preflight } from '../_shared/cors.ts';
import { env, rpc, serviceClient } from '../_shared/supabase.ts';
import { verifyToken } from '../_shared/hmac.ts';

const Body = z.object({
  token: z.string().min(10).max(2048),
  action: z.enum(['done', 'snooze10', 'snooze60', 'attend']),
});

// Dipanggil dari service worker (origin aplikasi) → CORS terbuka; keamanan dari token HMAC.
const OPEN = { anyOrigin: true };

Deno.serve(async (req) => {
  const pre = preflight(req, OPEN);
  if (pre) return pre;
  const cors = corsHeaders(req, OPEN);
  if (req.method !== 'POST') return json({ ok: false, message: 'Metode tidak didukung.' }, 405, cors);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ ok: false, message: 'Permintaan tidak valid.' }, 400, cors);
  }
  const t = await verifyToken(body.token, env('NOTIF_ACTION_SECRET'));
  if (!t) return json({ ok: false, message: 'Aksi sudah kedaluwarsa. Buka Hamzi untuk melanjutkan.' }, 401, cors);

  const db = serviceClient();
  const day = t.day ?? wibDate();
  let message = 'Tercatat.';
  try {
    switch (body.action) {
      case 'done': {
        if ((t.kind === 'routine' || t.kind === 'test') && t.ref_id) {
          const { data: r } = await db.from('routines').select('target_count').eq('id', t.ref_id).eq('user_id', t.uid).is('deleted_at', null).maybeSingle();
          if (!r) { message = 'Rutinitas ini sudah tidak ada.'; break; }
          const { data: log } = await db.from('routine_logs').select('done').eq('routine_id', t.ref_id).eq('log_date', day).maybeSingle();
          if (log?.done) { message = 'Sudah tercatat sebelumnya.'; break; }
          await rpc(db, 'fn_routine_set_for', { p_uid: t.uid, p_routine_id: t.ref_id, p_date: day, p_value: (r as { target_count: number }).target_count });
          message = 'Tercatat. +1 tetes air';
        } else if (t.kind === 'task' && t.ref_id) {
          const res = await rpc<{ water_awarded?: boolean }>(db, 'fn_task_set_done_for', { p_uid: t.uid, p_task_id: t.ref_id, p_done: true });
          message = res?.water_awarded ? 'Tercatat. +1 tetes air' : 'Tercatat. Tugas selesai.';
        } else if (t.kind === 'test') {
          message = 'Tercatat. Ini cuma uji pengingat.';
        } else {
          message = 'Aksi ini tidak tersedia untuk pengingat ini.';
        }
        break;
      }
      case 'snooze10':
      case 'snooze60': {
        const mins = body.action === 'snooze10' ? 10 : 60;
        const { data: n } = await db.from('scheduled_notifications')
          .select('category, kind, ref_type, ref_id, ref_day, title, body, url, actions')
          .eq('id', t.nid).eq('user_id', t.uid).maybeSingle();
        if (!n) { message = 'Pengingat ini sudah tidak ada.'; break; }
        // tenggat tugas TIDAK diubah; salinan idempoten (dedupe 'snooze:{nid}:{aksi}')
        const { error } = await db.from('scheduled_notifications').upsert({
          ...n, user_id: t.uid, dedupe_key: `snooze:${t.nid}:${body.action}`,
          fire_at: new Date(Date.now() + mins * 60_000).toISOString(), status: 'pending',
        }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
        if (error) throw new Error('snooze');
        message = mins === 10 ? 'Oke, diingatkan lagi 10 menit lagi' : 'Oke, diingatkan lagi 1 jam lagi';
        break;
      }
      case 'attend': {
        if (t.kind !== 'class' || !t.ref_id) { message = 'Aksi ini tidak tersedia untuk pengingat ini.'; break; }
        const { data: cs } = await db.from('course_schedules').select('course_id').eq('id', t.ref_id).eq('user_id', t.uid).maybeSingle();
        if (!cs) { message = 'Jadwal kelas ini sudah tidak ada.'; break; }
        await rpc(db, 'fn_attendance_mark_for', { p_uid: t.uid, p_course_id: (cs as { course_id: string }).course_id, p_date: day, p_status: 'hadir' });
        message = 'Tercatat hadir.';
        break;
      }
    }
    await db.from('scheduled_notifications').update({ read_at: new Date().toISOString() })
      .eq('id', t.nid).eq('user_id', t.uid).is('read_at', null);
    logEvent('notif-action', { action: body.action, kind: t.kind, ok: true });
    return json({ ok: true, message }, 200, cors);
  } catch (e) {
    logEvent('notif-action', { action: body.action, kind: t.kind, ok: false, error: e instanceof Error ? e.message.slice(0, 60) : 'error' });
    return json({ ok: false, message: 'Belum berhasil. Buka Hamzi untuk menandai.' }, 500, cors);
  }
});

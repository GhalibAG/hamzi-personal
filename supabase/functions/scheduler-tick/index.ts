// scheduler-tick — dipanggil Cloudflare Worker tiap menit (TECH-SPEC §6.1). verify_jwt = false; wajib x-cron-secret.
// 1. enqueue (fn_enqueue_notifications) → 2. dispatch (Web Push + token HMAC per notifikasi)
// 3. job harian sekali/hari (fn_daily_maintenance: transaksi berulang + purge; file chat > 7 hari via Storage API)
// 4. → { enqueued, sent, skipped, failed, daily }
import { wibDate } from '../_shared/common/calc/date.ts';
import { json, logEvent } from '../_shared/cors.ts';
import { env, rpc, serviceClient } from '../_shared/supabase.ts';
import { safeEqual, signToken } from '../_shared/hmac.ts';
import { sendToAll, type PushSub } from '../_shared/push.ts';

interface Candidate {
  id: string;
  user_id: string;
  category: 'user' | 'system';
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  ref_day: string | null;
  dedupe_key: string;
  title: string;
  body: string;
  url: string;
  actions: { action: string; title: string }[];
  attempts: number;
  fire_at: string;
  subscriptions: PushSub[];
}

const CONCURRENCY = 6;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret || !(await safeEqual(req.headers.get('x-cron-secret') ?? '', secret))) return json({ error: 'unauthorized' }, 401);

  const started = Date.now();
  const now = new Date();
  const pNow = now.toISOString();
  const db = serviceClient();
  let enqueued = 0, sent = 0, skipped = 0, failed = 0;
  let daily: Record<string, unknown> | null = null;

  try {
    enqueued = await rpc<number>(db, 'fn_enqueue_notifications', { p_now: pNow });
    skipped = await rpc<number>(db, 'fn_skip_irrelevant', { p_now: pNow });
    const cands = (await rpc<Candidate[]>(db, 'fn_dispatch_candidates', { p_now: pNow })) ?? [];
    const actionSecret = env('NOTIF_ACTION_SECRET');
    const gone = new Set<string>();

    const handle = async (c: Candidate) => {
      const subs = (c.subscriptions ?? []).filter((s) => !gone.has(s.id ?? ''));
      if (!subs.length) {
        // tanpa perangkat: tetap tercatat di kotak notifikasi /notifikasi
        await rpc(db, 'fn_mark_notification', { p_id: c.id, p_status: 'sent' });
        sent++;
        return;
      }
      const token = await signToken({ nid: c.id, uid: c.user_id, kind: c.kind, ref_id: c.ref_id, day: c.ref_day ?? wibDate(now) }, actionSecret);
      const r = await sendToAll(subs, {
        title: c.title, body: c.body, url: c.url, kind: c.kind, token, actions: c.actions ?? [],
        tag: c.ref_id ? `${c.kind}:${c.ref_id}` : c.id,
      });
      r.gone.forEach((id) => gone.add(id));
      if (r.sent > 0) {
        await rpc(db, 'fn_mark_notification', { p_id: c.id, p_status: 'sent' });
        sent++;
      } else {
        const st = await rpc<string>(db, 'fn_mark_notification', { p_id: c.id, p_status: 'failed' });
        if (st === 'failed') failed++;
      }
    };
    for (let i = 0; i < cands.length; i += CONCURRENCY) {
      const batch = cands.slice(i, i + CONCURRENCY);
      const res = await Promise.allSettled(batch.map(handle));
      for (const [j, x] of res.entries()) {
        if (x.status === 'rejected') {
          failed++;
          await rpc(db, 'fn_mark_notification', { p_id: batch[j].id, p_status: 'failed' }).catch(() => undefined);
        }
      }
    }
    if (gone.size) await db.from('push_subscriptions').delete().in('id', [...gone]);

    // 3. job harian (idempoten lewat job_runs)
    const d = await rpc<Record<string, unknown> | null>(db, 'fn_daily_maintenance', { p_now: pNow });
    if (d) {
      const files = Array.isArray(d.old_chat_files) ? (d.old_chat_files as string[]) : [];
      let removed = 0;
      for (let i = 0; i < files.length; i += 100) {
        const { data } = await db.storage.from('chat-uploads').remove(files.slice(i, i + 100));
        removed += data?.length ?? 0;
      }
      daily = { day: d.day, recurring: d.recurring, purged_rows: d.purged_rows, purged_messages: d.purged_messages, removed_files: removed };
    }

    logEvent('scheduler-tick', { enqueued, sent, skipped, failed, gone: gone.size, daily: !!daily, ms: Date.now() - started });
    return json({ enqueued, sent, skipped, failed, daily });
  } catch (e) {
    logEvent('scheduler-tick', { error: e instanceof Error ? e.message.slice(0, 80) : 'error', enqueued, sent });
    return json({ error: 'server', enqueued, sent, skipped, failed }, 500);
  }
});

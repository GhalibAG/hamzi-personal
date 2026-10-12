// Web Push (VAPID) — TECH-SPEC §8.3/§8.4: TTL 3600, urgency high; subscription 404/410 dihapus pemanggil.
// [verifikasi] web-push lewat npm specifier di runtime Supabase Edge.
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push';
import { env } from './supabase.ts';

export interface PushSub {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: string;
  token?: string;
  actions: { action: string; title: string }[];
}

export interface SendResult {
  ok: boolean;
  gone: boolean;
  status?: number;
}

let configured = false;
function configure(): void {
  if (configured) return;
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  configured = true;
}

/** Batasi payload ≤ 3 KB (tanpa nominal — isi berasal dari scheduled_notifications). */
export function clampPayload(p: PushPayload): PushPayload {
  return {
    ...p,
    title: p.title.slice(0, 120),
    body: p.body.slice(0, 240),
    url: p.url.startsWith('/') ? p.url.slice(0, 300) : '/',
    actions: p.actions.slice(0, 2),
  };
}

export async function sendPush(sub: PushSub, payload: PushPayload): Promise<SendResult> {
  configure();
  try {
    const r = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(clampPayload(payload)),
      { TTL: 3600, urgency: 'high' },
    );
    return { ok: true, gone: false, status: r.statusCode };
  } catch (e) {
    const status = typeof e === 'object' && e !== null && 'statusCode' in e ? Number((e as { statusCode: unknown }).statusCode) : undefined;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
}

/** Kirim ke semua subscription pengguna. Mengembalikan jumlah sukses dan id subscription yang sudah mati. */
export async function sendToAll(subs: PushSub[], payload: PushPayload): Promise<{ sent: number; failed: number; gone: string[] }> {
  const results = await Promise.all(subs.map((s) => sendPush(s, payload)));
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.ok) sent++;
    else failed++;
    const id = subs[i].id;
    if (r.gone && id) gone.push(id);
  });
  return { sent, failed, gone };
}

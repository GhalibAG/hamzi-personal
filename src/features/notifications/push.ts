// Izin notifikasi & langganan Web Push (TECH-SPEC §8.1). Hanya dipanggil setelah gestur pengguna.
import { DEMO, repo } from '@/data';

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifPermission(): PermissionState {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as PermissionState;
}

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Minta izin lalu (mode Supabase + VAPID ada) berlangganan push dan simpan ke push_subscriptions.
 * Mode demo: cukup izin → pengingat lokal tampil selama app/tab terbuka (ReminderEngine).
 */
export async function enableNotifications(): Promise<{ permission: PermissionState; subscribed: boolean; message: string }> {
  const support = notifPermission();
  if (support === 'unsupported') return { permission: 'unsupported', subscribed: false, message: 'Peramban ini belum mendukung notifikasi.' };
  const permission = (await Notification.requestPermission()) as PermissionState;
  if (permission !== 'granted') return { permission, subscribed: false, message: 'Izin notifikasi belum diberikan. Aktifkan lewat pengaturan peramban.' };
  if (DEMO || !VAPID) {
    return { permission, subscribed: false, message: DEMO ? 'Notifikasi aktif (mode demo: muncul saat Hamzi terbuka).' : 'Notifikasi aktif. Kunci VAPID belum diatur, jadi push server belum jalan.' };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }));
    const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
    const existing = (await repo.list('push_subscriptions')).find((s) => s.endpoint === json.endpoint);
    await repo.upsert('push_subscriptions', {
      id: existing?.id, endpoint: json.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', user_agent: navigator.userAgent.slice(0, 200),
    });
    return { permission, subscribed: true, message: 'Pengingat aktif. Notifikasi akan muncul walau app ditutup.' };
  } catch (e) {
    return { permission, subscribed: false, message: `Gagal berlangganan push: ${(e as Error).message}` };
  }
}

/** Waktu push terakhir diterima SW (Diagnostik). */
export async function lastPushAt(): Promise<string | null> {
  try {
    const { get } = await import('idb-keyval');
    return ((await get('hamzi-last-push')) as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/// <reference lib="webworker" />
// Service worker (TECH-SPEC §8.2, §7.8.7, §10): precache, push + aksi notifikasi, share target.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { set as idbSet, get as idbGet } from 'idb-keyval';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA: semua navigasi → index.html (kecuali share-target POST yang ditangani di bawah).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/share-target/] }));

// Font & ikon: stale-while-revalidate. Jangan cache API Supabase.
registerRoute(
  ({ request, url }) => url.origin === self.location.origin && (request.destination === 'font' || url.pathname.startsWith('/icons/')),
  new StaleWhileRevalidate({ cacheName: 'static-assets' }),
);

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') void self.skipWaiting();
});

interface PushPayload {
  title?: string; body?: string; url?: string; tag?: string; kind?: string; token?: string;
  actions?: { action: string; title: string }[];
}

self.addEventListener('push', (e) => {
  let d: PushPayload = {};
  try { d = (e.data?.json() as PushPayload) ?? {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(
    Promise.all([
      idbSet('hamzi-last-push', new Date().toISOString()),
      self.registration.showNotification(d.title ?? 'Hamzi', {
        body: d.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: d.tag,
        data: { url: d.url ?? '/', token: d.token, kind: d.kind },
        // Chrome Android menampilkan maks 2 aksi
        ...({ actions: (d.actions ?? []).slice(0, 2), renotify: false } as Record<string, unknown>),
      }),
    ]),
  );
});

const SERVER_ACTIONS = ['done', 'snooze10', 'snooze60', 'attend'];

self.addEventListener('notificationclick', (e) => {
  const data = (e.notification.data ?? {}) as { url?: string; token?: string; kind?: string };
  const url = data.url ?? '/';
  e.notification.close();
  if (e.action && SERVER_ACTIONS.includes(e.action) && data.token && SUPABASE_URL) {
    e.waitUntil(
      fetch(`${SUPABASE_URL}/functions/v1/notif-action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY ?? '' },
        body: JSON.stringify({ token: data.token, action: e.action }),
      })
        .then((r) => r.json() as Promise<{ ok: boolean; message?: string }>)
        .then((res) => self.registration.showNotification('Hamzi', { body: res.message ?? 'Tercatat.', tag: 'ack', badge: '/icons/badge-72.png', icon: '/icons/icon-192.png' }))
        .catch(() => self.clients.openWindow(url).then(() => undefined)),
    );
    return;
  }
  // Mode demo / tanpa token: aksi dibuka di app (app menangani ?notif_action=).
  const target = e.action === 'log'
    ? '/keuangan?quick=expense'
    : e.action && SERVER_ACTIONS.includes(e.action)
      ? `${url}${url.includes('?') ? '&' : '?'}notif_action=${e.action}&kind=${data.kind ?? ''}`
      : url;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      const w = ws.find((c) => 'focus' in c) as WindowClient | undefined;
      return w ? w.navigate(target).then((c) => c?.focus()) : self.clients.openWindow(target);
    }),
  );
});

// Share target (TECH-SPEC §7.8.7): simpan ke IndexedDB 'shared-inbox', lalu buka /chat?shared=1.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith(
      (async () => {
        try {
          const form = await e.request.formData();
          const files = form.getAll('files').filter((f): f is File => f instanceof File);
          const prev = ((await idbGet('shared-inbox')) as unknown[] | undefined) ?? [];
          await idbSet('shared-inbox', [
            ...prev,
            { at: new Date().toISOString(), title: form.get('title') ?? '', text: form.get('text') ?? '', url: form.get('url') ?? '', files },
          ]);
        } catch {
          /* abaikan; tetap arahkan ke chat */
        }
        return Response.redirect('/chat?shared=1', 303);
      })(),
    );
  }
});

// Pengganti Edge Function di MODE DEMO (tanpa server, tanpa AI sungguhan).
import { wibDate, isRoutineDue } from '@common/calc/index.ts';
import { notifBody, NOTIF_ACTIONS } from '@common/notif-lines.id.ts';
import type { Db } from './rpc-logic';
import type { Repo } from './repo';
import { uuid } from './repo';
import type { TablesData } from '@/features/ai/payload';

function tables(db: Db): TablesData {
  const { _profile: _p, _settings: _s, _stats: _t, ...rest } = db;
  return rest as unknown as TablesData;
}

export async function showLocalNotification(title: string, body: string, url = '/', actions: { action: string; title: string }[] = []): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { url }, tag: uuid(), ...({ actions: actions.slice(0, 2) } as Record<string, unknown>) };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
}

export async function invokeLocal(fn: string, body: unknown, db: Db, repo: Repo): Promise<unknown> {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (fn) {
    case 'ai-generate': {
      const { buildDailyPayload, buildWeekPayload } = await import('@/features/ai/payload');
      const { templateDaily, templateWeekly } = await import('@/features/ai/templates');
      const kind = b.kind === 'weekly_review' ? 'weekly_review' : 'daily_summary';
      const payload = kind === 'daily_summary' ? buildDailyPayload(tables(db), db._settings) : buildWeekPayload(tables(db), db._settings);
      const data = kind === 'daily_summary' ? templateDaily(payload as Parameters<typeof templateDaily>[0]) : templateWeekly(payload as Parameters<typeof templateWeekly>[0]);
      const cache_key = `${kind}:${wibDate()}`;
      const row = { id: uuid(), kind, cache_key, payload, response: data, provider: 'templat', model: null, status: 'fallback', created_at: new Date().toISOString() };
      const i = db.ai_requests.findIndex((r) => r.cache_key === cache_key);
      if (i >= 0) db.ai_requests[i] = { ...db.ai_requests[i], ...row, id: db.ai_requests[i].id };
      else db.ai_requests.push(row);
      return { ok: true, source: 'template', data };
    }
    case 'ai-chat': {
      const { localChat } = await import('@/features/chat/local-chat');
      return localChat(body, db, repo);
    }
    case 'push-test': {
      const today = wibDate();
      const pending = db.routines.find((r) => !r.archived && !r.deleted_at && isRoutineDue(r.repeat_days, today) && !db.routine_logs.some((l) => l.routine_id === r.id && l.log_date === today && l.done));
      const title = pending?.name ?? 'Waktunya belajar 25 menit';
      const text = notifBody('test');
      const shown = await showLocalNotification(title, text, '/tumbuh', NOTIF_ACTIONS.test);
      const now = new Date().toISOString();
      db.scheduled_notifications.push({
        id: uuid(), category: 'user', kind: 'test', ref_type: pending ? 'routine' : null, ref_id: pending?.id ?? null, dedupe_key: `test:${uuid()}`,
        fire_at: now, title, body: text, url: '/tumbuh', actions: NOTIF_ACTIONS.test, status: 'sent', sent_at: now, read_at: null, created_at: now,
      });
      return { ok: shown, sent: shown ? 1 : 0, title, body: text, reason: shown ? null : 'Izin notifikasi belum diberikan' };
    }
    case 'account-delete': {
      const { resetDemo } = await import('./local');
      resetDemo('empty');
      return { ok: true };
    }
    default:
      throw new Error(`Fungsi ${fn} tidak tersedia di mode demo`);
  }
}

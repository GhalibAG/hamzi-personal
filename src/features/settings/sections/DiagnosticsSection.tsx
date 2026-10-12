// Pengaturan > Diagnostik (SET-07, TECH-SPEC §8.4): versi, mode, status sinkron, izin & langganan push,
// push terakhir diterima, jumlah baris per tabel, ukuran data, kuota AI.
import { useOutboxCount } from '@/data/outbox';
import { useQuery } from '@tanstack/react-query';
import { wibDate, wibTime } from '@common/calc/index.ts';
import { thousands } from '@common/format.ts';
import { ListSkeleton } from '@/components/ui';
import { DEMO, repo } from '@/data';
import { useRows } from '@/data/hooks';
import { useOnline } from '@/lib/hooks';
import { lastPushAt, notifPermission, pushSubscriptionStatus } from '@/features/notifications/push';
import { InfoRow, SettingsCard } from '../components/rows';
import { APP_VERSION } from '../groups';
import { PERMISSION_LABEL } from './NotificationsSection';

const fmtAt = (iso: string) => `${wibDate(new Date(iso))} ${wibTime(new Date(iso))} WIB`;

function storageSize(): string | null {
  try {
    const raw = localStorage.getItem('hamzi-demo-v1');
    return raw ? `${thousands(Math.round((raw.length * 2) / 1024))} KB` : null;
  } catch {
    return null;
  }
}

export function DiagnosticsSection() {
  const pending = useOutboxCount(!DEMO);
  const online = useOnline();
  const counts = useQuery({ queryKey: ['diag-counts'], queryFn: () => repo.exportAll(), staleTime: 0 });
  const push = useQuery({ queryKey: ['diag-last-push'], queryFn: lastPushAt, staleTime: 0 });
  const sub = useQuery({ queryKey: ['push-sub-status'], queryFn: pushSubscriptionStatus });
  const aiReq = useRows('ai_requests').rows;
  const aiMsg = useRows('ai_messages').rows;
  const today = wibDate();
  const aiToday = aiReq.filter((r) => r.created_at && wibDate(new Date(r.created_at)) === today && r.provider !== 'templat').length
    + aiMsg.filter((m) => m.role === 'assistant' && m.created_at && wibDate(new Date(m.created_at)) === today && m.status === 'ok').length;
  const [permLabel, permTone] = PERMISSION_LABEL[notifPermission()];
  const rows = Object.entries(counts.data ?? {})
    .map(([t, list]) => [t, list.length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  const size = DEMO ? storageSize() : null;

  return (
    <>
      <SettingsCard title="Aplikasi">
        <InfoRow label="Versi" value={`Hamzi ${APP_VERSION}`} />
        <InfoRow label="Mode" value={DEMO ? 'Demo (localStorage)' : 'Supabase'} />
        <InfoRow label="Status sinkron" value={DEMO ? 'Tersimpan di perangkat ini' : `${online ? 'Online' : 'Offline · menunggu internet'}${pending ? ` · ${pending} perubahan antre` : ''}`} tone={(online && !pending) || DEMO ? 'ok' : 'warn'} />
        <InfoRow label="Service worker" value={'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Aktif' : 'Belum aktif'} />
      </SettingsCard>
      <SettingsCard title="Pengingat">
        <InfoRow label="Izin notifikasi" value={permLabel} tone={permTone} />
        <InfoRow label="Langganan push" value={DEMO ? 'Mode demo' : sub.data ?? '…'} tone={sub.data === 'aktif' ? 'ok' : undefined} />
        <InfoRow label="Push terakhir diterima" value={push.data ? fmtAt(push.data) : 'Belum ada'} />
      </SettingsCard>
      <SettingsCard title="AI" desc="Batas harian diatur server (AI_DAILY_LIMIT). Bila habis, Hamzi memakai templat.">
        <InfoRow label="Panggilan AI hari ini" value={thousands(aiToday)} />
      </SettingsCard>
      <SettingsCard title="Data" desc={size ? `Ukuran data di perangkat ± ${size}.` : undefined}>
        {counts.isLoading ? (
          <div className="p-4"><ListSkeleton rows={2} /></div>
        ) : counts.isError ? (
          <InfoRow label="Jumlah baris" value="Belum bisa dihitung" tone="warn" />
        ) : (
          <>
            <InfoRow label="Total baris" value={thousands(total)} />
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-meta">
              {rows.map(([t, n]) => (
                <div key={t} className="flex justify-between gap-2">
                  <dt className="truncate text-ink-3">{t}</dt>
                  <dd className="m-0 font-bold tabular">{thousands(n)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </SettingsCard>
    </>
  );
}

// Tab Pengingat (UI-SPEC §6.3 Pengingat, screenshot 15) + daftar "Pengingat hari ini" desktop.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { isRoutineDue, isoWeekday, repeatLabel } from '@common/calc/index.ts';
import { Icon } from '@/components/icons';
import { Button, EmptyState } from '@/components/ui';
import { repo } from '@/data';
import { useRows, useSettings, useUpdate } from '@/data/hooks';
import { useOnline } from '@/lib/hooks';
import { toast } from '@/stores/ui';
import { enableNotifications, notifPermission, type PermissionState } from '@/features/notifications/push';
import { hhmm } from '@/features/learning/derive';
import { useFocusMinutes } from '@/features/learning/hooks';
import { ToggleSwitch } from '@/features/growth/components/ToggleSwitch';

/** Status izin notifikasi; diperbarui saat app kembali terlihat. */
export function useNotifPermission() {
  const [perm, setPerm] = useState<PermissionState>(() => notifPermission());
  useEffect(() => {
    const upd = () => setPerm(notifPermission());
    document.addEventListener('visibilitychange', upd);
    window.addEventListener('focus', upd);
    return () => { document.removeEventListener('visibilitychange', upd); window.removeEventListener('focus', upd); };
  }, []);
  const enable = async () => {
    const r = await enableNotifications();
    setPerm(r.permission);
    toast(r.message);
    return r;
  };
  return { perm, enable, refresh: () => setPerm(notifPermission()) };
}

export function NotifBanner({ perm, onEnable }: { perm: PermissionState; onEnable: () => void }) {
  const nav = useNavigate();
  if (perm === 'granted') return null;
  const sub = perm === 'denied'
    ? 'Izin ditolak. Aktifkan lewat pengaturan peramban.'
    : perm === 'unsupported'
      ? 'Peramban ini belum mendukung notifikasi. Pasang Hamzi ke layar utama.'
      : 'Izinkan notifikasi supaya pengingat muncul tepat waktu.';
  return (
    <div role="status" className="flex items-center gap-3 rounded-3xl border border-warn-banner-line bg-warn-banner px-3.5 py-3">
      <Icon.BellOff size={20} className="shrink-0 text-warn-fg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-bold text-warn-fg">Notifikasi belum aktif</span>
        <span className="text-meta text-warn-fg">{sub}</span>
      </div>
      {perm === 'default' ? (
        <Button size="sm" onClick={onEnable}>Aktifkan</Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => nav('/pengaturan/notifikasi')}>Pengaturan</Button>
      )}
    </div>
  );
}

interface ReminderItem { key: string; time: string; name: string; kind: string; on: boolean; toggle: (v: boolean) => void; to: string }

/** Semua rutinitas & modul yang punya jam pengingat, urut jam. `todayOnly` = hanya yang terjadwal hari ini. */
export function useReminderItems(today: string, todayOnly = false): ReminderItem[] {
  const routines = useRows('routines').rows;
  const modules = useRows('learning_modules').rows;
  const updR = useUpdate('routines');
  const updM = useUpdate('learning_modules');
  const focus = useFocusMinutes();
  const wd = isoWeekday(today);
  const items: ReminderItem[] = [
    ...routines
      .filter((r) => !r.archived && r.remind_at && (!todayOnly || isRoutineDue(r.repeat_days, today)))
      .map((r) => ({
        key: 'r' + r.id, time: hhmm(r.remind_at), name: r.name, on: r.remind_enabled, to: `/tumbuh/rutinitas/${r.id}`,
        kind: `${r.is_required ? 'Rutinitas wajib' : 'Kebiasaan'} · ${repeatLabel(r.repeat_days)}`,
        toggle: (v: boolean) => void updR.patch(r.id, { remind_enabled: v }),
      })),
    ...modules
      .filter((m) => m.status !== 'selesai' && m.remind_at && (!todayOnly || (m.status === 'aktif' && m.remind_days.includes(wd))))
      .map((m) => ({
        key: 'm' + m.id, time: hhmm(m.remind_at), name: m.title, on: m.remind_enabled, to: `/tumbuh/modul/${m.id}`,
        kind: `Belajar mandiri · ${focus} mnt${m.status === 'ditunda' ? ' · dijeda' : ''}`,
        toggle: (v: boolean) => void updM.patch(m.id, { remind_enabled: v }),
      })),
  ];
  return items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

export function ReminderRow({ x }: { x: ReminderItem }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pr-2.5 pl-3.5">
      <span className="tabular min-w-12.5 text-section font-extrabold">{x.time}</span>
      <Link to={x.to} className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink no-underline">
        <span className="truncate text-body font-bold">{x.name}</span>
        <span className="truncate text-meta text-ink-3">{x.kind}</span>
      </Link>
      <ToggleSwitch checked={x.on} onChange={x.toggle} label={`Pengingat ${x.name} jam ${x.time}`} />
    </div>
  );
}

/** Tombol "Coba pengingat" → Edge push-test (izin dulu bila perlu; tidak didukung/offline → Pengaturan › Notifikasi). */
function useTestReminder(perm: { perm: PermissionState; enable: () => Promise<{ permission: PermissionState }> }) {
  const nav = useNavigate();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    if (perm.perm === 'unsupported') { toast('Peramban ini belum mendukung notifikasi.'); nav('/pengaturan/notifikasi'); return; }
    if (!online) { toast('Kamu sedang offline. Coba lagi saat tersambung.'); nav('/pengaturan/notifikasi'); return; }
    setBusy(true);
    try {
      if (perm.perm !== 'granted') {
        const r = await perm.enable();
        if (r.permission !== 'granted') { nav('/pengaturan/notifikasi'); return; }
      }
      const res = await repo.invoke<{ ok?: boolean; sent?: number; reason?: string | null }>('push-test', {});
      toast(res?.ok === false ? res.reason ?? 'Pengingat uji belum terkirim.' : 'Pengingat uji dikirim. Cek notifikasimu.');
    } catch {
      toast('Pengingat uji gagal dikirim. Coba lagi nanti.');
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

export function RemindersTab({ today }: { today: string }) {
  const perm = useNotifPermission();
  const items = useReminderItems(today);
  const s = useSettings();
  const test = useTestReminder(perm);
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
      <NotifBanner perm={perm.perm} onEnable={() => void perm.enable()} />
      <div className="flex flex-col gap-2.5 rounded-3xl bg-info-bg p-3.5">
        <span className="text-label leading-normal font-semibold text-info-fg">
          Pengingat muncul sebagai notifikasi HP walau app ditutup (setelah dipasang ke layar utama). Bisa langsung ditandai selesai dari notifikasi.
        </span>
        <button
          type="button"
          onClick={() => void test.run()}
          disabled={test.busy}
          className="h-10 self-start rounded-full bg-info-fg px-4 text-label font-extrabold text-on-primary disabled:opacity-60"
        >
          {test.busy ? 'Mengirim…' : 'Coba pengingat'}
        </button>
      </div>
      {items.length ? items.map((x) => <ReminderRow key={x.key} x={x} />) : (
        <EmptyState compact text="Belum ada pengingat. Atur jam saat menambah rutinitas atau modul." />
      )}
      <Link to="/pengaturan/notifikasi" className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline hover:bg-surface-2">
        <span className="text-body font-bold">Jam tenang {hhmm(s.quiet_start)}–{hhmm(s.quiet_end)}</span>
        <span className="text-meta text-ink-3">Pengingat otomatis dari sistem tidak dikirim di jam ini dan maksimal 6 per hari. Pengingat buatanmu selalu dikirim.</span>
      </Link>
    </div>
  );
}

/** Desktop: "Pengingat hari ini" (Desktop-Tumbuh.dc.html). */
export function TodayReminders({ today }: { today: string }) {
  const perm = useNotifPermission();
  const items = useReminderItems(today, true);
  return (
    <>
      <NotifBanner perm={perm.perm} onEnable={() => void perm.enable()} />
      <div className="rounded-3xl border border-line bg-surface px-3.5 py-1">
        {items.length ? items.map((x) => (
          <div key={x.key} className="flex items-center gap-3 border-b border-surface-2 py-1 last:border-b-0">
            <span className="tabular min-w-12 text-body font-extrabold">{x.time}</span>
            <Link to={x.to} className="min-w-0 flex-1 truncate text-label-lg font-semibold text-ink no-underline hover:underline">{x.name}</Link>
            <ToggleSwitch checked={x.on} onChange={x.toggle} label={`Pengingat ${x.name}`} />
          </div>
        )) : <p className="m-0 py-3 text-body text-ink-3">Tidak ada pengingat hari ini.</p>}
      </div>
    </>
  );
}

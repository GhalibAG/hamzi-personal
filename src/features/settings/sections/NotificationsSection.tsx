// Pengaturan > Notifikasi (NOT-06, NOT-09): status izin & langganan, Aktifkan, Coba pengingat, pasang ke layar utama,
// panduan baterai, toggle per jenis pengingat sistem, jam tenang.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/icons';
import { Button, inputCls } from '@/components/ui';
import { DEMO } from '@/data';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import { BatteryGuide } from '@/features/notifications/components/BatteryGuide';
import { InstallHint } from '@/features/notifications/components/InstallHint';
import { useTestReminder } from '@/features/notifications/hooks';
import { enableNotifications, notifPermission, pushSubscriptionStatus, type PermissionState } from '@/features/notifications/push';
import { cx } from '@/lib/cx';
import { CardBody, InfoRow, LinkRow, SettingsCard, ToggleRow } from '../components/rows';

export const SYSTEM_KINDS: { key: string; label: string; desc: string }[] = [
  { key: 'class', label: 'Kelas', desc: '30 menit sebelum kelas mulai' },
  { key: 'exam', label: 'Ujian', desc: 'H-3 dan H-1 pukul 19:00' },
  { key: 'expense_nudge', label: 'Catat pengeluaran', desc: 'Pukul 21:00 bila belum ada pengeluaran hari ini' },
  { key: 'budget', label: 'Anggaran', desc: 'Saat terpakai 80% dan 100%' },
  { key: 'weekly_review', label: 'Review mingguan', desc: 'Minggu pukul 19:00' },
  { key: 'goal', label: 'Setoran target', desc: 'Pada tanggal rencana setoran' },
  { key: 'backup', label: 'Pengingat backup', desc: '14 hari sejak backup terakhir' },
  { key: 'valuation', label: 'Valuasi investasi', desc: 'Tanggal 1 setiap bulan' },
  { key: 'morning_brief', label: 'Ringkasan pagi', desc: 'Pukul 07:00' },
];

export const PERMISSION_LABEL: Record<PermissionState, [string, 'ok' | 'warn' | 'danger']> = {
  granted: ['Diizinkan', 'ok'], default: ['Belum diizinkan', 'warn'], denied: ['Diblokir', 'danger'], unsupported: ['Tidak didukung', 'warn'],
};

export function NotificationsSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const [perm, setPerm] = useState<PermissionState>(() => notifPermission());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const test = useTestReminder();
  const sub = useQuery({ queryKey: ['push-sub-status'], queryFn: pushSubscriptionStatus, enabled: !DEMO });

  useEffect(() => {
    const f = () => setPerm(notifPermission());
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  const enable = async () => {
    setBusy(true);
    const r = await enableNotifications();
    setBusy(false);
    setPerm(r.permission);
    setMsg(r.message);
    void sub.refetch();
  };
  const [permLabel, permTone] = PERMISSION_LABEL[perm];
  const subLabel = DEMO ? 'Mode demo' : sub.data === 'aktif' ? 'Aktif' : sub.data === 'tidak didukung' ? 'Tidak didukung' : 'Belum';
  const message = test.message ?? msg;

  const setQuiet = (key: 'quiet_start' | 'quiet_end', v: string) => { if (/^\d{2}:\d{2}$/.test(v)) upd.mutate({ [key]: v }); };

  return (
    <>
      <SettingsCard title="Status">
        <InfoRow label="Izin notifikasi" value={permLabel} tone={permTone} />
        <InfoRow label="Langganan push" value={subLabel} tone={DEMO || sub.data === 'aktif' ? 'ok' : 'warn'} />
        <CardBody className="pt-3">
          <div className="flex flex-wrap gap-2">
            {perm !== 'granted' && perm !== 'unsupported' && (
              <Button size="sm" onClick={() => void enable()} disabled={busy}>Aktifkan</Button>
            )}
            {perm === 'granted' && !DEMO && sub.data !== 'aktif' && (
              <Button size="sm" onClick={() => void enable()} disabled={busy}>Aktifkan ulang</Button>
            )}
            <Button size="sm" variant="info" onClick={() => void test.send()} disabled={test.busy}>Coba pengingat</Button>
          </div>
          {perm === 'denied' && <span className="text-meta text-danger-fg">Izin diblokir. Buka pengaturan situs di peramban, izinkan Notifikasi, lalu muat ulang Hamzi.</span>}
          {message && <span role="status" className={cx('text-meta font-semibold', test.ok === false ? 'text-danger-fg' : 'text-brand-800')}>{message}</span>}
        </CardBody>
      </SettingsCard>

      <InstallHint />

      <SettingsCard title="Panduan baterai (Android)">
        <CardBody><BatteryGuide /></CardBody>
      </SettingsCard>

      <SettingsCard title="Pengingat otomatis dari sistem" desc="Pengingat buatanmu (rutinitas, modul, tugas) selalu dikirim pada jamnya.">
        {SYSTEM_KINDS.map((k) => (
          <ToggleRow
            key={k.key}
            label={k.label}
            desc={k.desc}
            checked={s.system_notif[k.key] ?? false}
            onChange={(v) => upd.mutate({ system_notif: { ...s.system_notif, [k.key]: v } })}
          />
        ))}
      </SettingsCard>

      <SettingsCard title="Jam tenang" desc="Pengingat otomatis dari sistem tidak dikirim di jam ini dan maksimal 6 per hari. Pengingat buatanmu selalu dikirim.">
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-bold text-ink-muted">Mulai</span>
              <input type="time" className={cx(inputCls, 'tabular')} value={s.quiet_start} onChange={(e) => setQuiet('quiet_start', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-bold text-ink-muted">Selesai</span>
              <input type="time" className={cx(inputCls, 'tabular')} value={s.quiet_end} onChange={(e) => setQuiet('quiet_end', e.target.value)} />
            </label>
          </div>
        </CardBody>
      </SettingsCard>

      <SettingsCard>
        <LinkRow to="/tumbuh?tab=pengingat" icon={<Icon.Clock size={20} className="shrink-0 text-primary" />} label="Atur pengingat rutinitas & modul" desc="Jam & hari tiap pengingat buatanmu" />
        <LinkRow to="/notifikasi" icon={<Icon.Bell size={20} className="shrink-0 text-primary" />} label="Kotak notifikasi" desc="Riwayat 14 hari terakhir" />
      </SettingsCard>
    </>
  );
}

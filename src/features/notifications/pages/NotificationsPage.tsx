// Kotak notifikasi `/notifikasi` (UI-SPEC §11, NOT-01): riwayat 14 hari, aksi yang masih relevan, buka layar = tandai dibaca.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/icons';
import {
  Button, ButtonLink, EmptyState, ErrorState, IconButton, ListSkeleton, MOD_BG, Page, ScreenHeader, type ModTone,
} from '@/components/ui';
import { useRows, useUpdate } from '@/data/hooks';
import type { ScheduledNotification } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop, useNow, useToday } from '@/lib/hooks';
import { toast } from '@/stores/ui';
import { inboxGroups, relTime } from '../derive';
import { relevantActions, rowToReminder, useNotifActions, useReminderData } from '../hooks';
import { enableNotifications, notifPermission, type PermissionState } from '../push';

type IconC = (typeof Icon)[keyof typeof Icon];
const KIND_ICON: Record<string, [IconC, ModTone, string]> = {
  routine: [Icon.Repeat, 'rutin', 'Rutinitas'],
  module: [Icon.Book, 'belajar', 'Belajar mandiri'],
  task: [Icon.Plan, 'rencana', 'Tugas'],
  class: [Icon.Cap, 'kuliah', 'Kelas'],
  exam: [Icon.Calendar, 'kuliah', 'Ujian'],
  expense_nudge: [Icon.Receipt, 'keuangan', 'Catat pengeluaran'],
  budget: [Icon.Wallet, 'target', 'Anggaran'],
  weekly_review: [Icon.Sparkle, 'keuangan', 'Review mingguan'],
  goal: [Icon.Target, 'target', 'Target tabungan'],
  valuation: [Icon.TrendUp, 'invest', 'Investasi'],
  backup: [Icon.Database, 'rencana', 'Backup'],
  morning_brief: [Icon.Sun, 'target', 'Ringkasan pagi'],
  test: [Icon.Bell, 'keuangan', 'Pengingat uji'],
};
const kindInfo = (kind: string) => KIND_ICON[kind] ?? [Icon.Bell, 'keuangan', 'Pengingat'];

function PermissionBanner() {
  const [perm, setPerm] = useState<PermissionState>(() => notifPermission());
  const [busy, setBusy] = useState(false);
  if (perm === 'granted') return null;
  const enable = async () => {
    setBusy(true);
    const r = await enableNotifications();
    setBusy(false);
    setPerm(r.permission);
    toast(r.message);
  };
  const text = perm === 'denied'
    ? 'Izin notifikasi diblokir. Izinkan lewat pengaturan situs di peramban.'
    : perm === 'unsupported'
      ? 'Peramban ini belum mendukung notifikasi. Pengingat tetap tampil di sini saat Hamzi terbuka.'
      : 'Pengingat tetap tampil di sini dan sebagai banner saat Hamzi terbuka.';
  return (
    <div role="status" className="flex items-center gap-3 rounded-3xl border border-warn-banner-line bg-warn-banner p-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warn-bg text-warn-fg"><Icon.BellOff size={20} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-extrabold text-warn-fg">Notifikasi belum aktif</span>
        <span className="text-meta text-ink-2">{text}</span>
      </div>
      {perm === 'default' && <Button size="sm" onClick={() => void enable()} disabled={busy}>Aktifkan</Button>}
    </div>
  );
}

function NotifCard({ n, fresh, now, actions }: {
  n: ScheduledNotification; fresh: boolean; now: Date; actions: ReactNode;
}) {
  const [Ico, tone, label] = kindInfo(n.kind);
  return (
    <article className={cx('flex flex-col rounded-3xl border bg-surface', fresh ? 'border-brand-200' : 'border-line')}>
      <Link to={n.url || '/'} className="flex gap-3 p-3.5 text-ink no-underline">
        <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', MOD_BG[tone])} title={label}>
          <Ico size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-body font-bold">{n.title}</span>
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-meta text-ink-3">
              {fresh && <span className="size-2 rounded-full bg-badge-dot" aria-hidden="true" />}
              <span className="sr-only">{label}, {fresh ? 'baru, ' : ''}</span>
              {relTime(n.sent_at ?? n.fire_at, now)}
            </span>
          </div>
          <span className="text-label text-ink-2">{n.body}</span>
        </div>
      </Link>
      {actions}
    </article>
  );
}

export default function NotificationsPage() {
  const desktop = useIsDesktop();
  const nav = useNavigate();
  const now = useNow(60_000);
  const today = useToday();
  const q = useRows('scheduled_notifications');
  const { data } = useReminderData();
  const run = useNotifActions(data, q.rows);
  const update = useUpdate('scheduled_notifications');
  const groups = useMemo(() => inboxGroups(q.rows, now), [q.rows, now]);

  // Buka layar = tandai semua dibaca; yang baru tetap ditandai titik selama layar terbuka.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const marking = useRef(new Set<string>());
  const patch = update.patch;
  useEffect(() => {
    if (!q.isSuccess) return;
    const unread = q.rows.filter((n) => n.status === 'sent' && !n.read_at && !marking.current.has(n.id));
    if (!unread.length) return;
    const at = new Date().toISOString();
    unread.forEach((n) => marking.current.add(n.id));
    setFresh((s) => new Set([...s, ...unread.map((n) => n.id)]));
    for (const n of unread) void patch(n.id, { read_at: at }).catch(() => marking.current.delete(n.id));
  }, [q.isSuccess, q.rows, patch]);

  const gear = (
    <IconButton label="Pengaturan" onClick={() => nav('/pengaturan')}>
      <Icon.Gear size={20} />
    </IconButton>
  );

  let body: ReactNode;
  if (q.isLoading) body = <ListSkeleton rows={4} />;
  else if (q.isError) body = <ErrorState text="Notifikasi belum bisa dimuat." onRetry={() => void q.refetch()} />;
  else if (!groups.length) {
    body = (
      <EmptyState
        mood="calm"
        title="Belum ada notifikasi"
        text="Pengingat yang terkirim dalam 14 hari terakhir akan muncul di sini."
        action={<ButtonLink to="/tumbuh?tab=pengingat" size="sm" variant="soft">Atur pengingat</ButtonLink>}
      />
    );
  } else {
    body = groups.map((g) => (
      <section key={g.label} aria-label={g.label} className="flex flex-col gap-2.5">
        <h2 className="m-0 text-label font-extrabold text-ink-3">{g.label}</h2>
        {g.items.map((n) => {
          const r = rowToReminder(n, data);
          const acts = relevantActions(r, data, today);
          return (
            <NotifCard
              key={n.id}
              n={n}
              now={now}
              fresh={fresh.has(n.id)}
              actions={acts.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3.5 pb-3.5 pl-16.5">
                  {acts.map((a, i) => (
                    <Button key={a.action} size="sm" variant={i === 0 ? 'soft' : 'secondary'} aria-label={`${a.title}: ${n.title}`} onClick={() => void run(r, a.action, { rowId: n.id })}>
                      {a.action.startsWith('snooze') ? 'Tunda' : a.title}
                    </Button>
                  ))}
                </div>
              )}
            />
          );
        })}
      </section>
    ));
  }

  return (
    <Page narrow>
      <ScreenHeader overline="14 hari terakhir" title="Notifikasi" back={desktop ? undefined : true} right={gear} />
      <div className="flex flex-col gap-5 px-4 pt-4 lg:px-0 lg:pt-0">
        <PermissionBanner />
        {body}
      </div>
    </Page>
  );
}

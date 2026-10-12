// Detail rutinitas `/tumbuh/rutinitas/:id` (RUT-01, RUT-06): heatmap 12 minggu, streak per rutinitas, ubah semua field, arsip/hapus.
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { isRoutineDue, repeatLabel } from '@common/calc/index.ts';
import { dayLabel, HARI_PENDEK } from '@common/format.ts';
import { Icon, type IconName } from '@/components/icons';
import { Button, Card, ConfirmRow, EmptyState, ErrorState, IconButton, ListSkeleton, Page, ScreenHeader, SectionTitle } from '@/components/ui';
import { useRemove, useRows, useUpdate, useUpsert } from '@/data/hooks';
import type { Routine } from '@/data/types';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { routineHeatmap, routineStreak, type HeatState } from '@/features/growth/derive';
import { LM_TILE, hhmm, lmIndex } from '@/features/learning/derive';
import { draftError, draftFrom, RoutineFields, type RoutineDraft } from '../components/RoutineFormSheet';
import { CheckCircle } from '../components/RoutineRow';
import { useRoutineToggle } from '../hooks';
import { ToggleSwitch } from '@/features/growth/components/ToggleSwitch';

const ICONS: IconName[] = ['Repeat', 'Drop', 'Book', 'Flame', 'Sun', 'Moon', 'Activity', 'Wallet', 'Sprout', 'Check'];
const HEAT: Record<HeatState, string> = {
  done: 'bg-brand-500',
  partial: 'bg-brand-200',
  missed: 'bg-line-strong',
  off: 'bg-surface-2 border border-line',
  future: 'bg-transparent',
};
const HEAT_LABEL: Record<HeatState, string> = { done: 'selesai', partial: 'sebagian', missed: 'belum', off: 'tidak terjadwal', future: 'belum terjadi' };

function colorIndex(c: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const m = /^lm-(\d)$/.exec(c ?? '');
  return lmIndex(m ? Number(m[1]) : 0);
}

function RoutineIcon({ r, size = 'md' }: { r: Routine; size?: 'md' | 'sm' }) {
  const Ic = Icon[(r.icon as IconName) in Icon ? (r.icon as IconName) : 'Repeat'];
  return (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center', size === 'md' ? 'size-12 rounded-2xl' : 'size-9 rounded-lg', r.color ? LM_TILE[colorIndex(r.color)] : 'bg-rutin-bg text-rutin-fg')}>
      <Ic size={size === 'md' ? 24 : 18} />
    </span>
  );
}

function Heatmap({ r, today }: { r: Routine; today: string }) {
  const logs = useRows('routine_logs').rows;
  const h = useMemo(() => routineHeatmap(r, logs, today, 12), [r, logs, today]);
  const first = h.cols[0].start;
  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <SectionTitle size="sm" title="Riwayat 12 minggu" right={<span className="text-meta font-semibold text-ink-3">{dayLabel(first).split(' ').slice(1).join(' ')} – {dayLabel(today).split(' ').slice(1).join(' ')}</span>} />
      <div className="flex gap-1.5">
        <div aria-hidden="true" className="grid grid-rows-7 gap-1 text-2xs font-bold text-ink-3">
          {HARI_PENDEK.slice(1).map((d) => <span key={d} className="flex items-center">{d}</span>)}
        </div>
        <div
          role="img"
          aria-label={`Riwayat 12 minggu: selesai ${h.doneCount} dari ${h.dueCount} hari terjadwal`}
          className="grid flex-1 grid-flow-col grid-cols-12 grid-rows-7 gap-1"
        >
          {h.cols.flatMap((c) => c.days.map((d) => (
            <span
              key={d.day}
              title={`${dayLabel(d.day)}: ${HEAT_LABEL[d.state]}${r.kind === 'count' && d.value ? ` (${d.value}/${r.target_count})` : ''}`}
              className={cx('aspect-square w-full rounded-xs', HEAT[d.state], d.day === today && 'ring-2 ring-brand-300 ring-offset-1 ring-offset-surface')}
            />
          )))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-micro font-semibold text-ink-2">
        {(['done', 'partial', 'missed', 'off'] as HeatState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cx('size-2.5 rounded-xs', HEAT[s])} />{HEAT_LABEL[s]}</span>
        ))}
      </div>
      <span className="text-meta text-ink-3">Selesai {h.doneCount} dari {h.dueCount} hari terjadwal.</span>
    </Card>
  );
}

function EditCard({ r }: { r: Routine }) {
  const [dr, setDr] = useState<RoutineDraft>(() => draftFrom(undefined, r));
  const [showMore, setShowMore] = useState(true);
  const [icon, setIcon] = useState<string | null>(r.icon ?? null);
  const [color, setColor] = useState<string | null>(r.color ?? null);
  const up = useUpsert('routines');
  const set = (p: Partial<RoutineDraft>) => setDr((x) => ({ ...x, ...p }));
  const base = draftFrom(undefined, r);
  const dirty = JSON.stringify(dr) !== JSON.stringify(base) || icon !== (r.icon ?? null) || color !== (r.color ?? null);
  const valid = dr.name.trim().length > 0 && dr.days.length > 0 && !draftError(dr);
  const save = async () => {
    if (!valid || !dirty) return;
    try {
      await up.save({
        id: r.id, name: dr.name.trim(), kind: dr.kind, target_count: dr.kind === 'count' ? dr.target : 1, is_required: dr.required,
        repeat_days: [...dr.days].sort(), remind_at: dr.time || null,
        remind_enabled: dr.time ? (r.remind_at ? r.remind_enabled : true) : false, icon, color,
      });
      toast('Rutinitas diperbarui.');
    } catch {
      toast('Gagal menyimpan. Coba lagi.');
    }
  };
  return (
    <Card className="flex flex-col gap-3.5 p-3.5">
      <SectionTitle size="sm" title="Ubah rutinitas" />
      <RoutineFields dr={dr} set={set} showMore={showMore} setShowMore={setShowMore} />
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-bold text-ink-muted" id="rt-color">Warna</span>
        <div role="group" aria-labelledby="rt-color" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={color === null} aria-label="Warna bawaan" onClick={() => setColor(null)} className={cx('size-11 rounded-full border-2 bg-rutin-bg', color === null ? 'border-brand-500' : 'border-transparent')} />
          {[0, 1, 2, 3, 4].map((i) => (
            <button key={i} type="button" aria-pressed={color === `lm-${i}`} aria-label={`Warna ${i + 1}`} onClick={() => setColor(`lm-${i}`)} className={cx('size-11 rounded-full border-2', LM_TILE[i], color === `lm-${i}` ? 'border-brand-500' : 'border-transparent')} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-bold text-ink-muted" id="rt-icon">Ikon</span>
        <div role="group" aria-labelledby="rt-icon" className="flex flex-wrap gap-1.5">
          {ICONS.map((n) => {
            const Ic = Icon[n];
            const on = (icon ?? 'Repeat') === n;
            return (
              <button key={n} type="button" aria-pressed={on} aria-label={`Ikon ${n}`} onClick={() => setIcon(n === 'Repeat' ? null : n)} className={cx('flex size-11 items-center justify-center rounded-lg border', on ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted')}>
                <Ic size={20} />
              </button>
            );
          })}
        </div>
      </div>
      <Button size="lg" block disabled={!valid || !dirty || up.isPending} onClick={() => void save()}>Simpan perubahan</Button>
    </Card>
  );
}

export default function RoutineDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const today = useToday();
  const routines = useRows('routines');
  const logs = useRows('routine_logs');
  const upd = useUpdate('routines');
  const rm = useRemove('routines');
  const toggle = useRoutineToggle();
  const [confirmDel, setConfirmDel] = useState(false);
  const r = routines.rows.find((x) => x.id === id);
  const streakN = useMemo(() => (r ? routineStreak(r, logs.rows, today) : 0), [r, logs.rows, today]);
  const back = () => nav('/tumbuh');

  if (routines.isLoading || logs.isLoading) {
    return <Page narrow><div className="px-4 pt-5 lg:px-0"><ListSkeleton rows={4} /></div></Page>;
  }
  if (routines.isError) return <Page narrow><div className="px-4 pt-5 lg:px-0"><ErrorState onRetry={() => void routines.refetch()} /></div></Page>;
  if (!r) {
    return (
      <Page narrow>
        <div className="flex flex-col gap-3 px-4 pt-5 lg:px-0">
          <IconButton label="Kembali" onClick={back}><Icon.ChevronLeft size={20} /></IconButton>
          <EmptyState mood="worried" title="Rutinitas tidak ditemukan" text="Mungkin sudah dihapus." action={<Button size="sm" onClick={back}>Ke Tumbuh</Button>} />
        </div>
      </Page>
    );
  }

  const log = logs.rows.find((l) => l.routine_id === r.id && l.log_date === today);
  const dueToday = isRoutineDue(r.repeat_days, today);
  const archive = async (v: boolean) => {
    await upd.patch(r.id, { archived: v });
    if (v) toastUndo('Rutinitas diarsipkan.', () => void upd.patch(r.id, { archived: false }));
    else toast('Rutinitas aktif lagi.');
  };
  const remove = async () => {
    try {
      await rm.remove(r.id);
      toastUndo('Rutinitas dihapus.', () => void rm.undo(r.id));
      nav('/tumbuh', { replace: true });
    } catch {
      toast('Gagal menghapus. Coba lagi.');
    }
  };

  return (
    <Page narrow>
      <ScreenHeader back="/tumbuh" overline={r.is_required ? 'Rutinitas wajib' : 'Kebiasaan'} title={r.name} />
      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-0 lg:pt-0">
        {r.archived && (
          <div role="status" className="flex items-center gap-3 rounded-3xl border border-warn-banner-line bg-warn-banner px-3.5 py-3">
            <span className="flex-1 text-body font-bold text-warn-fg">Diarsipkan — tidak tampil di Hari ini dan tidak diingatkan.</span>
            <Button size="sm" onClick={() => void archive(false)}>Aktifkan lagi</Button>
          </div>
        )}
        <Card className="flex items-center gap-3 p-3.5">
          <RoutineIcon r={r} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-section font-extrabold"><Icon.Flame size={18} className="text-danger-fg" />{streakN} hari berturut-turut</span>
            <span className="truncate text-meta text-ink-3">
              {repeatLabel(r.repeat_days)}{r.kind === 'count' ? ` · target ${r.target_count}/hari` : ''}{r.remind_at ? ` · ingat ${hhmm(r.remind_at)}` : ''}
            </span>
          </div>
          {dueToday && !r.archived && <CheckCircle r={r} log={log} onToggle={(d) => toggle(r, log, d)} />}
        </Card>
        <Card className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-3.5">
          <div className="flex flex-col">
            <span className="text-body font-bold">Pengingat {r.remind_at ? hhmm(r.remind_at) : ''}</span>
            <span className="text-meta text-ink-3">{r.remind_at ? 'Pengingat buatanmu selalu dikirim, termasuk di jam tenang.' : 'Atur jam di bawah untuk mengaktifkan pengingat.'}</span>
          </div>
          <ToggleSwitch checked={r.remind_enabled && !!r.remind_at} disabled={!r.remind_at} onChange={(v) => void upd.patch(r.id, { remind_enabled: v })} label={`Pengingat ${r.name}`} />
        </Card>
        <Heatmap r={r} today={today} />
        <EditCard key={r.id} r={r} />
        <Card className="flex flex-col gap-2.5 p-3.5">
          <SectionTitle size="sm" title="Kelola" />
          {!r.archived && <Button variant="secondary" onClick={() => void archive(true)}>Arsipkan rutinitas</Button>}
          {confirmDel ? (
            <ConfirmRow text="Hapus rutinitas ini? Riwayatnya ikut tersembunyi. Kamu bisa mengurungkan sebentar." confirmLabel="Hapus" danger onConfirm={() => void remove()} onCancel={() => setConfirmDel(false)} />
          ) : (
            <Button variant="danger-outline" onClick={() => setConfirmDel(true)}>Hapus rutinitas</Button>
          )}
        </Card>
      </div>
    </Page>
  );
}

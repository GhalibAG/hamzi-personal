// Detail modul `/tumbuh/modul/:id` (UI-SPEC §6.6; BEL-03, BEL-07, BEL-08): progres, minggu ini, pengingat, unit, riwayat sesi.
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { wibTime } from '@common/calc/index.ts';
import { dayLabel, HARI_PENDEK } from '@common/format.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, CheckBox, EmptyState, ErrorState, IconButton, ListSkeleton, Menu, Page, ProgressBar, SectionTitle, Skeleton, Tag, inputCls,
} from '@/components/ui';
import { useRemove, useRows, useUnitSetStatus, useUpdate, useUpsert } from '@/data/hooks';
import type { LearningModule, LearningUnit } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { weekStudy } from '@/features/growth/derive';
import { CATEGORY_LABEL, LM_BG, LM_FG, STATUS_LABEL, UNIT_KIND_LABEL, hhmm, moduleView, unitLabel } from '../derive';
import { useFocusMinutes, useStartFocus } from '../hooks';
import { ManualSessionSheet } from '../components/ManualSessionSheet';
import { ModuleInitial } from '../components/ModuleRow';
import { UnitEditSheet } from '../components/UnitEditSheet';
import { ToggleSwitch } from '@/features/growth/components/ToggleSwitch';

const TARGETS = [60, 120, 180, 300];

function Header({ m, v, onBack }: { m: LearningModule; v: ReturnType<typeof moduleView>; onBack: () => void }) {
  const openQuick = useUi((s) => s.openQuick);
  const upd = useUpdate('learning_modules');
  const rm = useRemove('learning_modules');
  const nav = useNavigate();
  const start = useStartFocus();
  const focus = useFocusMinutes();
  const setStatus = (status: LearningModule['status'], msg: string) => {
    void upd.patch(m.id, { status });
    toast(msg);
  };
  const archive = async () => {
    try {
      await rm.remove(m.id);
      toastUndo('Modul diarsipkan.', () => void rm.undo(m.id));
      nav('/tumbuh', { replace: true });
    } catch {
      toast('Gagal mengarsipkan. Coba lagi.');
    }
  };
  return (
    <div className={cx('flex flex-col gap-3 px-4 pt-5 pb-5 lg:rounded-5xl lg:px-6', LM_BG[v.color])}>
      <div className="flex items-center gap-2">
        <IconButton label="Kembali" onClick={onBack}><Icon.ChevronLeft size={20} /></IconButton>
        <span className="flex-1" />
        <IconButton label="Ubah modul" onClick={() => openQuick('module', { id: m.id })}><Icon.Edit size={20} /></IconButton>
        <Menu
          trigger={({ open, toggle }) => (
            <IconButton label="Aksi lain" aria-expanded={open} onClick={toggle}><Icon.More size={20} /></IconButton>
          )}
          items={[
            m.status === 'ditunda'
              ? { label: 'Lanjutkan modul', onSelect: () => setStatus('aktif', 'Modul aktif lagi.') }
              : { label: 'Jeda modul', onSelect: () => setStatus('ditunda', 'Modul dijeda. Pengingatnya ikut berhenti di Hari ini.') },
            m.status === 'selesai'
              ? { label: 'Aktifkan lagi', onSelect: () => setStatus('aktif', 'Modul aktif lagi.') }
              : { label: 'Tandai modul selesai', onSelect: () => setStatus('selesai', 'Mantap, modul selesai!') },
            { label: 'Arsipkan', danger: true, onSelect: () => void archive() },
          ]}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-surface p-0.5"><ModuleInitial v={v} size="lg" /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx('text-meta font-bold', LM_FG[v.color])}>{CATEGORY_LABEL[m.category] ?? 'Lainnya'}{m.status !== 'aktif' ? ` · ${STATUS_LABEL[m.status]}` : ''}</span>
          <h1 className="m-0 text-name leading-tight font-extrabold tracking-[-0.3px] text-ink">{m.title}</h1>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-meta font-bold text-ink-muted">
          <span>{v.done}/{v.total} unit selesai</span>
          <span>{v.pct}%</span>
        </div>
        <ProgressBar value={v.pct} color={`lm-${v.color}`} track="white" label={`Progres ${m.title}`} />
        <span className="text-meta text-ink-2">{v.metaShort}</span>
      </div>
      {m.status !== 'selesai' && (
        <Button block icon={<Icon.Play size={16} />} onClick={() => start({ moduleId: m.id })}>Mulai fokus {focus} mnt</Button>
      )}
    </div>
  );
}

function WeekCard({ m, modules }: { m: LearningModule; modules: LearningModule[] }) {
  const sessions = useRows('study_sessions').rows;
  const today = useToday();
  const upd = useUpdate('learning_modules');
  const allTargets = modules.filter((x) => x.status === 'aktif').reduce((a, x) => a + x.weekly_target_min, 0);
  const w = weekStudy({ sessions, today, moduleId: m.id, moduleTarget: m.weekly_target_min, allTargets });
  const targets = TARGETS.includes(m.weekly_target_min) ? TARGETS : [...TARGETS, m.weekly_target_min].sort((a, b) => a - b);
  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <SectionTitle size="sm" title="Minggu ini" right={<span className="text-meta font-semibold text-ink-3">{dayLabel(w.from).split(' ').slice(1).join(' ')} – {dayLabel(w.to).split(' ').slice(1).join(' ')}</span>} />
      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-stat font-extrabold">{w.moduleMin}</span>
        <span className="text-label font-semibold text-ink-3">/ {m.weekly_target_min} mnt</span>
        {w.moduleMin >= m.weekly_target_min && <Tag tone="rutinitas" className="ml-auto">Target tercapai</Tag>}
      </div>
      <ProgressBar value={w.modulePct} label="Menit modul minggu ini dibanding target" />
      <span className="text-meta text-ink-3">Semua modul aktif: {w.totalMin} / {allTargets} mnt ({w.totalPct}%)</span>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="mr-1 text-meta font-bold text-ink-muted">Target per minggu</span>
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={m.weekly_target_min === t}
            onClick={() => void upd.patch(m.id, { weekly_target_min: t })}
            className={cx('h-9 rounded-full border px-3 text-meta font-bold', m.weekly_target_min === t ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted')}
          >
            {t} mnt
          </button>
        ))}
      </div>
    </Card>
  );
}

function ReminderCard({ m }: { m: LearningModule }) {
  const upd = useUpdate('learning_modules');
  const time = hhmm(m.remind_at);
  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-body font-extrabold">Pengingat</span>
          <span className="text-meta text-ink-3">{time ? (m.remind_enabled ? `Setiap ${m.remind_days.length === 7 ? 'hari' : m.remind_days.map((d) => HARI_PENDEK[d]).join(', ')} jam ${time}` : 'Nonaktif') : 'Belum ada jam pengingat'}</span>
        </div>
        <ToggleSwitch checked={m.remind_enabled && !!time} disabled={!time} onChange={(v) => void upd.patch(m.id, { remind_enabled: v })} label={`Pengingat ${m.title}`} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="mod-remind-time" className="text-label font-bold text-ink-muted">Jam</label>
        <input
          id="mod-remind-time"
          type="time"
          value={time}
          onChange={(e) => void upd.patch(m.id, { remind_at: e.target.value || null, remind_enabled: e.target.value ? (m.remind_at ? m.remind_enabled : true) : false })}
          className="tabular h-11 rounded-lg border border-line-strong bg-surface px-3 text-card font-bold text-ink outline-none focus:border-brand-400"
        />
      </div>
      <div role="group" aria-label="Hari pengingat" className="grid grid-cols-7 gap-1">
        {HARI_PENDEK.slice(1).map((h, i) => {
          const n = i + 1;
          const on = m.remind_days.includes(n);
          return (
            <button
              key={h}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = on ? m.remind_days.filter((x) => x !== n) : [...m.remind_days, n].sort();
                if (!next.length) { toast('Pilih minimal satu hari.'); return; }
                void upd.patch(m.id, { remind_days: next });
              }}
              className={cx('h-11 rounded-md border text-meta font-bold', on ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted')}
            >
              {h}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function UnitList({ m, units }: { m: LearningModule; units: LearningUnit[] }) {
  const setStatus = useUnitSetStatus();
  const up = useUpsert('learning_units');
  const [reorder, setReorder] = useState(false);
  const [editing, setEditing] = useState<LearningUnit | null>(null);
  const [draft, setDraft] = useState('');
  const done = units.filter((u) => u.status === 'selesai').length;
  const sens = detectSensitive(draft);
  const addErr = sens.length ? SENSITIVE_MESSAGE[sens[0]] : null;

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= units.length) return;
    const next = [...units];
    [next[i], next[j]] = [next[j], next[i]];
    const changed = next.map((u, k) => ({ id: u.id, sort: k })).filter((x, k) => next[k].sort !== x.sort);
    if (changed.length) void up.save(changed);
  };
  const add = async () => {
    const t = draft.trim();
    if (!t || addErr) return;
    try {
      await up.save({ module_id: m.id, title: t.slice(0, 120), kind: 'bacaan', url: null, est_min: 30, status: 'belum', notes: null, completed_at: null, sort: units.reduce((a, u) => Math.max(a, u.sort), -1) + 1 });
      setDraft('');
    } catch {
      toast('Gagal menambah unit.');
    }
  };

  return (
    <section aria-labelledby="unit-h" className="flex flex-col gap-2">
      <SectionTitle
        title={<span id="unit-h">Unit · {done}/{units.length}</span>}
        right={units.length > 1 && (
          <button type="button" aria-pressed={reorder} onClick={() => setReorder((v) => !v)} className="h-9 rounded-full bg-transparent px-2 text-label font-bold text-primary">
            {reorder ? 'Selesai urutkan' : 'Urutkan'}
          </button>
        )}
      />
      {units.length === 0 && <EmptyState compact text="Belum ada unit. Tambahkan bab atau materi pertama." />}
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {units.map((u, i) => {
          const isDone = u.status === 'selesai';
          const label = unitLabel(units, u);
          return (
            <li key={u.id} className={cx('flex items-center gap-1 rounded-2xl border py-0.5 pr-1 pl-0.5', isDone ? 'border-brand-200 bg-primary-soft' : 'border-line bg-surface')}>
              <CheckBox
                round
                checked={isDone}
                label={(isDone ? 'Batalkan selesai: ' : 'Tandai selesai: ') + label}
                onToggle={() => setStatus.mutate({ p_unit_id: u.id, p_status: isDone ? 'belum' : 'selesai' })}
              />
              <button type="button" onClick={() => setEditing(u)} className="flex min-w-0 flex-1 flex-col gap-0.5 bg-transparent py-1.5 text-left" aria-label={`Ubah ${label}`}>
                <span className={cx('truncate text-body font-bold', isDone ? 'text-brand-800 line-through decoration-brand-300' : 'text-ink')}>{label}</span>
                <span className="truncate text-meta text-ink-3">
                  {UNIT_KIND_LABEL[u.kind]} · {u.est_min} mnt{u.status === 'sedang' ? ' · sedang dipelajari' : ''}{u.notes ? ' · ada catatan' : ''}
                </span>
              </button>
              {u.url && !reorder && (
                <a href={u.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka tautan ${label}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2">
                  <Icon.ArrowRight size={18} />
                </a>
              )}
              {reorder && (
                <>
                  <IconButton variant="plain" label={`Naikkan ${label}`} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><Icon.ChevronUp size={18} /></IconButton>
                  <IconButton variant="plain" label={`Turunkan ${label}`} disabled={i === units.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><Icon.ChevronDown size={18} /></IconButton>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <div className="flex gap-2">
          <label htmlFor="unit-new" className="sr-only">Judul unit baru</label>
          <input id="unit-new" value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} placeholder={`Unit ${units.length + 1}: judul materi`} className={cx(inputCls, 'h-11')} autoComplete="off" />
          <Button type="submit" variant="secondary" disabled={!draft.trim() || !!addErr}>Tambah</Button>
        </div>
        {addErr && <span role="alert" className="text-meta font-semibold text-danger-fg">{addErr}</span>}
      </form>
      {editing && <UnitEditSheet key={editing.id} unit={editing} label={unitLabel(units, editing)} open onClose={() => setEditing(null)} />}
    </section>
  );
}

function SessionHistory({ m, units }: { m: LearningModule; units: LearningUnit[] }) {
  const sessions = useRows('study_sessions').rows;
  const [manual, setManual] = useState(false);
  const [all, setAll] = useState(false);
  const list = useMemo(() => sessions.filter((s) => s.module_id === m.id).sort((a, b) => b.started_at.localeCompare(a.started_at)), [sessions, m.id]);
  const shown = all ? list : list.slice(0, 8);
  const total = list.reduce((a, s) => a + s.duration_min, 0);
  return (
    <section aria-labelledby="sesi-h" className="flex flex-col gap-2">
      <SectionTitle
        title={<span id="sesi-h">Riwayat sesi</span>}
        right={<Button size="xs" variant="secondary" icon={<Icon.Plus size={16} />} onClick={() => setManual(true)}>Catat sesi manual</Button>}
      />
      {list.length ? (
        <>
          <span className="text-meta text-ink-3">{list.length} sesi · total {total} mnt</span>
          <Card className="px-3.5 py-1">
            {shown.map((s) => {
              const u = s.unit_id ? units.find((x) => x.id === s.unit_id) : undefined;
              return (
                <div key={s.id} className="flex items-center gap-3 border-b border-surface-2 py-2.5 last:border-b-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-fg"><Icon.Timer size={18} /></span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-bold">{dayLabel(s.started_on)} · {wibTime(new Date(s.started_at))}</span>
                    <span className="truncate text-meta text-ink-3">{u ? unitLabel(units, u) : 'Tanpa unit'}</span>
                  </div>
                  {s.source === 'manual' && <Tag tone="neutral">Manual</Tag>}
                  <span className="tabular shrink-0 text-body font-extrabold">{s.duration_min} mnt</span>
                </div>
              );
            })}
          </Card>
          {list.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="h-10 self-start bg-transparent text-label font-bold text-primary">
              {all ? 'Tampilkan lebih sedikit' : `Lihat semua (${list.length})`}
            </button>
          )}
        </>
      ) : (
        <EmptyState compact text="Belum ada sesi untuk modul ini. Mulai 25 menit dulu, aku jagain waktunya." />
      )}
      {manual && <ManualSessionSheet open moduleId={m.id} units={units} onClose={() => setManual(false)} />}
    </section>
  );
}

export default function ModuleDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const today = useToday();
  const modules = useRows('learning_modules');
  const units = useRows('learning_units');
  const sessions = useRows('study_sessions').rows;
  const m = modules.rows.find((x) => x.id === id);
  const v = useMemo(() => (m ? moduleView(m, units.rows, sessions, today) : null), [m, units.rows, sessions, today]);
  const back = () => nav('/tumbuh#belajar');

  if (modules.isLoading || units.isLoading) {
    return (
      <Page narrow>
        <div className="flex flex-col gap-4 px-4 pt-5 lg:px-0 lg:pt-0">
          <Skeleton className="h-60 rounded-5xl" />
          <ListSkeleton rows={4} />
        </div>
      </Page>
    );
  }
  if (modules.isError || units.isError) {
    return <Page narrow><div className="px-4 pt-5 lg:px-0"><ErrorState onRetry={() => { void modules.refetch(); void units.refetch(); }} /></div></Page>;
  }
  if (!m || !v) {
    return (
      <Page narrow>
        <div className="flex flex-col gap-3 px-4 pt-5 lg:px-0">
          <IconButton label="Kembali" onClick={back}><Icon.ChevronLeft size={20} /></IconButton>
          <EmptyState mood="worried" title="Modul tidak ditemukan" text="Mungkin sudah diarsipkan atau dihapus." action={<Button size="sm" onClick={back}>Ke Tumbuh</Button>} />
        </div>
      </Page>
    );
  }
  return (
    <Page narrow>
      <Header m={m} v={v} onBack={back} />
      <div className={cx('flex flex-col gap-5 pt-4', desktop ? '' : 'px-4')}>
        <WeekCard m={m} modules={modules.rows} />
        <ReminderCard m={m} />
        <UnitList m={m} units={v.units} />
        <SessionHistory m={m} units={v.units} />
      </div>
    </Page>
  );
}

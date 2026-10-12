// Tumbuh `/tumbuh?tab=hari-ini|kalender|pengingat` — Belajar.dc.html (HP) & Desktop-Tumbuh.dc.html (≥1024). UI-SPEC §6, §14.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { Mood } from '@common/lines.id.ts';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { EmptyState, ErrorState, ListSkeleton, Page, ScreenHeader, Segmented, Skeleton } from '@/components/ui';
import { useRows } from '@/data/hooks';
import type { Routine } from '@/data/types';
import { cx } from '@/lib/cx';
import { readLocal, writeLocal } from '@/lib/storage';
import { useIsDesktop, useNow } from '@/lib/hooks';
import { useUi } from '@/stores/ui';
import { timerElapsed, useTimer } from '@/stores/timer';
import { formatClock } from '@/app/TimerChip';
import { ModuleCard, ModuleRow } from '@/features/learning/components/ModuleRow';
import { useFocusMinutes, useLearning, useStartFocus } from '@/features/learning/hooks';
import { RoutineRow } from '@/features/routines/components/RoutineRow';
import { useRoutineToggle } from '@/features/routines/hooks';
import { GardenCalendar } from '../components/GardenCalendar';
import { RemindersTab, TodayReminders } from '../components/Reminders';
import { StreakChip, TreeCard } from '../components/TreeCard';
import { useGrowth } from '../hooks';

type Tab = 'hari-ini' | 'kalender' | 'pengingat';
const TABS: { value: Tab; label: string }[] = [
  { value: 'hari-ini', label: 'Hari ini' },
  { value: 'kalender', label: 'Kalender' },
  { value: 'pengingat', label: 'Pengingat' },
];
const OTHERS_KEY = 'hamzi-tumbuh-others-open';

interface Bubble { id: number; mood: Mood; line: string }

function useGrowthPage() {
  const growth = useGrowth();
  const learning = useLearning();
  const routinesQ = useRows('routines');
  const logs = useRows('routine_logs');
  const openQuick = useUi((s) => s.openQuick);
  const startFocus = useStartFocus();
  const focusMin = useFocusMinutes();
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const seq = useRef(0);
  const onReact = useCallback((mood: Mood, line: string) => setBubble({ id: ++seq.current, mood, line }), []);
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 6000);
    return () => window.clearTimeout(t);
  }, [bubble]);
  const toggle = useRoutineToggle(onReact);
  const activeRoutines = routinesQ.rows.filter((r) => !r.archived);
  return {
    g: growth.data, index: growth.index, today: growth.today, learning, toggle, bubble, openQuick, startFocus, focusMin,
    loading: growth.loading || learning.loading,
    isError: routinesQ.isError || logs.isError || learning.isError,
    refetch: () => { void routinesQ.refetch(); void logs.refetch(); learning.refetch(); },
    hasAnything: activeRoutines.length > 0 || learning.modules.length > 0,
  };
}
type D = ReturnType<typeof useGrowthPage>;

function AddButton({ children, onClick, size = 'sm' }: { children: ReactNode; onClick: () => void; size?: 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 rounded-full border border-line-strong bg-surface font-extrabold text-primary hover:bg-surface-2',
        size === 'lg' ? 'h-11 px-4 text-label-lg' : 'h-9 px-3 text-label',
      )}
    >
      {children}
    </button>
  );
}

function ReactionBubble({ b }: { b: Bubble | null }) {
  return (
    <>
      <span role="status" className="sr-only">{b?.line ?? ''}</span>
      {b && (
        <div key={b.id} aria-hidden="true" className="flex animate-pop-in items-center gap-2.5 rounded-2xl bg-primary-soft py-1.5 pr-3.5 pl-1.5">
          <Mascot mood={b.mood} size={48} />
          <span className="text-label font-bold text-brand-800">{b.line}</span>
        </div>
      )}
    </>
  );
}

function RoutineList({ d, list, desktop }: { d: D; list: Routine[]; desktop: boolean }) {
  return (
    <div className={desktop ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5' : 'flex flex-col gap-2'}>
      {list.map((r) => {
        const log = d.g.logToday(r.id);
        return <RoutineRow key={r.id} r={r} log={log} variant={desktop ? 'desktop' : 'mobile'} onToggle={(delta) => d.toggle(r, log, delta)} />;
      })}
    </div>
  );
}

function RequiredSection({ d, desktop }: { d: D; desktop: boolean }) {
  const list = d.g.requiredToday;
  const doneN = list.filter((r) => d.g.logToday(r.id)?.done).length;
  return (
    <section aria-labelledby="rutin-wajib" className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 id="rutin-wajib" className="m-0 text-section font-extrabold">Rutinitas wajib · {doneN}/{list.length}</h2>
        {!desktop && <AddButton onClick={() => d.openQuick('routine')}>+ Rutinitas</AddButton>}
      </div>
      {d.loading ? <ListSkeleton rows={4} /> : list.length ? <RoutineList d={d} list={list} desktop={desktop} /> : (
        <p className="m-0 rounded-2xl border border-dashed border-line-strong px-3.5 py-3 text-body text-ink-2">Tidak ada rutinitas wajib terjadwal hari ini.</p>
      )}
      <ReactionBubble b={d.bubble} />
    </section>
  );
}

function OthersSection({ d, desktop }: { d: D; desktop: boolean }) {
  const [open, setOpen] = useState<boolean>(() => readLocal(OTHERS_KEY, false));
  const list = d.g.othersToday;
  if (d.loading || !list.length) return null;
  const doneN = list.filter((r) => d.g.logToday(r.id)?.done).length;
  const toggleOpen = () => { setOpen(!open); writeLocal(OTHERS_KEY, !open); };
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="kebiasaan-lain"
        className="-mx-1 flex h-11 items-center justify-between rounded-lg bg-transparent px-1 text-left hover:bg-surface-2"
      >
        <h2 className="m-0 text-section font-extrabold">Kebiasaan lain · {doneN}/{list.length}</h2>
        <Icon.ChevronDown size={20} className={cx('text-ink-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div id="kebiasaan-lain"><RoutineList d={d} list={list} desktop={desktop} /></div>}
    </section>
  );
}

function LearningSection({ d, desktop }: { d: D; desktop: boolean }) {
  const views = d.learning.views;
  return (
    <section id="belajar" aria-labelledby="belajar-h" className={cx('flex scroll-mt-4 flex-col', desktop ? 'gap-3.5' : 'gap-2')}>
      <div className={cx('flex items-center justify-between gap-3', desktop ? 'mt-1.5' : 'min-h-9')}>
        <h2 id="belajar-h" className="m-0 text-section font-extrabold">Belajar mandiri</h2>
        {!desktop && <AddButton onClick={() => d.openQuick('module')}>+ Modul</AddButton>}
      </div>
      {d.loading ? <ListSkeleton rows={2} /> : views.length ? (
        <div className={desktop ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5' : 'flex flex-col gap-2'}>
          {views.map((v) => desktop
            ? <ModuleCard key={v.module.id} v={v} focusMin={d.focusMin} onStart={() => d.startFocus({ moduleId: v.module.id })} />
            : <ModuleRow key={v.module.id} v={v} focusMin={d.focusMin} onStart={() => d.startFocus({ moduleId: v.module.id })} />)}
        </div>
      ) : (
        <EmptyState compact text="Belum ada modul belajar aktif. Mulai dari satu topik kecil." action={<AddButton onClick={() => d.openQuick('module')}>+ Modul</AddButton>} />
      )}
    </section>
  );
}

function FirstEmpty({ d }: { d: D }) {
  return (
    <EmptyState
      text="Tambah rutinitas pertamamu. Pohonmu mulai dari biji kecil."
      action={(
        <>
          <AddButton onClick={() => d.openQuick('routine')}>+ Rutinitas</AddButton>
          <AddButton onClick={() => d.openQuick('module')}>+ Modul</AddButton>
        </>
      )}
    />
  );
}

function TodayTab({ d }: { d: D }) {
  if (!d.loading && !d.hasAnything) return <div className="px-4 pt-4 pb-6"><FirstEmpty d={d} /></div>;
  return (
    <div className="flex flex-col gap-4.5 px-4 pt-4 pb-6">
      <RequiredSection d={d} desktop={false} />
      <OthersSection d={d} desktop={false} />
      <LearningSection d={d} desktop={false} />
    </div>
  );
}

/** Scroll ke #belajar (tautan Beranda /tumbuh#belajar) setelah data termuat. */
function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || hash !== '#belajar') return;
    const t = window.setTimeout(() => document.getElementById('belajar')?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(t);
  }, [ready, hash]);
}

function MobileGrowth({ d }: { d: D }) {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const raw = params.get('tab');
  const tab: Tab = hash === '#belajar' ? 'hari-ini' : raw === 'kalender' || raw === 'pengingat' ? raw : 'hari-ini';
  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params);
    if (t === 'hari-ini') p.delete('tab'); else p.set('tab', t);
    setParams(p, { replace: true });
  };
  useHashScroll(!d.loading && tab === 'hari-ini');
  return (
    <div>
      <ScreenHeader overline="Rutinitas + belajar mandiri" title="Tumbuh" right={<StreakChip n={d.g.streak} />} />
      {d.loading ? <Skeleton className="mx-4 mt-3.5 h-47.5 rounded-6xl" /> : <TreeCard g={d.g} />}
      <Segmented<Tab> className="mx-4 mt-3.5" options={TABS} value={tab} onChange={setTab} label="Tampilan Tumbuh" />
      {d.isError && <div className="px-4 pt-4"><ErrorState onRetry={d.refetch} /></div>}
      {tab === 'hari-ini' && <TodayTab d={d} />}
      {tab === 'kalender' && <div className="px-4 pt-4 pb-6"><GardenCalendar index={d.index} today={d.today} /></div>}
      {tab === 'pengingat' && <RemindersTab today={d.today} />}
    </div>
  );
}

function DesktopTimerChip() {
  const active = useTimer((s) => s.active);
  const minimized = useTimer((s) => s.minimized);
  const setMinimized = useTimer((s) => s.setMinimized);
  const now = useNow(1000);
  if (!active || !minimized) return null;
  const remain = Math.max(0, active.plannedMin * 60_000 - timerElapsed(active, now.getTime()));
  return (
    <button type="button" onClick={() => setMinimized(false)} className="flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-label-lg font-extrabold text-on-primary shadow-day-sel" aria-label="Buka timer fokus">
      <Icon.Clock size={18} />
      <span className="tabular">{active.finished ? 'Beres!' : formatClock(remain)}</span>
    </button>
  );
}

function DesktopGrowth({ d }: { d: D }) {
  useHashScroll(!d.loading);
  return (
    <Page className="lg:gap-4.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-50 flex-1 flex-col">
          <span className="text-meta font-semibold text-ink-3">Rutinitas + belajar mandiri</span>
          <h1 className="m-0 text-title font-extrabold tracking-[-0.5px]">Tumbuh</h1>
        </div>
        <DesktopTimerChip />
        <StreakChip n={d.g.streak} />
        <AddButton size="lg" onClick={() => d.openQuick('routine')}>+ Rutinitas</AddButton>
        <AddButton size="lg" onClick={() => d.openQuick('module')}>+ Modul</AddButton>
      </div>
      {d.isError && <ErrorState onRetry={d.refetch} />}
      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Pohon dan kebun" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          {d.loading ? <Skeleton className="h-95 rounded-6xl" /> : <TreeCard g={d.g} variant="desktop" />}
          <GardenCalendar index={d.index} today={d.today} variant="desktop" />
        </section>
        <section aria-label="Hari ini" className="flex min-w-0 flex-[1.5_1_400px] flex-col gap-3.5">
          {!d.loading && !d.hasAnything ? <FirstEmpty d={d} /> : (
            <>
              <RequiredSection d={d} desktop />
              <OthersSection d={d} desktop />
              <LearningSection d={d} desktop />
            </>
          )}
          <h2 className="m-0 mt-1.5 text-section font-extrabold">Pengingat hari ini</h2>
          <TodayReminders today={d.today} />
        </section>
      </div>
    </Page>
  );
}

export default function GrowthPage() {
  const d = useGrowthPage();
  const desktop = useIsDesktop();
  return desktop ? <DesktopGrowth d={d} /> : <MobileGrowth d={d} />;
}

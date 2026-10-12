// Rencana `/rencana?tab=hari-ini|minggu|proyek` — Rencana.dc.html (HP) & Desktop-Rencana.dc.html (≥1024). UI-SPEC §3, PRD TASK-04..08, PROJ-03.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { addDays, weekStart } from '@common/calc/index.ts';
import { BULAN, dayLabelComma, dayLong } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, Columns, EmptyState, ErrorState, Fab, IconButton, ListSkeleton, Page, ScreenHeader, SectionTitle, Segmented, WeekStrip,
} from '@/components/ui';
import { useRows } from '@/data/hooks';
import type { Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop, useNow, useToday } from '@/lib/hooks';
import { useUi } from '@/stores/ui';
import { agendaOn, kindsByDay, shiftMonth, type AgendaKind } from '@/features/calendar/derive';
import { useAgendaSources } from '@/features/calendar/hooks';
import { AgendaList, MonthGrid } from '@/features/calendar/components/MonthGrid';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ProjectFormSheet } from '@/features/projects/components/ProjectSheets';
import { projectDueText, projectMilestones, projectTasks, shortDate, sortProjects, taskStats } from '@/features/projects/derive';
import {
  isDone, isOpen, orderByScore, overdueTasks, planDayTasks, planMeta, taskContext, taskXpOn, dueLabel, weekGroups,
} from '../derive';
import { useTaskSnooze, useTaskToggle } from '../hooks';
import { HabitGrid } from '../components/HabitGrid';
import { OverdueRow, ProgressCard, WeekList } from '../components/PlanParts';
import { TaskRow } from '../components/TaskRow';

type Tab = 'hari-ini' | 'minggu' | 'proyek';
const TABS: { value: Tab; label: string }[] = [
  { value: 'hari-ini', label: 'Hari ini' },
  { value: 'minggu', label: 'Minggu ini' },
  { value: 'proyek', label: 'Proyek' },
];
const DOT_KINDS: ReadonlySet<AgendaKind> = new Set<AgendaKind>(['tugas', 'ujian', 'event']);
/** Agenda kanan desktop: kelas, ujian, event (tugas hari itu sudah ada di kolom kiri, rutinitas di Kebiasaan). */
const AGENDA_KINDS: ReadonlySet<AgendaKind> = new Set<AgendaKind>(['kelas', 'ujian', 'event']);

function usePlanData() {
  const now = useNow(30_000);
  const today = useToday();
  const tasksQ = useRows('tasks');
  const projectsQ = useRows('projects');
  const subtasks = useRows('subtasks').rows;
  const milestones = useRows('milestones').rows;
  const xp = useRows('xp_events').rows;
  const agenda = useAgendaSources();
  return {
    now, today, subtasks, milestones, xp, agenda,
    tasks: tasksQ.rows, projects: projectsQ.rows, exams: agenda.src.exams, courses: agenda.src.courses, events: agenda.src.events,
    loading: tasksQ.isLoading || projectsQ.isLoading,
    isError: tasksQ.isError || projectsQ.isError,
    refetch: () => { void tasksQ.refetch(); void projectsQ.refetch(); agenda.refetch(); },
  };
}
type PlanData = ReturnType<typeof usePlanData>;

/* ---------- Tab Hari ini ---------- */

function TodayTab({ d, sel, desktop }: { d: PlanData; sel: string; desktop: boolean }) {
  const toggle = useTaskToggle();
  const snooze = useTaskSnooze();
  const openQuick = useUi((s) => s.openQuick);
  const isToday = sel === d.today;
  const list = useMemo(
    () => orderByScore(planDayTasks(d.tasks, sel, d.now), d.now, { exams: d.exams, projects: d.projects }),
    [d.tasks, sel, d.now, d.exams, d.projects],
  );
  const overdue = isToday ? overdueTasks(d.tasks, d.now) : [];
  const done = list.filter(isDone).length;
  const focus = list.filter((t) => isOpen(t) && t.priority >= 3).length;
  const row = (t: Task) => (
    <TaskRow key={t.id} t={t} variant={desktop ? 'list' : 'card'} onToggle={toggle} meta={planMeta(t, { day: sel, today: d.today, subtasks: d.subtasks })} />
  );
  return (
    <>
      <ProgressCard done={done} total={list.length} focus={focus} xp={taskXpOn(d.xp, sel)} desktop={desktop} />
      {overdue.length > 0 && (
        <section aria-label={`Terlambat, ${overdue.length} tugas`} className="flex flex-col gap-2.5">
          <SectionTitle size="sm" tone="danger" title={`Terlambat · ${overdue.length}`} />
          {overdue.map((t) => (
            <OverdueRow
              key={t.id} t={t} desktop={desktop} onToggle={toggle} onSnooze={snooze}
              meta={`${dueLabel(t, d.today)} · ${taskContext(t, d.projects, d.courses)}`}
            />
          ))}
        </section>
      )}
      <section className="flex flex-col gap-2.5">
        <SectionTitle size="sm" title={isToday ? 'Hari ini' : dayLabelComma(sel)} />
        {list.length === 0 ? (
          <EmptyState
            compact
            text={isToday ? 'Belum ada tugas hari ini. Mau tambah satu?' : 'Belum ada tugas di tanggal ini.'}
            action={<Button size="xs" onClick={() => openQuick('task', isToday ? undefined : { due_date: sel })}>+ Tugas</Button>}
          />
        ) : desktop ? (
          <div className="rounded-3xl border border-line bg-surface px-2 py-1">{list.map(row)}</div>
        ) : (
          list.map(row)
        )}
      </section>
      {!desktop && isToday && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle size="sm" title="Kebiasaan" />
          <HabitGrid />
        </section>
      )}
    </>
  );
}

/* ---------- Tab Minggu ini ---------- */

function WeekTab({ d, desktop }: { d: PlanData; desktop: boolean }) {
  const openQuick = useUi((s) => s.openQuick);
  const groups = useMemo(() => weekGroups({ tasks: d.tasks, exams: d.exams, courses: d.courses, events: d.events, now: d.now }), [d.tasks, d.exams, d.courses, d.events, d.now]);
  if (!groups.length) {
    return <EmptyState text="Tujuh hari ke depan masih lega. Mau cicil sesuatu?" action={<Button size="sm" onClick={() => openQuick('task', { due_date: addDays(d.today, 1) })}>+ Tugas</Button>} />;
  }
  return <WeekList groups={groups} desktop={desktop} />;
}

/* ---------- Tab Proyek ---------- */

function ProjectsTab({ d, desktop, onNew }: { d: PlanData; desktop: boolean; onNew: () => void }) {
  const list = sortProjects(d.projects);
  const [showDone, setShowDone] = useState(false);
  if (!list.length) {
    return (
      <EmptyState
        title="Belum ada proyek"
        text="Pecah tugas besar jadi milestone kecil biar lebih ringan."
        action={<Button size="sm" onClick={onNew} icon={<Icon.Plus size={16} />}>Proyek baru</Button>}
      />
    );
  }
  const active = list.filter((p) => p.status !== 'selesai');
  const finished = list.filter((p) => p.status === 'selesai');
  const grid = desktop ? 'grid grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))] gap-3' : 'flex flex-col gap-3';
  const card = (p: (typeof list)[number]) => {
    const stats = taskStats(projectTasks(p.id, d.tasks), d.now);
    return <ProjectCard key={p.id} p={p} stats={stats} due={projectDueText(p, stats, d.today)} milestones={projectMilestones(p.id, d.milestones)} desktop={desktop} />;
  };
  const addBtn = (
    <button
      type="button"
      onClick={onNew}
      className="flex min-h-14 items-center justify-center gap-2 rounded-4xl border border-dashed border-line-strong bg-transparent text-body font-extrabold text-primary hover:bg-primary-soft"
    >
      <Icon.Plus size={18} /> Proyek baru
    </button>
  );
  return (
    <>
      <div className={grid}>
        {active.map(card)}
        {addBtn}
      </div>
      {finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="flex h-11 items-center gap-2 self-start bg-transparent text-body font-extrabold text-ink-2">
            Selesai · {finished.length}
            <Icon.ChevronDown size={18} className={cx('transition-transform', showDone && 'rotate-180')} />
          </button>
          {showDone && <div className={grid}>{finished.map(card)}</div>}
        </section>
      )}
    </>
  );
}

/* ---------- Kerangka ---------- */

function useTab(): [Tab, (t: Tab) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'minggu' || raw === 'proyek' ? raw : 'hari-ini';
  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params);
    p.set('tab', t);
    setParams(p, { replace: true });
  };
  return [tab, setTab];
}

function TabContent({ tab, d, sel, desktop, onNewProject }: { tab: Tab; d: PlanData; sel: string; desktop: boolean; onNewProject: () => void }) {
  if (d.isError) return <ErrorState text="Rencana belum bisa dimuat." onRetry={d.refetch} />;
  if (d.loading) return <ListSkeleton rows={4} />;
  if (tab === 'minggu') return <WeekTab d={d} desktop={desktop} />;
  if (tab === 'proyek') return <ProjectsTab d={d} desktop={desktop} onNew={onNewProject} />;
  return <TodayTab d={d} sel={sel} desktop={desktop} />;
}

function MobilePlan({ d, tab, setTab, sel, setSel, onNewProject }: { d: PlanData; tab: Tab; setTab: (t: Tab) => void; sel: string; setSel: (s: string) => void; onNewProject: () => void }) {
  const nav = useNavigate();
  const openQuick = useUi((s) => s.openQuick);
  const dots = useMemo(() => {
    const ws = weekStart(d.today);
    return new Set(kindsByDay(ws, addDays(ws, 6), d.agenda.src, DOT_KINDS).keys());
  }, [d.today, d.agenda.src]);
  return (
    <div>
      <ScreenHeader
        overline={dayLong(d.today)}
        title="Rencana"
        right={(
          <>
            <IconButton label="Cari" onClick={() => nav('/cari')}><Icon.Search size={20} /></IconButton>
            <IconButton label="Buka kalender bulan" onClick={() => nav('/rencana/kalender')}><Icon.Calendar size={20} /></IconButton>
          </>
        )}
      />
      <div className="px-3 pt-4 pb-1">
        <WeekStrip anchor={d.today} selected={sel} onSelect={(x) => { setSel(x); if (tab !== 'hari-ini') setTab('hari-ini'); }} dots={dots} today={d.today} />
      </div>
      <Segmented className="mx-4 mt-3.5" label="Tampilan rencana" options={TABS} value={tab} onChange={setTab} />
      <div className={cx('flex flex-col px-4 pt-4.5 pb-6', tab === 'proyek' ? 'gap-3' : tab === 'minggu' ? 'gap-4' : 'gap-4.5')}>
        <TabContent tab={tab} d={d} sel={sel} desktop={false} onNewProject={onNewProject} />
      </div>
      <Fab label="Tugas baru" onClick={() => openQuick('task', sel !== d.today && tab === 'hari-ini' ? { due_date: sel } : undefined)} />
    </div>
  );
}

function MiniCalendar({ d, sel, setSel }: { d: PlanData; sel: string; setSel: (s: string) => void }) {
  const [ym, setYm] = useState(() => ({ year: Number(sel.slice(0, 4)), month: Number(sel.slice(5, 7)) }));
  const first = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`;
  const dots = useMemo(() => kindsByDay(first, addDays(first, 41), d.agenda.src, DOT_KINDS), [first, d.agenda.src]);
  const nav = (delta: number) => setYm((v) => shiftMonth(v.year, v.month, delta));
  const arrow = 'flex size-11 items-center justify-center bg-transparent p-0';
  const circle = 'flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink-muted hover:bg-surface-2';
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between">
        <Link to="/rencana/kalender" aria-label={`Buka kalender ${BULAN[ym.month]} ${ym.year}`} className="text-card font-extrabold text-ink no-underline hover:text-primary">
          {BULAN[ym.month]} {ym.year}
        </Link>
        <span className="-mr-1.5 flex">
          <button type="button" aria-label="Bulan sebelumnya" onClick={() => nav(-1)} className={arrow}><span className={circle}><Icon.ChevronLeft size={16} /></span></button>
          <button type="button" aria-label="Bulan berikutnya" onClick={() => nav(1)} className={arrow}><span className={circle}><Icon.ChevronRight size={16} /></span></button>
        </span>
      </div>
      <MonthGrid size="sm" year={ym.year} month={ym.month} selected={sel} today={d.today} onSelect={setSel} dots={dots} />
    </div>
  );
}

function DesktopPlan({ d, tab, setTab, sel, setSel, onNewProject }: { d: PlanData; tab: Tab; setTab: (t: Tab) => void; sel: string; setSel: (s: string) => void; onNewProject: () => void }) {
  const openQuick = useUi((s) => s.openQuick);
  const agenda = useMemo(() => agendaOn(sel, d.agenda.src, AGENDA_KINDS), [sel, d.agenda.src]);
  return (
    <Page className="lg:gap-4.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-50 flex-1 flex-col">
          <span className="text-meta font-semibold text-ink-3">{dayLong(d.today)}</span>
          <h1 className="m-0 text-title font-extrabold tracking-[-0.5px]">Rencana</h1>
        </div>
        <Segmented className="w-80" label="Tampilan rencana" options={TABS} value={tab} onChange={setTab} />
        <Button className="shadow-day-sel" icon={<Icon.Plus size={18} />} onClick={() => openQuick('task', sel !== d.today && tab === 'hari-ini' ? { due_date: sel } : undefined)}>
          Tugas baru
        </Button>
      </div>
      <Columns
        left={<TabContent tab={tab} d={d} sel={sel} desktop onNewProject={onNewProject} />}
        right={(
          <>
            <MiniCalendar d={d} sel={sel} setSel={(x) => { setSel(x); if (tab !== 'hari-ini') setTab('hari-ini'); }} />
            <section aria-label={`Agenda ${shortDate(sel, d.today)}`} className="flex flex-col gap-2 rounded-3xl border border-line bg-surface px-4 py-3.5">
              <h2 className="m-0 text-body font-extrabold">Agenda {shortDate(sel, d.today)}</h2>
              {d.agenda.loading ? <ListSkeleton rows={2} /> : agenda.length ? <AgendaList items={agenda} compact /> : (
                <span className="text-label text-ink-3">Tidak ada agenda.</span>
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-body font-extrabold">Kebiasaan</h2>
              <HabitGrid compact />
            </section>
          </>
        )}
      />
    </Page>
  );
}

export default function PlanPage() {
  const desktop = useIsDesktop();
  const d = usePlanData();
  const nav = useNavigate();
  const [tab, setTab] = useTab();
  const [picked, setSel] = useState<string | null>(null);
  const [newProject, setNewProject] = useState(false);
  const sel = picked ?? d.today;
  const props = { d, tab, setTab, sel, setSel, onNewProject: () => setNewProject(true) };
  return (
    <>
      {desktop ? <DesktopPlan {...props} /> : <MobilePlan {...props} />}
      {newProject && <ProjectFormSheet open onClose={() => setNewProject(false)} onSaved={(id) => nav(`/rencana/proyek/${id}`)} />}
    </>
  );
}
